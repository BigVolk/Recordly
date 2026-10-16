import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("chooses independent zoom sounds, previews FLAC, and persists assignments", async ({
	page,
}) => {
	await installDesktopBridge(page);
	await page.addInitScript(() => {
		const play = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function () {
			if (this instanceof HTMLAudioElement) {
				(window as unknown as { zoomSoundPreview: HTMLAudioElement }).zoomSoundPreview =
					this;
			}
			return play.call(this);
		};
	});
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sound Effects", exact: true }).click();

	async function choose(label: string, sound: string) {
		await page.getByRole("button", { name: new RegExp(`${label}$`) }).click();
		await page
			.getByRole("listbox", { name: label, exact: true })
			.getByRole("option", { name: sound, exact: true })
			.click();
	}
	await choose("Small zoom in sound", "Better whoosh");
	await choose("Small zoom out sound", "No sound");
	await choose("Large zoom in sound", "Dry engine");
	await choose("Large zoom out sound", "Tonal bass");
	await expect(
		page.getByRole("button", { name: "Preview small zoom out sound", exact: true }),
	).toBeDisabled();
	await page.getByRole("button", { name: "Preview small zoom in sound", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(window as unknown as { zoomSoundPreview?: HTMLAudioElement }).zoomSoundPreview
						?.src,
			),
		)
		.toContain("better.flac");
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(window as unknown as { zoomSoundPreview?: HTMLAudioElement }).zoomSoundPreview
						?.readyState,
			),
		)
		.toBeGreaterThanOrEqual(2);

	const threshold = page.getByRole("slider", { name: "Large zoom starts at", exact: true });
	await threshold.focus();
	await page.keyboard.press("Home");
	for (let i = 0; i < 11; i++) await page.keyboard.press("ArrowRight");
	await expect(threshold).toHaveValue("2.2");
	const volume = page.getByRole("slider", { name: "Whoosh volume" });
	await volume.focus();
	await page.keyboard.press("End");
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					JSON.parse(localStorage.getItem("recordly.editor.preferences") || "{}")
						.zoomWhooshVolume,
			),
		)
		.toBe(1);
	const saved = {
		customSounds: [],
		mouseClickSound: "default-click",
		delaysMs: { smallZoomIn: 0, smallZoomOut: 0, largeZoomIn: 0, largeZoomOut: 0 },
		smallZoomIn: "better",
		smallZoomOut: "none",
		largeZoomIn: "engine-dry",
		largeZoomOut: "tonal-bass",
		largeZoomThreshold: 2.2,
	};
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					JSON.parse(localStorage.getItem("recordly.editor.preferences") || "{}")
						.zoomSoundEffects,
			),
		)
		.toMatchObject(saved);

	await page.reload();
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sound Effects", exact: true }).click();
	await expect(page.getByRole("button", { name: /Small zoom in sound$/ })).toContainText(
		"Better whoosh",
	);
	await expect(page.getByRole("button", { name: /Small zoom out sound$/ })).toContainText(
		"No sound",
	);
	await expect(page.getByRole("button", { name: /Large zoom in sound$/ })).toContainText(
		"Dry engine",
	);
	await expect(page.getByRole("button", { name: /Large zoom out sound$/ })).toContainText(
		"Tonal bass",
	);
	await expect(threshold).toHaveValue("2.2");
	await expect(volume).toHaveValue("1");
	await page.screenshot({ path: "test-results/zoom-sounds.png", animations: "disabled" });

	await page.getByRole("button", { name: "Preview large zoom in sound", exact: true }).click();
	await page.getByRole("row", { name: "Motion", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(window as unknown as { zoomSoundPreview?: HTMLAudioElement }).zoomSoundPreview
						?.paused,
			),
		)
		.toBe(true);
	await page.getByRole("row", { name: "Sound Effects", exact: true }).click();
	await page.getByRole("button", { name: "Reset sounds", exact: true }).click();
	await expect(page.getByRole("button", { name: /Small zoom in sound$/ })).toContainText(
		"Short & dry 1",
	);
	await expect(threshold).toHaveValue("2");
});
