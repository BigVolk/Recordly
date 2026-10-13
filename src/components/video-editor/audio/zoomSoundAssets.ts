import sound2Url from "../../../../whooshes/better.flac?url";
import sound3Url from "../../../../whooshes/ES_Swooshes, Whoosh, Designed, Generic, Air - Epidemic Sound.wav?url";
import sound4Url from "../../../../whooshes/ES_Swooshes, Whoosh, Low, Short 01 - Epidemic Sound.wav?url";
import sound0Url from "../../../../whooshes/ES_Swooshes, Whoosh, Short, Dry 01 - Epidemic Sound - 0957-1934.wav?url";
import sound1Url from "../../../../whooshes/ES_Swooshes, Whoosh, Short, Dry 01 - Epidemic Sound - 1935-2980.wav?url";
import sound7Url from "../../../../whooshes/ES_Swooshes, Whoosh, Short, Engine, Dry - Epidemic Sound.wav?url";
import sound5Url from "../../../../whooshes/ES_Swooshes, Whoosh, Short, Mid Low Freq - Epidemic Sound.wav?url";
import sound6Url from "../../../../whooshes/ES_Swooshes, Whoosh, Short, Mid Tonal Bass - Epidemic Sound - 0000-0992.wav?url";
import type { ZoomSoundId } from "./zoomSoundSettings";

const soundUrls: Record<ZoomSoundId, string> = {
	"dry-short-in": sound0Url,
	"dry-short-out": sound1Url,
	better: sound2Url,
	"generic-air": sound3Url,
	"low-short": sound4Url,
	"mid-low": sound5Url,
	"tonal-bass": sound6Url,
	"engine-dry": sound7Url,
};

export function resolveZoomSoundUrl(soundId: ZoomSoundId) {
	const assetUrl = soundUrls[soundId];
	if (typeof window === "undefined") return assetUrl;
	// Bundled assets live beside index.html in packaged Electron windows.
	const relativeUrl = assetUrl.startsWith("/") ? `.${assetUrl}` : assetUrl;
	return new URL(relativeUrl, window.location.href).href;
}
