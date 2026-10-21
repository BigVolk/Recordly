import type { AudioRegion } from "../types";
import { getZoomSoundAsset } from "./zoomSoundAssets";
import { getMouseClickSoundAsset } from "./mouseClickSound";
import type { ZoomSoundChoice, ZoomSoundEffects, MouseClickSoundChoice } from "./zoomSoundSettings";

export function soundEventCategory(id: string) {
	return id.startsWith("zoom-whoosh:")
		? "whoosh"
		: id.startsWith("mouse-click:")
			? "click"
			: null;
}

export function applySoundEventOverrides(
	regions: AudioRegion[],
	settings: ZoomSoundEffects,
	durationMs: number,
): AudioRegion[] {
	return regions.flatMap((source) => {
		const region = {
			...source,
			trackIndex:
				source.trackIndex ??
				(soundEventCategory(source.id) === "whoosh"
					? 1
					: soundEventCategory(source.id) === "click"
						? 2
						: 3),
		};
		const edit = settings.events[region.id];
		if (!edit) return [region];
		if (edit.deleted || edit.soundId === "none") return [];
		const category = soundEventCategory(region.id);
		const sound = edit.soundId
			? category === "whoosh"
				? getZoomSoundAsset(settings, edit.soundId as ZoomSoundChoice)
				: category === "click"
					? getMouseClickSoundAsset({
							...settings,
							mouseClickSound: edit.soundId as MouseClickSoundChoice,
						})
					: undefined
			: undefined;
		const requestedStart = region.startMs - (region.sourceOffsetMs ?? 0) + (edit.delayMs ?? 0);
		const startMs = Math.max(0, requestedStart);
		const endMs = Math.min(
			durationMs,
			requestedStart +
				(edit.durationMs ??
					sound?.durationMs ??
					region.endMs - region.startMs + (region.sourceOffsetMs ?? 0)),
		);
		if (endMs <= startMs) return [];
		return [
			{
				...region,
				startMs,
				endMs,
				sourceOffsetMs: Math.max(0, -requestedStart),
				audioPath: sound?.path ?? region.audioPath,
				volume: edit.volume ?? region.volume,
				trackIndex: edit.trackIndex ?? region.trackIndex,
			},
		];
	});
}
