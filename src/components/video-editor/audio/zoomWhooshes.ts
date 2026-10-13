import type { AudioRegion, ZoomRegion } from "../types";
import { DEFAULT_ZOOM_WHOOSH_VOLUME, ZOOM_DEPTH_SCALES } from "../types";
import {
	findDominantRegion,
	getConnectedRegionPairs,
	getZoomRegionTiming,
} from "../videoPlayback/zoomRegionUtils";

import { getZoomSoundAsset } from "./zoomSoundAssets";
import {
	getZoomSoundChoice,
	getZoomSoundSize,
	getZoomSoundSlot,
	normalizeZoomSoundEffects,
	type ZoomSoundEffects,
} from "./zoomSoundSettings";

type ZoomWhooshOptions = {
	zoomSoundEffects?: Partial<ZoomSoundEffects>;
	zoomWhooshVolume?: number;
	connectZooms?: boolean;
	zoomInDurationMs?: number;
	zoomOutDurationMs?: number;
};

/** Derive overlays without modifying saved/user audio or leaving stale effects after edits. */
export function buildZoomWhooshRegions(
	zoomRegions: ZoomRegion[],
	timelineDurationMs: number,
	options: ZoomWhooshOptions = {},
): AudioRegion[] {
	if (!Number.isFinite(timelineDurationMs) || timelineDurationMs <= 0) return [];
	const configuredVolume = options.zoomWhooshVolume ?? DEFAULT_ZOOM_WHOOSH_VOLUME;
	const volume = Number.isFinite(configuredVolume)
		? Math.max(0, Math.min(1, configuredVolume))
		: DEFAULT_ZOOM_WHOOSH_VOLUME;
	if (volume === 0) return [];
	const settings = normalizeZoomSoundEffects(options.zoomSoundEffects);
	const regions = zoomRegions
		.filter(
			(region) =>
				Number.isFinite(region.startMs) &&
				Number.isFinite(region.endMs) &&
				region.endMs > region.startMs &&
				region.startMs < timelineDurationMs &&
				region.endMs > 0,
		)
		.sort((a, b) => a.startMs - b.startMs);
	const pairs = options.connectZooms ? getConnectedRegionPairs(regions) : [];
	const result: AudioRegion[] = [];

	function add(
		region: ZoomRegion,
		direction: "in" | "out",
		timeMs: number,
		fromScale: number,
		toScale: number,
		suffix: string = direction,
	) {
		const size = getZoomSoundSize(fromScale, toScale, settings.largeZoomThreshold);
		const soundId = getZoomSoundChoice(settings, direction, size);
		if (soundId === "none") return;
		const sound = getZoomSoundAsset(settings, soundId);
		if (!sound) return;
		const requestedStart =
			Math.max(0, timeMs) + settings.delaysMs[getZoomSoundSlot(direction, size)];
		const startMs = Math.max(0, requestedStart);
		const endMs = Math.min(timelineDurationMs, requestedStart + sound.durationMs);
		if (startMs >= endMs) return;
		result.push({
			id: `zoom-whoosh:${region.id}:${suffix}`,
			startMs,
			endMs,
			...(requestedStart < 0 ? { sourceOffsetMs: -requestedStart } : {}),
			audioPath: sound.path,
			volume,
		});
	}

	for (const region of regions) {
		const timing = getZoomRegionTiming(region, options);
		const incoming = pairs.find((pair) => pair.nextRegion.id === region.id);
		const outgoing = pairs.find((pair) => pair.currentRegion.id === region.id);
		if (!incoming) {
			add(region, "in", timing.zoomInStartMs, 1, ZOOM_DEPTH_SCALES[region.depth]);
		}
		if (!outgoing) {
			add(region, "out", timing.zoomOutStartMs, ZOOM_DEPTH_SCALES[region.depth], 1);
		}
		if (outgoing) {
			const scaleChange =
				ZOOM_DEPTH_SCALES[outgoing.nextRegion.depth] - ZOOM_DEPTH_SCALES[region.depth];
			if (
				scaleChange !== 0 &&
				findDominantRegion(regions, outgoing.transitionStart + 1, options).region?.id ===
					outgoing.nextRegion.id
			) {
				add(
					region,
					scaleChange > 0 ? "in" : "out",
					outgoing.transitionStart,
					ZOOM_DEPTH_SCALES[region.depth],
					ZOOM_DEPTH_SCALES[outgoing.nextRegion.depth],
					"handoff",
				);
			}
		}
	}
	return result.sort((a, b) => a.startMs - b.startMs);
}
