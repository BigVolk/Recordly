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
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sounds", exact: true }).click();
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
	const preference = () =>
		page.evaluate(
			() =>
				JSON.parse(localStorage.getItem("recordly.editor.preferences") || "{}")
					.zoomSoundEffects,
		);
	await expect
		.poll(preference)
		.toMatchObject({
			smallZoomIn: "local:11111111-1111-4111-8111-111111111111",
			mouseClickSound: "local:22222222-2222-4222-8222-222222222222",
		});
	await expect(page.getByRole("button", { name: "Apply changes" })).toHaveCount(0);
	await page.reload();
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sounds", exact: true }).click();
	await expect(page.getByRole("button", { name: /Small zoom in sound$/ })).toContainText(
		"Imported air",
	);
	await expect(page.locator('button[aria-label="Mouse click sound"]')).toContainText(
		"Imported tap",
	);
});
