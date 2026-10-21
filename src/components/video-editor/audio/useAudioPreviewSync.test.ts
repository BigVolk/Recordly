import { afterEach, describe, expect, it, vi } from "vitest";
import { useAudioPreviewSync } from "./useAudioPreviewSync";

const harness = vi.hoisted(() => ({
	effects: [] as (() => void | (() => void))[],
	refs: [] as { current: unknown }[],
	index: 0,
	loaded: vi.fn(),
}));
vi.mock("react", () => ({
	useCallback: (callback: unknown) => callback,
	useMemo: (factory: () => unknown) => factory(),
	useEffect: (effect: () => void) => harness.effects.push(effect),
	useRef: (value: unknown) => {
		const index = harness.index++;
		harness.refs[index] ??= { current: value };
		return harness.refs[index];
	},
	useState: () => [0, harness.loaded],
}));
vi.mock("@/lib/exporter/localMediaSource", () => ({
	resolveMediaElementSource: async () => ({ src: "file:///audio.wav", revoke: vi.fn() }),
}));
vi.mock("../videoPlayback/playbackRate", () => ({
	supportsPreviewPlaybackRate: (rate: number) => rate <= 16,
}));

afterEach(() => {
	vi.unstubAllGlobals();
	harness.effects = [];
	harness.refs = [];
	harness.index = 0;
	harness.loaded.mockClear();
});

describe("source preview playback ownership", () => {
	it.each([
		{
			name: "sub-second offset",
			muted: false,
			playing: true,
			rate: 1,
			time: 0.5,
			delay: 0,
			plays: true,
		},
		{
			name: "playing clip",
			muted: false,
			playing: true,
			rate: 1,
			time: 1,
			delay: 0,
			plays: true,
		},
		{
			name: "gap or muted clip",
			muted: true,
			playing: true,
			rate: 1,
			time: 1,
			delay: 0,
			plays: false,
		},
		{
			name: "paused clip",
			muted: false,
			playing: false,
			rate: 1,
			time: 1,
			delay: 0,
			plays: false,
		},
		{
			name: "unsupported rate",
			muted: false,
			playing: true,
			rate: 20,
			time: 1,
			delay: 0,
			plays: false,
		},
		{
			name: "before audio start",
			muted: false,
			playing: true,
			rate: 1,
			time: 0,
			delay: 1000,
			plays: false,
		},
		{
			name: "media end",
			muted: false,
			playing: true,
			rate: 1,
			time: 10,
			delay: 0,
			plays: false,
		},
	])("checks $name after a late source load", async ({
		muted,
		playing,
		rate,
		time,
		delay,
		plays,
	}) => {
		const audio = {
			src: "",
			dataset: {},
			duration: 10,
			currentTime: 0,
			playbackRate: 1,
			paused: true,
			volume: 1,
			load: vi.fn(),
			pause: vi.fn(),
			play: vi.fn().mockResolvedValue(undefined),
		};
		vi.stubGlobal("Audio", function () {
			return audio;
		});
		vi.stubGlobal(
			"AudioContext",
			class {
				state = "running";
				destination = {};
				createGain() {
					return { gain: { value: 1 }, connect: vi.fn() };
				}
			},
		);
		// Execute mocked effects explicitly so the asynchronous load can finish between syncs.
		useAudioPreviewSync({
			audioRegions: [],
			previewVolume: 1,
			isPlaying: playing,
			currentTime: time,
			timelineTime: time,
			duration: 10,
			sourcePlaybackRate: rate,
			previewSourceAudioFallbackPaths: ["/audio.system.wav"],
			sourceAudioFallbackStartDelayMsByPath: { "/audio.system.wav": delay },
			sourceAudioResourceVersion: 0,
			isCurrentClipMuted: muted,
			getSourceTrackPreviewGain: () => 1,
			onSourceFallbackLoadError: vi.fn(),
		});
		for (const effect of harness.effects) effect();
		await Promise.resolve();
		expect(harness.loaded).toHaveBeenCalledOnce();
		expect(audio.play).not.toHaveBeenCalled();
		harness.effects.at(-1)?.();
		await Promise.resolve();
		expect(audio.play).toHaveBeenCalledTimes(plays ? 1 : 0);
		if (plays) expect(audio.currentTime).toBeCloseTo(time - delay / 1000);
	});
});

