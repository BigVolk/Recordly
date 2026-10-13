import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("decodes bundled sounds for export", async ({ page }) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("radio", { name: "Settings", exact: true }).waitFor();
	const results = await page.evaluate(async () => {
		// @ts-expect-error Vite imports the source module in this browser check.
		const { AudioMediaProcessor } = await import("/src/lib/exporter/audioMediaProcessor.ts");
		// @ts-expect-error Vite imports the source module in this browser check.
		const { resolveZoomSoundUrl } = await import(
			"/src/components/video-editor/audio/zoomSoundAssets.ts"
		);
		const result = [];
		for (const id of ["better", "engine-dry", "tonal-bass"]) {
			const p = new AudioMediaProcessor();
			result.push({
				id,
				bulk: await Promise.race([
					p
						.bulkDecodeFromUrl(resolveZoomSoundUrl(id), 48000)
						.then((b: AudioBuffer | null) => b?.duration),
					new Promise((r) => setTimeout(() => r("timeout"), 5000)),
				]),
				stream: await Promise.race([
					p
						.decodeAudioFromUrl(resolveZoomSoundUrl(id))
						.then((b: AudioBuffer | null) => b?.duration),
					new Promise((r) => setTimeout(() => r("timeout"), 5000)),
				]),
			});
		}
		const processor = new AudioMediaProcessor();
		const silent = await Promise.race([
			processor.decodeAudioFromUrl(`${location.origin}/tests/ui/fixtures/preview.mp4`),
			new Promise((resolve) => setTimeout(() => resolve("timeout"), 5000)),
		]);
		return { sounds: result, silent };
	});
	expect(results.silent).toBeNull();
	for (const result of results.sounds) {
		expect(result.bulk).toBeGreaterThan(0);
		expect(result.stream).toBeGreaterThan(0);
	}
});
