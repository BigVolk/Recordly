import { applySoundEventOverrides } from "./soundEvents";
import {
	type AudioRegion,
	type ClipRegion,
	type CursorTelemetryPoint,
	DEFAULT_MOUSE_CLICK_VOLUME,
	getClipSourceEndMs,
	getClipSourceStartMs,
} from "../types";
import { getMouseClickSoundAsset } from "./mouseClickSound";
import {
	type ZoomSoundEffects,
	DEFAULT_ZOOM_SOUND_EFFECTS,
	normalizeZoomSoundEffects,
} from "./zoomSoundSettings";

const clickTypes = new Set(["click", "double-click", "right-click", "middle-click"]);

/** Project recorded button-down events into every retained instance of a source clip. */
export function buildMouseClickRegions(
	telemetry: CursorTelemetryPoint[],
	clips: ClipRegion[],
	timelineDurationMs: number,
	configuredVolume = DEFAULT_MOUSE_CLICK_VOLUME,
	soundSettings: ZoomSoundEffects = DEFAULT_ZOOM_SOUND_EFFECTS,
): AudioRegion[] {
	if (!Number.isFinite(timelineDurationMs) || timelineDurationMs <= 0) return [];
	const volume = Number.isFinite(configuredVolume)
		? Math.max(0, Math.min(1, configuredVolume))
		: DEFAULT_MOUSE_CLICK_VOLUME;
	if (volume === 0) return [];
	const settings = normalizeZoomSoundEffects(soundSettings);
	const sound = getMouseClickSoundAsset(settings);
	if (!sound) return [];
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
				endMs: Math.min(startMs + sound.durationMs, clip.endMs, timelineDurationMs),
				audioPath: sound.path,
				volume,
			});
		}
	}
	return applySoundEventOverrides(regions, settings, timelineDurationMs).sort(
		(a, b) => a.startMs - b.startMs,
	);
}
