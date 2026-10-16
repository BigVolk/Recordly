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
	const events = telemetry.filter(
		(point) =>
			(point.interactionType === "scroll-up" || point.interactionType === "scroll-down") &&
			Number.isFinite(point.timeMs) &&
			point.timeMs >= 0,
	);
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
		let lastSoundAt = -Infinity;
		for (const [index, event] of events.entries()) {
			if (event.timeMs < sourceStart || event.timeMs >= sourceEnd) continue;
			const eventAt = clip.startMs + (event.timeMs - sourceStart) / speed;
			// A trackpad produces many wheel packets per gesture. Keep the first packet
			// exactly aligned while avoiding a loud stack of overlapping samples.
			if (eventAt - lastSoundAt < 45) continue;
			const size =
				(event.scrollAmount ?? 1) >= settings.scrollLargeThreshold ? "large" : "small";
			const direction = event.interactionType === "scroll-up" ? "Up" : "Down";
			const slot = `${size}Scroll${direction}` as ScrollSoundSlot;
			const sound = getScrollSoundAsset(settings, slot);
			if (!sound) continue;
			lastSoundAt = eventAt;
			const requestedStart = eventAt + settings.scrollDelaysMs[slot];
			const startMs = Math.max(0, requestedStart);
			const endMs = Math.min(
				clip.endMs,
				timelineDurationMs,
				requestedStart + sound.durationMs,
			);
			if (startMs >= endMs) continue;
			regions.push({
				id: `scroll:${clip.id}:${index}`,
				startMs,
				endMs,
				...(requestedStart < 0 ? { sourceOffsetMs: -requestedStart } : {}),
				audioPath: sound.path,
				volume: settings.scrollVolume,
			});
		}
	}
	return regions.sort((a, b) => a.startMs - b.startMs);
}
