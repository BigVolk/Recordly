import { afterEach, describe, expect, it, vi } from "vitest";

const demuxer = vi.hoisted(() => ({
	load: vi.fn(),
	getAVStreams: vi.fn(),
	getDecoderConfig: vi.fn(),
	destroy: vi.fn(),
}));
vi.mock("web-demuxer", () => ({
	WebDemuxer: class {
		load = demuxer.load;
		getAVStreams = demuxer.getAVStreams;
		getDecoderConfig = demuxer.getDecoderConfig;
		destroy = demuxer.destroy;
	},
}));
vi.mock("./localMediaSource", () => ({
	resolveMediaElementSource: async (src: string) => ({ src, revoke: vi.fn() }),
}));

import { AudioMediaProcessor } from "./audioMediaProcessor";

class Processor extends AudioMediaProcessor {
	decode = this.decodeAudioFromUrl.bind(this);
	protected bulkDecodeFromUrl = vi.fn(async () => ({ duration: 1 }) as AudioBuffer);
	get bulk() {
		return this.bulkDecodeFromUrl;
	}
}
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});
describe("audio media decoding", () => {
	it("skips an absent audio stream without bulk loading the silent recording", async () => {
		vi.stubGlobal("window", { location: { href: "http://localhost/" } });
		demuxer.getAVStreams.mockResolvedValue([{ codec_type_string: "video" }]);
		const p = new Processor();
		expect(await p.decode("silent.mp4")).toBeNull();
		expect(demuxer.getDecoderConfig).not.toHaveBeenCalled();
		expect(p.bulk).not.toHaveBeenCalled();
		expect(demuxer.destroy).toHaveBeenCalled();
	});
	it("still uses bulk decoding if streaming a present track fails", async () => {
		vi.stubGlobal("window", { location: { href: "http://localhost/" } });
		demuxer.getAVStreams.mockResolvedValue([{ codec_type_string: "audio" }]);
		demuxer.getDecoderConfig.mockRejectedValueOnce(new Error("Unsupported codec"));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const p = new Processor();
		expect(await p.decode("sound.flac")).toMatchObject({ duration: 1 });
		expect(p.bulk).toHaveBeenCalledWith("sound.flac", 48000);
		warn.mockRestore();
	});
});
