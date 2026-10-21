import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("separates categories and reveals timing controls only in Advanced", async ({ page }) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Sound Effects", exact: true }).click();
	await expect(page.getByRole("slider", { name: "Whoosh volume", exact: true })).toBeVisible();
	await expect(
		page.getByRole("slider", { name: "Large zoom starts at", exact: true }),
	).toHaveCount(0);
	await expect(page.getByRole("spinbutton", { name: "Small zoom in delay value" })).toHaveCount(
		0,
	);
	await page.getByRole("switch", { name: "Advanced settings", exact: true }).press("Space");
	await expect(
		page.getByRole("slider", { name: "Large zoom starts at", exact: true }),
	).toBeVisible();
	await page.getByRole("tab", { name: "Mouse Clicks", exact: true }).click();
	await expect(
		page.getByRole("slider", { name: "Mouse click volume", exact: true }),
	).toBeVisible();
	await expect(page.getByRole("slider", { name: "Whoosh volume", exact: true })).toHaveCount(0);
	await page.getByRole("tab", { name: "Scrolling", exact: true }).click();
	await expect(page.getByRole("spinbutton", { name: "Scroll delay value" })).toBeVisible();
	await page.getByRole("switch", { name: "Advanced settings", exact: true }).press("Space");
	await expect(page.getByRole("spinbutton", { name: "Scroll delay value" })).toHaveCount(0);
});
