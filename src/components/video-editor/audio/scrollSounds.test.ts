import { describe, expect, it } from "vitest";
import { buildScrollSoundRegions } from "./scrollSounds";
import { DEFAULT_ZOOM_SOUND_EFFECTS } from "./zoomSoundSettings";

describe("recorded scroll sounds", () => {
	it("aligns to the first wheel packet and projects through clip speed", () => {
		const regions = buildScrollSoundRegions(
			[
				{ timeMs: 100, cx: 0.5, cy: 0.5, interactionType: "scroll-up", scrollAmount: 1 },
				{ timeMs: 110, cx: 0.5, cy: 0.5, interactionType: "scroll-up", scrollAmount: 1 },
				{ timeMs: 200, cx: 0.5, cy: 0.5, interactionType: "scroll-down", scrollAmount: 5 },
			],
			[
				{
					id: "clip",
					startMs: 1000,
					endMs: 2000,
					sourceStartMs: 0,
					sourceEndMs: 500,
					speed: 0.5,
				},
			],
			2000,
			{
				...DEFAULT_ZOOM_SOUND_EFFECTS,
				scrollDelaysMs: {
					...DEFAULT_ZOOM_SOUND_EFFECTS.scrollDelaysMs,
					smallScrollUp: -25,
				},
			},
		);
		expect(regions.map(({ startMs, volume }) => [startMs, volume])).toEqual([
			[1175, 0.3],
			[1375, 0.3],
		]);
		expect(regions).toHaveLength(2);
	});

	it("respects the shared scroll sound choice and mute", () => {
		const event = [{ timeMs: 100, cx: 0.5, cy: 0.5, interactionType: "scroll-up" as const }];
		expect(
			buildScrollSoundRegions(event, [], 1000, {
				...DEFAULT_ZOOM_SOUND_EFFECTS,
				scrollSounds: { ...DEFAULT_ZOOM_SOUND_EFFECTS.scrollSounds, smallScrollUp: "none" },
			}),
		).toEqual([]);
		expect(
			buildScrollSoundRegions(event, [], 1000, {
				...DEFAULT_ZOOM_SOUND_EFFECTS,
				scrollVolume: 0,
			}),
		).toEqual([]);
	});
});
