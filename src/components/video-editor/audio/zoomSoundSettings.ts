/** Unique sounds supplied in the whooshes folder (one duplicate is omitted). */
export const ZOOM_SOUND_LIBRARY = [
	{
		id: "dry-short-in",
		label: "Short & dry 1",
		fileName: "ES_Swooshes, Whoosh, Short, Dry 01 - Epidemic Sound - 0957-1934.wav",
		durationMs: 977.0,
	},
	{
		id: "dry-short-out",
		label: "Short & dry 2",
		fileName: "ES_Swooshes, Whoosh, Short, Dry 01 - Epidemic Sound - 1935-2980.wav",
		durationMs: 1045.0,
	},
	{
		id: "better",
		label: "Better whoosh",
		fileName: "better.flac",
		durationMs: 576.770833,
	},
	{
		id: "generic-air",
		label: "Soft air",
		fileName: "ES_Swooshes, Whoosh, Designed, Generic, Air - Epidemic Sound.wav",
		durationMs: 545.75,
	},
	{
		id: "low-short",
		label: "Low & short",
		fileName: "ES_Swooshes, Whoosh, Low, Short 01 - Epidemic Sound.wav",
		durationMs: 1523.385417,
	},
	{
		id: "mid-low",
		label: "Mid-low whoosh",
		fileName: "ES_Swooshes, Whoosh, Short, Mid Low Freq - Epidemic Sound.wav",
		durationMs: 1432.666667,
	},
	{
		id: "tonal-bass",
		label: "Tonal bass",
		fileName: "ES_Swooshes, Whoosh, Short, Mid Tonal Bass - Epidemic Sound - 0000-0992.wav",
		durationMs: 992.0,
	},
	{
		id: "engine-dry",
		label: "Dry engine",
		fileName: "ES_Swooshes, Whoosh, Short, Engine, Dry - Epidemic Sound.wav",
		durationMs: 1529.84375,
	},
] as const;

export type ZoomSoundId = (typeof ZOOM_SOUND_LIBRARY)[number]["id"];
export type ZoomSoundChoice = ZoomSoundId | "none";
export type ZoomSoundSize = "small" | "large";
export interface ZoomSoundEffects {
	smallZoomIn: ZoomSoundChoice;
	smallZoomOut: ZoomSoundChoice;
	largeZoomIn: ZoomSoundChoice;
	largeZoomOut: ZoomSoundChoice;
	largeZoomThreshold: number;
}

export const DEFAULT_ZOOM_SOUND_EFFECTS: ZoomSoundEffects = {
	smallZoomIn: "dry-short-in",
	smallZoomOut: "dry-short-out",
	largeZoomIn: "dry-short-in",
	largeZoomOut: "dry-short-out",
	largeZoomThreshold: 2,
};

export function normalizeZoomSoundEffects(candidate: unknown): ZoomSoundEffects {
	const raw =
		candidate && typeof candidate === "object" ? (candidate as Partial<ZoomSoundEffects>) : {};
	function choice(value: unknown, fallback: ZoomSoundChoice): ZoomSoundChoice {
		return value === "none" || ZOOM_SOUND_LIBRARY.some((sound) => sound.id === value)
			? (value as ZoomSoundChoice)
			: fallback;
	}
	return {
		smallZoomIn: choice(raw.smallZoomIn, DEFAULT_ZOOM_SOUND_EFFECTS.smallZoomIn),
		smallZoomOut: choice(raw.smallZoomOut, DEFAULT_ZOOM_SOUND_EFFECTS.smallZoomOut),
		largeZoomIn: choice(raw.largeZoomIn, DEFAULT_ZOOM_SOUND_EFFECTS.largeZoomIn),
		largeZoomOut: choice(raw.largeZoomOut, DEFAULT_ZOOM_SOUND_EFFECTS.largeZoomOut),
		largeZoomThreshold:
			typeof raw.largeZoomThreshold === "number" && Number.isFinite(raw.largeZoomThreshold)
				? Math.max(1.1, Math.min(5, raw.largeZoomThreshold))
				: DEFAULT_ZOOM_SOUND_EFFECTS.largeZoomThreshold,
	};
}

/** Measure the change in magnification, including transitions between connected zooms. */
export function getZoomSoundSize(
	fromScale: number,
	toScale: number,
	threshold: number,
): ZoomSoundSize {
	const factor = Math.max(fromScale, toScale) / Math.min(fromScale, toScale);
	return factor >= threshold ? "large" : "small";
}

export function getZoomSoundChoice(
	settings: ZoomSoundEffects,
	direction: "in" | "out",
	size: ZoomSoundSize,
): ZoomSoundChoice {
	if (size === "large") return direction === "in" ? settings.largeZoomIn : settings.largeZoomOut;
	return direction === "in" ? settings.smallZoomIn : settings.smallZoomOut;
}
