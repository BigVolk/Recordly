import {
	type AudioRegion,
	type ClipRegion,
	type CursorTelemetryPoint,
	DEFAULT_MOUSE_CLICK_VOLUME,
	getClipSourceEndMs,
	getClipSourceStartMs,
} from "../types";
import { MOUSE_CLICK_DURATION_MS, resolveMouseClickSoundUrl } from "./mouseClickSound";

const clickTypes = new Set(["click", "double-click", "right-click", "middle-click"]);

/** Project recorded button-down events into every retained instance of a source clip. */
export function buildMouseClickRegions(
	telemetry: CursorTelemetryPoint[],
	clips: ClipRegion[],
	timelineDurationMs: number,
	configuredVolume = DEFAULT_MOUSE_CLICK_VOLUME,
): AudioRegion[] {
	if (!Number.isFinite(timelineDurationMs) || timelineDurationMs <= 0) return [];
	const volume = Number.isFinite(configuredVolume)
		? Math.max(0, Math.min(1, configuredVolume))
		: DEFAULT_MOUSE_CLICK_VOLUME;
	if (volume === 0) return [];
	const clickTimes = [
		...new Set(
			telemetry
				.filter(
					(point) =>
						clickTypes.has(point.interactionType ?? "") &&
						Number.isFinite(point.timeMs) &&
						point.timeMs >= 0,
				)
				.map((point) => point.timeMs),
		),
	].sort((a, b) => a - b);
	const regions: AudioRegion[] = [];
	const sequence = clips.length
		? clips
		: [{ id: "source", startMs: 0, endMs: timelineDurationMs, speed: 1 }];
	for (const clip of sequence) {
		if (
			!Number.isFinite(clip.startMs) ||
			!Number.isFinite(clip.endMs) ||
			clip.endMs <= clip.startMs
		)
			continue;
		const sourceStart = getClipSourceStartMs(clip);
		const sourceEnd = getClipSourceEndMs(clip);
		const speed = Number.isFinite(clip.speed) && clip.speed > 0 ? clip.speed : 1;
		for (const timeMs of clickTimes) {
			if (timeMs < sourceStart || timeMs >= sourceEnd) continue;
			const startMs = clip.startMs + (timeMs - sourceStart) / speed;
			if (startMs < 0 || startMs >= timelineDurationMs) continue;
			regions.push({
				id: `mouse-click:${clip.id}:${timeMs}`,
				startMs,
				endMs: Math.min(startMs + MOUSE_CLICK_DURATION_MS, clip.endMs, timelineDurationMs),
				audioPath: resolveMouseClickSoundUrl(),
				volume,
			});
		}
	}
	return regions.sort((a, b) => a.startMs - b.startMs);
}
