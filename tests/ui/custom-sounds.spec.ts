import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("imports custom whoosh and click choices and saves them without Apply", async ({ page }) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.evaluate(() => {
		const sounds = [
			{
				id: "local:11111111-1111-4111-8111-111111111111",
				name: "Imported air",
				kind: "whoosh" as const,
				path: "/tmp/imported-air.wav",
				durationMs: 300,
			},
			{
				id: "local:22222222-2222-4222-8222-222222222222",
				name: "Imported tap",
				kind: "click" as const,
				path: "/tmp/imported-tap.wav",
				durationMs: 100,
			},
		];
		Object.assign(window.electronAPI, {
			getSoundEffectLibrary: async () => ({ success: true, sounds }),
			importSoundEffects: async (kind: "whoosh" | "click") => ({
				success: true,
				sounds: sounds.filter((sound) => sound.kind === kind),
				errors: [],
			}),
		});
	});
	await page.getByRole("radio", { name: "Sound Effects", exact: true }).click();
	await page.getByRole("button", { name: "Add whoosh files…" }).click();
	await page.getByRole("button", { name: /Small zoom in sound$/ }).click();
	await page
		.getByRole("listbox", { name: "Small zoom in sound" })
		.getByRole("option", { name: "Imported air" })
		.click();
	await page.getByRole("button", { name: "Add mouse click files…" }).click();
	await expect(page.locator('button[aria-label="Mouse click sound"]')).toContainText(
		"Imported tap",
	);
	const whooshVolume = page.getByRole("slider", { name: "Whoosh volume", exact: true });
	const clickVolume = page.getByRole("slider", { name: "Mouse click volume", exact: true });
	await whooshVolume.focus();
	await page.keyboard.press("End");
	await clickVolume.focus();
	await page.keyboard.press("Home");
	for (let i = 0; i < 47; i++) await page.keyboard.press("ArrowRight");
	const preference = () =>
		page.evaluate(() =>
			JSON.parse(localStorage.getItem("recordly.editor.preferences") || "{}"),
		);
	await expect.poll(preference).toMatchObject({
		zoomWhooshVolume: 1,
		mouseClickVolume: 0.47,
		zoomSoundEffects: {
			smallZoomIn: "local:11111111-1111-4111-8111-111111111111",
			mouseClickSound: "local:22222222-2222-4222-8222-222222222222",
			customSounds: expect.arrayContaining([
				expect.objectContaining({ name: "Imported air" }),
				expect.objectContaining({ name: "Imported tap" }),
			]),
		},
	});
	await expect(page.getByRole("button", { name: "Apply changes" })).toHaveCount(0);
	await page.reload();
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Sound Effects", exact: true }).click();
	await expect(page.getByRole("button", { name: /Small zoom in sound$/ })).toContainText(
		"Imported air",
	);
	await expect(page.locator('button[aria-label="Mouse click sound"]')).toContainText(
		"Imported tap",
	);
	await expect(whooshVolume).toHaveValue("1");
	await expect(clickVolume).toHaveValue("0.47");
});
