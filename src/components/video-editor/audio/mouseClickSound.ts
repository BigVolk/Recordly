import clickUrl from "@/assets/sounds/mouse-click.wav?url";
import { type ZoomSoundEffects, DEFAULT_ZOOM_SOUND_EFFECTS } from "./zoomSoundSettings";

export const MOUSE_CLICK_DURATION_MS = 100;

export function resolveMouseClickSoundUrl() {
	if (typeof window === "undefined") return clickUrl;
	const relativeUrl = clickUrl.startsWith("/") ? `.${clickUrl}` : clickUrl;
	return new URL(relativeUrl, window.location.href).href;
}

export function getMouseClickSoundAsset(settings: ZoomSoundEffects = DEFAULT_ZOOM_SOUND_EFFECTS) {
	if (settings.mouseClickSound === "none") return undefined;
	if (settings.mouseClickSound === "default-click")
		return { path: resolveMouseClickSoundUrl(), durationMs: MOUSE_CLICK_DURATION_MS };
	const custom = settings.customSounds.find(
		(sound) => sound.id === settings.mouseClickSound && sound.kind === "click",
	);
	return custom ? { path: custom.path, durationMs: custom.durationMs } : undefined;
}
