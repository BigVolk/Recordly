import {
	type CustomSoundEffect,
	type LocalSoundId,
	normalizeCustomSoundEffects,
} from "./customSoundEffects";

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
export type ZoomSoundChoice = ZoomSoundId | LocalSoundId | "none";
export type MouseClickSoundChoice = "default-click" | LocalSoundId | "none";
export type ScrollSoundChoice = "default-scroll" | LocalSoundId | "none";
export type ScrollSoundSlot =
	| "smallScrollUp"
	| "smallScrollDown"
	| "largeScrollUp"
	| "largeScrollDown";
export type ZoomSoundSize = "small" | "large";
export type ZoomSoundSlot = "smallZoomIn" | "smallZoomOut" | "largeZoomIn" | "largeZoomOut";
export const MAX_ZOOM_SOUND_DELAY_MS = 2000;
export type SoundEventOverride = {
	soundId?: string;
	volume?: number;
	delayMs?: number;
	deleted?: boolean;
	trackIndex?: number;
	durationMs?: number;
};
export interface ZoomSoundEffects {
	events: Record<string, SoundEventOverride>;
	customSounds: CustomSoundEffect[];
	mouseClickSound: MouseClickSoundChoice;
	scrollSounds: Record<ScrollSoundSlot, ScrollSoundChoice>;
	scrollDelaysMs: Record<ScrollSoundSlot, number>;
	scrollLargeThreshold: number;
	scrollVolume: number;
	smallZoomIn: ZoomSoundChoice;
	smallZoomOut: ZoomSoundChoice;
	largeZoomIn: ZoomSoundChoice;
	largeZoomOut: ZoomSoundChoice;
	largeZoomThreshold: number;
	delaysMs: Record<ZoomSoundSlot, number>;
}

export const DEFAULT_ZOOM_SOUND_EFFECTS: ZoomSoundEffects = {
	events: {},
	customSounds: [],
	mouseClickSound: "default-click",
	scrollSounds: {
		smallScrollUp: "default-scroll",
		smallScrollDown: "default-scroll",
		largeScrollUp: "default-scroll",
		largeScrollDown: "default-scroll",
	},
	scrollDelaysMs: { smallScrollUp: 0, smallScrollDown: 0, largeScrollUp: 0, largeScrollDown: 0 },
	scrollLargeThreshold: 3,
	scrollVolume: 0.3,
	smallZoomIn: "dry-short-in",
	smallZoomOut: "dry-short-out",
	largeZoomIn: "dry-short-in",
	largeZoomOut: "dry-short-out",
	largeZoomThreshold: 2,
	delaysMs: { smallZoomIn: 0, smallZoomOut: 0, largeZoomIn: 0, largeZoomOut: 0 },
};

