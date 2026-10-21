import { applySoundEventOverrides } from "./soundEvents";
import scrollUrl from "@/assets/sounds/scroll.wav?url";
import {
	getClipSourceEndMs,
	getClipSourceStartMs,
	type AudioRegion,
	type ClipRegion,
	type CursorTelemetryPoint,
} from "../types";
import {
	normalizeZoomSoundEffects,
	type ScrollSoundSlot,
	type ZoomSoundEffects,
} from "./zoomSoundSettings";

export function getScrollSoundAsset(settings: ZoomSoundEffects, slot: ScrollSoundSlot) {
	const id = settings.scrollSounds[slot];
	if (id === "none") return undefined;
	if (id === "default-scroll") {
		const path =
			typeof window === "undefined"
				? scrollUrl
				: new URL(
						scrollUrl.startsWith("/") ? `.${scrollUrl}` : scrollUrl,
						window.location.href,
					).href;
		return { path, durationMs: 85 };
	}
	const sound = settings.customSounds.find(
		(candidate) => candidate.id === id && candidate.kind === "scroll",
	);
	return sound ? { path: sound.path, durationMs: sound.durationMs } : undefined;
}

/** Start each recorded scroll sound at the matching source event, then project through clip edits. */
export function buildScrollSoundRegions(
	telemetry: CursorTelemetryPoint[],
	clips: ClipRegion[],
	timelineDurationMs: number,
	rawSettings: ZoomSoundEffects,
): AudioRegion[] {
	if (!Number.isFinite(timelineDurationMs) || timelineDurationMs <= 0) return [];
	const settings = normalizeZoomSoundEffects(rawSettings);
	if (settings.scrollVolume === 0) return [];
	const events = telemetry
		.filter(
			(point) =>
				(point.interactionType === "scroll-up" ||
					point.interactionType === "scroll-down") &&
				Number.isFinite(point.timeMs) &&
				point.timeMs >= 0,
		)
		.sort((a, b) => a.timeMs - b.timeMs);
	const sequence = clips.length
		? clips
		: [{ id: "source", startMs: 0, endMs: timelineDurationMs, speed: 1 }];
	const regions: AudioRegion[] = [];
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
		const slot: ScrollSoundSlot = "smallScrollUp";
		const sound = getScrollSoundAsset(settings, slot);
		if (!sound) continue;
		const gestures: { first: number; last: number; index: number }[] = [];
		for (const [index, event] of events.entries()) {
			const previous = gestures[gestures.length - 1];
			if (previous && event.timeMs - previous.last <= 180) previous.last = event.timeMs;
			else gestures.push({ first: event.timeMs, last: event.timeMs, index });
		}
		for (const gesture of gestures) {
			const from = Math.max(gesture.first, sourceStart);
			const to = Math.min(gesture.last + sound.durationMs, sourceEnd);
			if (to <= from) continue;
			const requestedStart =
				clip.startMs + (from - sourceStart) / speed + settings.scrollDelaysMs[slot];
			const startMs = Math.max(0, requestedStart);
			const endMs = Math.min(
				clip.endMs,
				timelineDurationMs,
				requestedStart + (to - from) / speed,
			);
			if (startMs >= endMs) continue;
			regions.push({
				id: `scroll:${clip.id}:${gesture.index}`,
				startMs,
				endMs,
				...(requestedStart < 0 ? { sourceOffsetMs: -requestedStart } : {}),
				audioPath: sound.path,
				volume: settings.scrollVolume,
			});
		}
	}
	return applySoundEventOverrides(regions, settings, timelineDurationMs).sort(
		(a, b) => a.startMs - b.startMs,
	);
}
