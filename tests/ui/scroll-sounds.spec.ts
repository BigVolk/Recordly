import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("scroll sound choices and delays survive reload", async ({ page }) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sound Effects", exact: true }).click();
	await page.getByRole("button", { name: /Small scroll up sound$/ }).click();
	await page
		.getByRole("listbox", { name: "Small scroll up sound" })
		.getByRole("option", { name: "No sound" })
		.click();
	await page.getByRole("spinbutton", { name: "Large scroll down delay value" }).fill("-175");
	await expect(
		page.getByRole("spinbutton", { name: "Large scroll down delay value" }),
	).toHaveValue("-175");
	await page.reload();
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sound Effects", exact: true }).click();
	await expect(page.getByRole("button", { name: /Small scroll up sound$/ })).toContainText(
		"No sound",
	);
	await expect(
		page.getByRole("spinbutton", { name: "Large scroll down delay value" }),
	).toHaveValue("-175");
});
