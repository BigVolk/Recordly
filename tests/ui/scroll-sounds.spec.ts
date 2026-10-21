import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("scroll sound choices and delays survive reload", async ({ page }) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Sound Effects", exact: true }).click();
	await page.getByRole("tab", { name: "Scrolling", exact: true }).click();
	await page.getByRole("switch", { name: "Advanced settings", exact: true }).press("Space");
	await page.getByRole("button", { name: /Scroll sound$/ }).click();
	await page
		.getByRole("listbox", { name: "Scroll sound" })
		.getByRole("option", { name: "No sound" })
		.click();
	await page.getByRole("spinbutton", { name: "Scroll delay value" }).fill("-175");
	await expect(page.getByRole("spinbutton", { name: "Scroll delay value" })).toHaveValue("-175");
	await page.reload();
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Sound Effects", exact: true }).click();
	await page.getByRole("tab", { name: "Scrolling", exact: true }).click();
	await page.getByRole("switch", { name: "Advanced settings", exact: true }).press("Space");
	await expect(page.getByRole("button", { name: /Scroll sound$/ })).toContainText("No sound");
	await expect(page.getByRole("spinbutton", { name: "Scroll delay value" })).toHaveValue("-175");
});
