import { describe, expect, it } from "vitest";
import { applySoundEventOverrides } from "./soundEvents";
import { DEFAULT_ZOOM_SOUND_EFFECTS, normalizeZoomSoundEffects } from "./zoomSoundSettings";

describe("individual sound events", () => {
	const regions = [
		{
			id: "zoom-whoosh:one:in",
			startMs: 1000,
			endMs: 1500,
			audioPath: "/one.wav",
			volume: 0.5,
		},
		{
			id: "zoom-whoosh:two:in",
			startMs: 2000,
			endMs: 2500,
			audioPath: "/two.wav",
			volume: 0.5,
		},
	];
	it("edits one event without changing another and retains edits through serialization", () => {
		const settings = normalizeZoomSoundEffects(
			JSON.parse(
				JSON.stringify({
					...DEFAULT_ZOOM_SOUND_EFFECTS,
					events: { [regions[0].id]: { soundId: "better", delayMs: -175, volume: 0.2 } },
				}),
			),
		);
		const result = applySoundEventOverrides(regions, settings, 5000);
		expect(result[0]).toMatchObject({ startMs: 825, volume: 0.2, trackIndex: 1 });
		expect(result[0].audioPath).not.toBe("/one.wav");
		expect(result[1]).toMatchObject(regions[1]);
	});
	it("deletes only the selected event", () => {
		const result = applySoundEventOverrides(
			regions,
			{ ...DEFAULT_ZOOM_SOUND_EFFECTS, events: { [regions[0].id]: { deleted: true } } },
			5000,
		);
		expect(result.map((region) => region.id)).toEqual([regions[1].id]);
	});
});
