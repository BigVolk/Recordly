import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("edits and deletes individual whooshes from the timeline", async ({ page }) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Sound Effects", exact: true }).click();
	await page.getByRole("tab", { name: "Scrolling", exact: true }).click();
	await expect(page.getByRole("slider", { name: "Scroll volume", exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: /Scroll sound$/ })).toHaveCount(1);
	await page.getByRole("button", { name: "Add Zoom (Z)", exact: true }).click();
	const events = page.getByRole("button", { name: /^Whoosh ·/ });
	await expect(events).toHaveCount(2);
	await events.first().click();
	await expect(page.getByRole("region", { name: "Selected sound effect" })).toBeVisible();
	await page.getByRole("switch", { name: "Advanced settings", exact: true }).press("Space");
	await page.getByRole("spinbutton", { name: "Event delay value" }).fill("125");
	await page.getByRole("button", { name: /Event sound$/ }).click();
	await page.getByRole("option", { name: "Better whoosh", exact: true }).click();
	await page.getByRole("slider", { name: "Volume", exact: true }).focus();
	await page.keyboard.press("Home");
	await page.keyboard.press("ArrowRight");
	await page.getByRole("button", { name: "Delete Audio", exact: true }).click();
	await expect(events).toHaveCount(1);
});
