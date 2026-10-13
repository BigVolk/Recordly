import { afterEach, describe, expect, it, vi } from "vitest";
import type { ZoomRegion } from "../types";
import { computeRegionStrength, findDominantRegion } from "../videoPlayback/zoomRegionUtils";
import { resolveZoomSoundUrl } from "./zoomSoundAssets";
import { DEFAULT_ZOOM_SOUND_EFFECTS } from "./zoomSoundSettings";
import { buildZoomWhooshRegions } from "./zoomWhooshes";

const zoom = (
	id: string,
	startMs = 2000,
	endMs = 5000,
	depth: ZoomRegion["depth"] = 2,
): ZoomRegion => ({
	id,
	startMs,
	endMs,
	depth,
	focus: { cx: 0.5, cy: 0.5 },
});
afterEach(() => vi.unstubAllGlobals());

describe("automatic zoom whooshes", () => {
	it("schedules entrance and exit at the actual camera transitions", () => {
		const region = zoom("a");
		const cues = buildZoomWhooshRegions([region], 10000);
		expect(cues).toHaveLength(2);
		const [entrance, exit] = cues;
		expect(computeRegionStrength(region, entrance.startMs - 1)).toBe(0);
		expect(computeRegionStrength(region, entrance.startMs + 1)).toBeGreaterThan(0);
		expect(computeRegionStrength(region, exit.startMs - 1)).toBe(1);
		expect(computeRegionStrength(region, exit.startMs + 1)).toBeLessThan(1);
		expect(entrance.audioPath).not.toBe(exit.audioPath);
	});

	it("tracks the adjusted exit of a short zoom with a custom entrance duration", () => {
		const region = zoom("a", 2000, 2400);
		const options = { zoomInDurationMs: 1500, zoomOutDurationMs: 300 };
		const exit = buildZoomWhooshRegions([region], 10000, options).find((cue) =>
			cue.id.endsWith(":out"),
		)!;
		expect(exit.startMs).toBeGreaterThan(region.endMs);
		expect(computeRegionStrength(region, exit.startMs + 1, options)).toBeLessThan(1);
	});

	it("keeps only the outer whooshes for a connected pan at equal depth", () => {
		const regions = [zoom("a"), zoom("b", 5500, 8500)];
		const cues = buildZoomWhooshRegions(regions, 10000, { connectZooms: true });
		expect(cues.map((cue) => cue.id)).toEqual(["zoom-whoosh:a:in", "zoom-whoosh:b:out"]);
	});

	it.each([3, 1] as const)("adds one handoff cue for a connected change to depth %i", (depth) => {
		const regions = [zoom("a"), zoom("b", 5500, 8500, depth)];
		const cues = buildZoomWhooshRegions(regions, 10000, { connectZooms: true });
		expect(cues).toHaveLength(3);
		expect(cues[1].id).toBe("zoom-whoosh:a:handoff");
		expect(
			findDominantRegion(regions, cues[1].startMs + 1, { connectZooms: true }).region?.id,
		).toBe("b");
		expect(cues[1].audioPath).toBe(depth > 2 ? cues[0].audioPath : cues[2].audioPath);
	});

	it("gives disconnected zooms their individual entrance and exit sounds", () => {
		const regions = [zoom("a"), zoom("b", 5500, 8500)];
		expect(buildZoomWhooshRegions(regions, 10000, { connectZooms: false })).toHaveLength(4);
		expect(
			buildZoomWhooshRegions([zoom("a"), zoom("b", 7000, 9500)], 11000, {
				connectZooms: true,
			}),
		).toHaveLength(4);
	});

	it("recomputes cues after moving or removing zooms without mutating them", () => {
		const regions = [zoom("a")];
		const before = structuredClone(regions);
		const original = buildZoomWhooshRegions(regions, 10000);
		const moved = buildZoomWhooshRegions([zoom("a", 3000, 6000)], 10000);
		expect(moved.map((cue) => cue.startMs)).toEqual(original.map((cue) => cue.startMs + 1000));
		expect(buildZoomWhooshRegions([], 10000)).toEqual([]);
		expect(regions).toEqual(before);
	});

	it("clamps effects to the video timeline, including a zoom starting at zero", () => {
		const cues = buildZoomWhooshRegions([zoom("a", 0, 9500)], 10000);
		expect(cues[0].startMs).toBe(0);
		expect(cues[1].endMs).toBe(10000);
		expect(buildZoomWhooshRegions([zoom("a")], 0)).toEqual([]);
		expect(buildZoomWhooshRegions([zoom("a", 11000, 15000)], 10000)).toEqual([]);
	});

	it.each([
		"https://example.test/index.html",
		"file:///Applications/Recordly/dist/index.html",
	])("resolves assets beside the renderer in %s", (location) => {
		vi.stubGlobal("window", { location: { href: location } });
		const [cue] = buildZoomWhooshRegions([zoom("a")], 10000);
		const url = new URL(cue.audioPath);
		expect(url.protocol).toBe(new URL(location).protocol);
		if (url.protocol === "file:")
			expect(url.pathname).toContain("/Applications/Recordly/dist/");
	});
});

