import { describe, expect, it } from "vitest";
import type { ClipRegion, CursorTelemetryPoint } from "../types";
import { buildMouseClickRegions } from "./mouseClicks";

const event = (
	timeMs: number,
	interactionType: CursorTelemetryPoint["interactionType"] = "click",
): CursorTelemetryPoint => ({ timeMs, cx: 0.5, cy: 0.5, interactionType });

describe("recorded mouse click sounds", () => {
	it("plays each button-down once, including the second click of a double click", () => {
		const sounds = buildMouseClickRegions(
			[
				event(100),
				event(100),
				event(150, "move"),
				event(160, "mouseup"),
				event(200, "double-click"),
				event(300, "right-click"),
				event(400, "middle-click"),
				event(-1),
				event(Number.NaN),
				event(1000),
			],
			[],
			1000,
			0.6,
		);
		expect(sounds.map(({ startMs }) => startMs)).toEqual([100, 200, 300, 400]);
		expect(sounds.every(({ volume }) => volume === 0.6)).toBe(true);
	});
	it("omits removed clicks and projects timing through reordered, sped-up and repeated clips", () => {
		const clips: ClipRegion[] = [
			{ id: "later", startMs: 0, endMs: 1000, sourceStartMs: 4000, speed: 2 },
			{ id: "early", startMs: 1000, endMs: 2000, sourceStartMs: 500, speed: 1 },
			{ id: "repeat", startMs: 2000, endMs: 3000, sourceStartMs: 500, speed: 1 },
		];
		const sounds = buildMouseClickRegions(
			[event(750), event(2000), event(4500), event(6000)],
			clips,
			3000,
		);
		expect(sounds.map(({ startMs }) => startMs)).toEqual([250, 1250, 2250]);
		expect(new Set(sounds.map(({ id }) => id)).size).toBe(3);
	});
	it("cuts sound tails at clip boundaries and excludes the next clip's source boundary", () => {
		const clips = [
			{ id: "a", startMs: 0, endMs: 1000, speed: 1 },
			{ id: "b", startMs: 1000, endMs: 2000, speed: 1 },
		];
		const sounds = buildMouseClickRegions([event(950), event(1000), event(1990)], clips, 2000);
		expect(sounds.map(({ startMs, endMs }) => [startMs, endMs])).toEqual([
			[950, 1000],
			[1000, 1100],
			[1990, 2000],
		]);
	});
	it("supports independent mute and validates volume and duration", () => {
		expect(buildMouseClickRegions([event(100)], [], 1000, 0)).toEqual([]);
		expect(buildMouseClickRegions([event(100)], [], 1000, -1)).toEqual([]);
		expect(buildMouseClickRegions([event(100)], [], 1000, 5)[0].volume).toBe(1);
		expect(buildMouseClickRegions([event(100)], [], 1000, Number.NaN)[0].volume).toBe(0.35);
		expect(buildMouseClickRegions([event(100)], [], Number.NaN)).toEqual([]);
		expect(buildMouseClickRegions([], [], 1000)).toEqual([]);
	});
});
