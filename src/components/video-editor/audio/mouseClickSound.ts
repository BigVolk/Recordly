import clickUrl from "@/assets/sounds/mouse-click.wav?url";

export const MOUSE_CLICK_DURATION_MS = 100;

export function resolveMouseClickSoundUrl() {
	if (typeof window === "undefined") return clickUrl;
	const relativeUrl = clickUrl.startsWith("/") ? `.${clickUrl}` : clickUrl;
	return new URL(relativeUrl, window.location.href).href;
}