export function normalizeZoomSoundEffects(candidate: unknown): ZoomSoundEffects {
	const raw =
		candidate && typeof candidate === "object" ? (candidate as Partial<ZoomSoundEffects>) : {};
	const customSounds = normalizeCustomSoundEffects(raw.customSounds);
	function choice(value: unknown, fallback: ZoomSoundChoice): ZoomSoundChoice {
		return value === "none" ||
			ZOOM_SOUND_LIBRARY.some((sound) => sound.id === value) ||
			customSounds.some((sound) => sound.id === value && sound.kind === "whoosh")
			? (value as ZoomSoundChoice)
			: fallback;
	}
	const rawDelays = raw.delaysMs && typeof raw.delaysMs === "object" ? raw.delaysMs : {};
	const scrollSlots: ScrollSoundSlot[] = [
		"smallScrollUp",
		"smallScrollDown",
		"largeScrollUp",
		"largeScrollDown",
	];
	const scrollSounds = Object.fromEntries(
		scrollSlots.map((slot) => {
			const value = raw.scrollSounds?.[slot];
			return [
				slot,
				value === "none" ||
				value === "default-scroll" ||
				customSounds.some((sound) => sound.kind === "scroll" && sound.id === value)
					? value
					: "default-scroll",
			];
		}),
	) as Record<ScrollSoundSlot, ScrollSoundChoice>;
	const scrollDelaysMs = Object.fromEntries(
		scrollSlots.map((slot) => {
			const value = raw.scrollDelaysMs?.[slot];
			return [
				slot,
				typeof value === "number" && Number.isFinite(value)
					? Math.max(-MAX_ZOOM_SOUND_DELAY_MS, Math.min(MAX_ZOOM_SOUND_DELAY_MS, value))
					: 0,
			];
		}),
	) as Record<ScrollSoundSlot, number>;
	function delay(slot: ZoomSoundSlot): number {
		const value = (rawDelays as Partial<Record<ZoomSoundSlot, unknown>>)[slot];
		return typeof value === "number" && Number.isFinite(value)
			? Math.max(-MAX_ZOOM_SOUND_DELAY_MS, Math.min(MAX_ZOOM_SOUND_DELAY_MS, value))
			: 0;
	}
	return {
		events: Object.fromEntries(
			Object.entries(raw.events ?? {})
				.slice(0, 50000)
				.filter(
					([id, value]) =>
						/^(zoom-whoosh|mouse-click|scroll):/.test(id) &&
						value &&
						typeof value === "object",
				)
				.map(([id, value]) => [
					id,
					{
						...(typeof value.soundId === "string" ? { soundId: value.soundId } : {}),
						...(typeof value.volume === "number" && Number.isFinite(value.volume)
							? { volume: Math.max(0, Math.min(1, value.volume)) }
							: {}),
						...(typeof value.delayMs === "number" && Number.isFinite(value.delayMs)
							? { delayMs: Math.max(-60000, Math.min(60000, value.delayMs)) }
							: {}),
						...(typeof value.durationMs === "number" &&
						Number.isFinite(value.durationMs)
							? { durationMs: Math.max(1, value.durationMs) }
							: {}),
						...(value.deleted === true ? { deleted: true } : {}),
						...(typeof value.trackIndex === "number" &&
						Number.isFinite(value.trackIndex)
							? { trackIndex: Math.max(0, Math.floor(value.trackIndex)) }
							: {}),
					},
				]),
		),
		customSounds,
		scrollSounds,
		scrollDelaysMs,
		scrollLargeThreshold:
			typeof raw.scrollLargeThreshold === "number" &&
			Number.isFinite(raw.scrollLargeThreshold)
				? Math.max(1, Math.min(20, raw.scrollLargeThreshold))
				: 3,
		scrollVolume:
			typeof raw.scrollVolume === "number" && Number.isFinite(raw.scrollVolume)
				? Math.max(0, Math.min(1, raw.scrollVolume))
				: 0.3,
		mouseClickSound:
			raw.mouseClickSound === "none" ||
			raw.mouseClickSound === "default-click" ||
			customSounds.some((sound) => sound.id === raw.mouseClickSound && sound.kind === "click")
				? (raw.mouseClickSound as MouseClickSoundChoice)
				: "default-click",
		smallZoomIn: choice(raw.smallZoomIn, DEFAULT_ZOOM_SOUND_EFFECTS.smallZoomIn),
		smallZoomOut: choice(raw.smallZoomOut, DEFAULT_ZOOM_SOUND_EFFECTS.smallZoomOut),
		largeZoomIn: choice(raw.largeZoomIn, DEFAULT_ZOOM_SOUND_EFFECTS.largeZoomIn),
		largeZoomOut: choice(raw.largeZoomOut, DEFAULT_ZOOM_SOUND_EFFECTS.largeZoomOut),
		delaysMs: {
			smallZoomIn: delay("smallZoomIn"),
			smallZoomOut: delay("smallZoomOut"),
			largeZoomIn: delay("largeZoomIn"),
			largeZoomOut: delay("largeZoomOut"),
		},
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
	return settings[getZoomSoundSlot(direction, size)];
}

export function getZoomSoundSlot(direction: "in" | "out", size: ZoomSoundSize): ZoomSoundSlot {
	if (size === "large") return direction === "in" ? "largeZoomIn" : "largeZoomOut";
	return direction === "in" ? "smallZoomIn" : "smallZoomOut";
}