describe("zoom overlay preview transport", () => {
	it("loops scrolling throughout a gesture and auditions it at any paused scrub position", async () => {
		vi.useFakeTimers();
		const audio = {
			src: "",
			duration: 0.085,
			currentTime: 0,
			playbackRate: 1,
			paused: true,
			pause: vi.fn(() => {
				audio.paused = true;
			}),
			play: vi.fn(async () => {
				audio.paused = false;
			}),
		};
		vi.stubGlobal("Audio", function () {
			return audio;
		});
		const render = (time: number) => {
			harness.index = 0;
			harness.effects = [];
			useAudioPreviewSync({
				audioRegions: [
					{
						id: "scroll:a:0",
						startMs: 1000,
						endMs: 3000,
						audioPath: "scroll.wav",
						volume: 1,
					},
				],
				previewVolume: 1,
				isPlaying: false,
				currentTime: time,
				timelineTime: time,
				duration: 4,
				sourcePlaybackRate: 1,
				previewSourceAudioFallbackPaths: [],
				sourceAudioFallbackStartDelayMsByPath: {},
				sourceAudioResourceVersion: 0,
				isCurrentClipMuted: false,
				getSourceTrackPreviewGain: () => 1,
				onSourceFallbackLoadError: vi.fn(),
			});
			for (const effect of harness.effects) effect();
		};
		render(0);
		await Promise.resolve();
		for (const time of [1.2, 1.8, 2.5]) {
			render(time);
			await Promise.resolve();
			expect(audio.paused).toBe(false);
			expect(audio.currentTime).toBeCloseTo((time - 1) % 0.085);
			vi.advanceTimersByTime(100);
			expect(audio.paused).toBe(true);
		}
		vi.useRealTimers();
	});
	it("starts a late-loaded whoosh, pauses it, and restarts at the right offset after seeking", async () => {
		const audio = {
			src: "",
			preload: "",
			currentTime: 0,
			playbackRate: 1,
			paused: true,
			volume: 1,
			pause: vi.fn(() => {
				audio.paused = true;
			}),
			play: vi.fn(async () => {
				audio.paused = false;
			}),
		};
		vi.stubGlobal("Audio", function () {
			return audio;
		});
		const region = {
			id: "zoom-whoosh:a:in",
			startMs: 1000,
			endMs: 1977,
			audioPath: "whoosh.wav",
			volume: 0.35,
		};
		const render = (playing: boolean, time: number, regions = [region]) => {
			harness.index = 0;
			harness.effects = [];
			useAudioPreviewSync({
				audioRegions: regions,
				previewVolume: 0.5,
				isPlaying: playing,
				currentTime: time,
				timelineTime: time,
				duration: 10,
				sourcePlaybackRate: 1,
				previewSourceAudioFallbackPaths: [],
				sourceAudioFallbackStartDelayMsByPath: {},
				sourceAudioResourceVersion: 0,
				isCurrentClipMuted: false,
				getSourceTrackPreviewGain: () => 1,
				onSourceFallbackLoadError: vi.fn(),
			});
			for (const effect of harness.effects) effect();
		};
		render(true, 1.1);
		expect(audio.play).not.toHaveBeenCalled();
		await Promise.resolve();
		expect(harness.loaded).toHaveBeenCalledOnce();
		render(true, 1.1);
		expect(audio.currentTime).toBeCloseTo(0.1);
		expect(audio.volume).toBeCloseTo(0.175);
		expect(audio.play).toHaveBeenCalledOnce();
		render(false, 1.1);
		expect(audio.paused).toBe(true);
		// A short backward seek must restart from zero, even within the drift tolerance.
		render(true, 1);
		expect(audio.currentTime).toBe(0);
		expect(audio.play).toHaveBeenCalledTimes(2);
		render(true, 2);
		expect(audio.paused).toBe(true);
		render(false, 0, []);
		expect(audio.src).toBe("");
	});
});
