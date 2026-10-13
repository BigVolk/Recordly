import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("whoosh volume is shared by Zoom and Motion settings and survives reopening", async ({
	page,
}) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: /^Add Zoom/ }).click();
	await page.locator('[data-variant="zoom"]').click();
	const slider = page.getByRole("slider", { name: "Whoosh volume" });
	await expect(slider).toHaveValue("0.35");
	await slider.focus();
	await page.keyboard.press("Home");
	await expect(slider).toHaveValue("0");
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Motion", exact: true }).click();
	await expect(slider).toHaveValue("0");
	await slider.focus();
	await page.keyboard.press("End");
	await page.keyboard.press("ArrowLeft");
	await expect(slider).toHaveValue("0.99");
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					JSON.parse(localStorage.getItem("recordly.editor.preferences") || "{}")
						.zoomWhooshVolume,
			),
		)
		.toBe(0.99);
	await page.reload();
	await page.getByRole("button", { name: /^Add Zoom/ }).click();
	await page.locator('[data-variant="zoom"]').click();
	await expect(slider).toHaveValue("0.99");
	await page.screenshot({ path: "test-results/whoosh-volume.png", animations: "disabled" });
});
