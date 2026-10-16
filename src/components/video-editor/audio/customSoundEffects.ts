export type LocalSoundId = `local:${string}`;
export type SoundEffectKind = "whoosh" | "click" | "scroll";
export interface CustomSoundEffect {
	id: LocalSoundId;
	name: string;
	kind: SoundEffectKind;
	path: string;
	durationMs: number;
}
export const MAX_CUSTOM_SOUND_DURATION_MS = 60000;

export function normalizeCustomSoundEffects(raw: unknown): CustomSoundEffect[] {
	if (!Array.isArray(raw)) return [];
	const result: CustomSoundEffect[] = [];
	const ids = new Set<string>();
	for (const entry of raw.slice(0, 1000)) {
		if (
			!entry ||
			typeof entry !== "object" ||
			typeof entry.id !== "string" ||
			!/^local:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
				entry.id,
			) ||
			ids.has(entry.id) ||
			(entry.kind !== "whoosh" && entry.kind !== "click" && entry.kind !== "scroll") ||
			typeof entry.name !== "string" ||
			!entry.name.trim() ||
			typeof entry.path !== "string" ||
			!/^(\/|[A-Za-z]:[\\/]|\\\\)/.test(entry.path) ||
			!Number.isFinite(entry.durationMs) ||
			entry.durationMs <= 0 ||
			entry.durationMs > MAX_CUSTOM_SOUND_DURATION_MS
		)
			continue;
		ids.add(entry.id);
		result.push({
			id: entry.id as LocalSoundId,
			name: entry.name.slice(0, 200),
			kind: entry.kind,
			path: entry.path,
			durationMs: entry.durationMs,
		});
	}
	return result;
}

export function mergeCustomSoundEffects(...catalogs: CustomSoundEffect[][]): CustomSoundEffect[] {
	return [...new Map(catalogs.flat().map((sound) => [sound.id, sound])).values()];
}