describe("zoom whoosh volume", () => {
	it("applies the chosen gain to both entrance and exit overlays", () => {
		const cues = buildZoomWhooshRegions([zoom("a")], 10000, { zoomWhooshVolume: 0.72 });
		expect(cues).toHaveLength(2);
		expect(cues.every((cue) => cue.volume === 0.72)).toBe(true);
	});
	it("omits sound effects entirely at zero volume", () => {
		expect(buildZoomWhooshRegions([zoom("a")], 10000, { zoomWhooshVolume: 0 })).toEqual([]);
	});
	it.each([
		[-1, 0],
		[2, 1],
		[Number.NaN, 0.35],
		[Number.POSITIVE_INFINITY, 0.35],
	])("handles volume %s safely", (volume, expected) => {
		const cues = buildZoomWhooshRegions([zoom("a")], 10000, { zoomWhooshVolume: volume });
		if (expected === 0) expect(cues).toEqual([]);
		else expect(cues.every((cue) => cue.volume === expected)).toBe(true);
	});
});

describe("sound choices for direction and zoom size", () => {
	const settings = {
		...DEFAULT_ZOOM_SOUND_EFFECTS,
		smallZoomIn: "better",
		smallZoomOut: "generic-air",
		largeZoomIn: "engine-dry",
		largeZoomOut: "tonal-bass",
	} as const;
	it("uses four independent assignments for small and large zoom entrances and exits", () => {
		const cues = buildZoomWhooshRegions(
			[zoom("small", 2000, 5000, 3), zoom("large", 8000, 11000, 4)],
			15000,
			{ zoomSoundEffects: settings },
		);
		expect(cues.map((cue) => cue.audioPath)).toEqual([
			resolveZoomSoundUrl("better"),
			resolveZoomSoundUrl("generic-air"),
			resolveZoomSoundUrl("engine-dry"),
			resolveZoomSoundUrl("tonal-bass"),
		]);
		expect(cues[0].endMs - cues[0].startMs).toBeCloseTo(576.770833, 4);
	});
	it("uses the chosen threshold and preserves independent No sound choices", () => {
		const cues = buildZoomWhooshRegions([zoom("a", 2000, 5000, 3)], 10000, {
			zoomSoundEffects: { ...settings, largeZoomThreshold: 1.8, largeZoomOut: "none" },
		});
		expect(cues).toHaveLength(1);
		expect(cues[0].audioPath).toBe(resolveZoomSoundUrl("engine-dry"));
	});
	it("classifies connected transitions by the size of the scale change, not the destination scale", () => {
		const regions = [
			zoom("a", 2000, 5000, 3),
			zoom("b", 5500, 8500, 4),
			zoom("c", 9000, 12000, 6),
			zoom("d", 12500, 15500, 1),
		];
		const cues = buildZoomWhooshRegions(regions, 18000, {
			connectZooms: true,
			zoomSoundEffects: settings,
		});
		const handoffs = cues.filter((cue) => cue.id.endsWith(":handoff"));
		expect(handoffs.map((cue) => cue.audioPath)).toEqual([
			resolveZoomSoundUrl("better"),
			resolveZoomSoundUrl("engine-dry"),
			resolveZoomSoundUrl("tonal-bass"),
		]);
	});
});
