import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("applies and reopens independent early and late whoosh delays", async ({ page }) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sounds", exact: true }).click();
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
	expect(await savedDelays()).toEqual({
		smallZoomIn: 0,
		smallZoomOut: 0,
		largeZoomIn: 0,
		largeZoomOut: 0,
	});
	await page.getByRole("button", { name: "Apply changes", exact: true }).click();
	const expected = Object.fromEntries(assignments.map(([, key, value]) => [key, value]));
	await expect.poll(savedDelays).toEqual(expected);
	await expect(page.getByRole("button", { name: "Apply changes", exact: true })).toBeDisabled();
	await page.reload();
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sounds", exact: true }).click();
	for (const [label, , value] of assignments)
		await expect(page.getByRole("slider", { name: label, exact: true })).toHaveValue(
			String(value),
		);
});
