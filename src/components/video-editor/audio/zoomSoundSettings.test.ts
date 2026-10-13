import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_ZOOM_SOUND_EFFECTS,
	getZoomSoundSize,
	normalizeZoomSoundEffects,
	ZOOM_SOUND_LIBRARY,
} from "./zoomSoundSettings";

describe("zoom sound settings", () => {
	it("migrates older projects while preserving valid partial and muted choices", () => {
		expect(normalizeZoomSoundEffects(undefined)).toEqual(DEFAULT_ZOOM_SOUND_EFFECTS);
		expect(normalizeZoomSoundEffects({ smallZoomIn: "better", largeZoomOut: "none" })).toEqual({
			...DEFAULT_ZOOM_SOUND_EFFECTS,
			smallZoomIn: "better",
			largeZoomOut: "none",
		});
		expect(
			normalizeZoomSoundEffects({
				smallZoomIn: "/unknown/audio.wav",
				largeZoomThreshold: Number.NaN,
			}),
		).toEqual(DEFAULT_ZOOM_SOUND_EFFECTS);
		expect(normalizeZoomSoundEffects({ largeZoomThreshold: 100 }).largeZoomThreshold).toBe(5);
	});
	it("treats entrance and exit symmetrically and includes the threshold in large zooms", () => {
		expect(getZoomSoundSize(1, 1.8, 2)).toBe("small");
		expect(getZoomSoundSize(2.2, 1, 2)).toBe("large");
		expect(getZoomSoundSize(1, 2, 2)).toBe("large");
		expect(getZoomSoundSize(2.2, 1.8, 2)).toBe("small");
	});
	it("has accurate durations for every bundled WAV and FLAC", () => {
		for (const sound of ZOOM_SOUND_LIBRARY) {
			const data = readFileSync(
				new URL(`../../../../whooshes/${sound.fileName}`, import.meta.url),
			);
			let durationMs = 0;
			if (sound.fileName.endsWith(".flac")) {
				const packed = data.readBigUInt64BE(18);
				durationMs = (Number(packed & ((1n << 36n) - 1n)) / Number(packed >> 44n)) * 1000;
			} else {
				let bytesPerSecond = 0;
				let dataSize = 0;
				for (let offset = 12; offset + 8 <= data.length; ) {
					const chunk = data.toString("ascii", offset, offset + 4);
					const size = data.readUInt32LE(offset + 4);
					if (chunk === "fmt ") bytesPerSecond = data.readUInt32LE(offset + 16);
					if (chunk === "data") dataSize = size;
					offset += 8 + size + (size % 2);
				}
				durationMs = (dataSize / bytesPerSecond) * 1000;
			}
			expect(sound.durationMs, sound.fileName).toBeCloseTo(durationMs, 4);
		}
	});
});
