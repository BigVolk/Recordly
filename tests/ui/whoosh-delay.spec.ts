import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("applies and reopens independent early and late whoosh delays", async ({ page }) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sound Effects", exact: true }).click();
	const assignments = [
		["Small zoom in delay", "smallZoomIn", -150],
		["Small zoom out delay", "smallZoomOut", 200],
		["Large zoom in delay", "largeZoomIn", 300],
		["Large zoom out delay", "largeZoomOut", -400],
	] as const;
	for (const [label, , value] of assignments) {
		const slider = page.getByRole("slider", { name: label, exact: true });
		await slider.focus();
		for (let i = 0; i < Math.abs(value / 10); i++)
			await page.keyboard.press(value < 0 ? "ArrowLeft" : "ArrowRight");
		await expect(slider).toHaveValue(String(value));
	}
	const savedDelays = () =>
		page.evaluate(
			() =>
				JSON.parse(localStorage.getItem("recordly.editor.preferences") || "{}")
					.zoomSoundEffects.delaysMs,
		);
	const expected = Object.fromEntries(assignments.map(([, key, value]) => [key, value]));
	await expect.poll(savedDelays).toEqual(expected);
	const typedDelay = page.getByRole("spinbutton", { name: "Small zoom in delay value" });
	await typedDelay.fill("-275");
	await expect.poll(savedDelays).toMatchObject({ smallZoomIn: -275 });
	await page.reload();
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sound Effects", exact: true }).click();
	await expect(typedDelay).toHaveValue("-275");
	for (const [label, , value] of assignments)
		if (label !== "Small zoom in delay")
			await expect(page.getByRole("slider", { name: label, exact: true })).toHaveValue(
				String(value),
			);
});
