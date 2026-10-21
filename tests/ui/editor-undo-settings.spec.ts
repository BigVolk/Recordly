import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("undo and redo restore typed delays, dragged whooshes, deletions, and visual settings", async ({
	page,
}) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await page.getByRole("radio", { name: "Sound Effects", exact: true }).click();
	await expect(page.getByRole("tab", { name: "Scrolling", exact: true })).toHaveCount(0);
	await page.getByRole("switch", { name: "Advanced settings", exact: true }).press("Space");
	const delay = page.getByRole("spinbutton", { name: "Small zoom in delay value" });
	await delay.fill("175");
	await page.keyboard.press("Control+z");
	await expect(delay).toHaveValue("0");
	await page.keyboard.press("Control+Shift+z");
	await expect(delay).toHaveValue("175");
	await page.getByRole("button", { name: "Add Zoom (Z)", exact: true }).click();
	const events = page.getByRole("button", { name: /^Whoosh ·/ });
	await expect(events).toHaveCount(2);
	await events.last().click();
	await expect(page.getByRole("switch", { name: "Normalize", exact: true })).toHaveCount(0);
	const before = await events.last().getAttribute("data-start-ms");
	const box = await events.last().boundingBox();
	if (!box) throw new Error("Whoosh was not visible");
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect(events.last()).not.toHaveAttribute("data-start-ms", before!);
	await page.keyboard.press("Control+z");
	await expect(events.last()).toHaveAttribute("data-start-ms", before!);
	await page.getByRole("button", { name: "Delete Audio", exact: true }).click();
	await expect(events).toHaveCount(1);
	await page.keyboard.press("Control+z");
	await expect(events).toHaveCount(2);
	await page.getByRole("radio", { name: "Scene", exact: true }).click();
	const shadow = page.getByRole("slider", { name: "Shadow", exact: true });
	const originalShadow = await shadow.inputValue();
	await shadow.focus();
	await page.keyboard.press("End");
	await expect(shadow).toHaveValue("1");
	await page.keyboard.press("Control+z");
	await expect(shadow).toHaveValue(originalShadow);
});
