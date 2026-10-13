import { describe, expect, it } from "vitest";
import { normalizeCustomSoundEffects, type CustomSoundEffect } from "./customSoundEffects";
import { buildMouseClickRegions } from "./mouseClicks";
import { createProjectData, normalizeProjectEditor } from "../projectPersistence";
import { DEFAULT_ZOOM_SOUND_EFFECTS, normalizeZoomSoundEffects } from "./zoomSoundSettings";
import { buildZoomWhooshRegions } from "./zoomWhooshes";

const whoosh: CustomSoundEffect = {
	id: "local:11111111-1111-4111-8111-111111111111",
	name: "My whoosh",
	kind: "whoosh",
	path: "/sounds/whoosh.wav",
	durationMs: 300,
};
const click: CustomSoundEffect = {
	...whoosh,
	id: "local:22222222-2222-4222-8222-222222222222",
	kind: "click",
	path: "/sounds/click.wav",
	durationMs: 200,
};
describe("imported sound assignments", () => {
	it("preserves custom metadata and assignments across a JSON project round trip", () => {
		const settings = {
			...DEFAULT_ZOOM_SOUND_EFFECTS,
			customSounds: [whoosh, click],
			smallZoomIn: whoosh.id,
			mouseClickSound: click.id,
		};
		expect(normalizeZoomSoundEffects(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
		expect(
			normalizeZoomSoundEffects({
				...settings,
				smallZoomIn: click.id,
				mouseClickSound: whoosh.id,
			}),
		).toMatchObject({ smallZoomIn: "dry-short-in", mouseClickSound: "default-click" });
	});
	it("restores every sound control from a saved project", () => {
		const effects = {
			...DEFAULT_ZOOM_SOUND_EFFECTS,
			customSounds: [whoosh, click],
			smallZoomIn: whoosh.id,
			largeZoomOut: "none" as const,
			mouseClickSound: click.id,
			largeZoomThreshold: 2.7,
			delaysMs: {
				smallZoomIn: -275,
				smallZoomOut: 120,
				largeZoomIn: 330,
				largeZoomOut: -410,
			},
		};
		const project = createProjectData("/recordings/clip.mp4", {
			zoomSoundEffects: effects,
			zoomWhooshVolume: 0.81,
			mouseClickVolume: 0.42,
		});
		const restored = normalizeProjectEditor(JSON.parse(JSON.stringify(project)).editor);
		expect(restored.zoomSoundEffects).toEqual(effects);
		expect(restored.zoomWhooshVolume).toBe(0.81);
		expect(restored.mouseClickVolume).toBe(0.42);
	});
	it("rejects invalid metadata and duplicate IDs", () => {
		expect(
			normalizeCustomSoundEffects([
				whoosh,
				whoosh,
				{ ...click, durationMs: NaN },
				{ ...click, path: "../click.wav" },
				{ ...click, durationMs: 60001 },
				{ ...click, id: "local:../../../../../../../../../../../../" },
			]),
		).toEqual([whoosh]);
	});
	it("uses imported paths and real durations with existing volume, delays, and clipping", () => {
		const settings = {
			...DEFAULT_ZOOM_SOUND_EFFECTS,
			customSounds: [whoosh, click],
			smallZoomIn: whoosh.id,
			smallZoomOut: "none" as const,
			mouseClickSound: click.id,
			delaysMs: { ...DEFAULT_ZOOM_SOUND_EFFECTS.delaysMs, smallZoomIn: -100 },
		};
		const cues = buildZoomWhooshRegions(
			[{ id: "a", startMs: 0, endMs: 1000, depth: 3, focus: { cx: 0.5, cy: 0.5 } }],
			2000,
			{ zoomSoundEffects: settings, zoomWhooshVolume: 0.7 },
		);
		expect(cues).toHaveLength(1);
		expect(cues[0]).toMatchObject({
			audioPath: whoosh.path,
			startMs: 0,
			endMs: 200,
			sourceOffsetMs: 100,
			volume: 0.7,
		});
		const points = [{ timeMs: 900, cx: 0.5, cy: 0.5, interactionType: "click" as const }];
		expect(buildMouseClickRegions(points, [], 1000, 0.4, settings)[0]).toMatchObject({
			audioPath: click.path,
			startMs: 900,
			endMs: 1000,
			volume: 0.4,
		});
		expect(
			buildMouseClickRegions(points, [], 1000, 0.4, { ...settings, mouseClickSound: "none" }),
		).toEqual([]);
	});
});
