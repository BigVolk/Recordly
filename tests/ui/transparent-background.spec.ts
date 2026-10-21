import { expect, test } from "@playwright/test";
import { TRANSPARENT_WALLPAPER } from "../../src/lib/wallpapers";
import { installDesktopBridge } from "./bridge";

test("selects a clear PNG background, supports undo, and accepts PNG uploads", async ({ page }) => {
	await installDesktopBridge(page);
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	const wallpaper = () =>
		page.evaluate(
			() => JSON.parse(localStorage.getItem("recordly.editor.preferences") || "{}").wallpaper,
		);
	const original = await wallpaper();
	await page.getByRole("row", { name: "Transparent", exact: true }).click();
	await expect.poll(wallpaper).toBe(TRANSPARENT_WALLPAPER);
	await expect(page.getByText("Clear PNG background. MP4 exports remain opaque.")).toBeVisible();
	const alpha = await page.evaluate(async (source) => {
		const image = new Image();
		image.src = source;
		await image.decode();
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 1;
		const ctx = canvas.getContext("2d")!;
		ctx.drawImage(image, 0, 0);
		return ctx.getImageData(0, 0, 1, 1).data[3];
	}, TRANSPARENT_WALLPAPER);
	expect(alpha).toBe(0);
	await page.keyboard.press("Control+z");
	await expect.poll(wallpaper).toBe(original);
	await page
		.locator('input[type="file"][accept*="image/png"]')
		.setInputFiles({
			name: "clear.png",
			mimeType: "image/png",
			buffer: Buffer.from(TRANSPARENT_WALLPAPER.split(",")[1], "base64"),
		});
	await expect.poll(wallpaper).toBe(TRANSPARENT_WALLPAPER);
	await page.reload();
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	await expect(page.getByRole("row", { name: "Transparent", exact: true })).toHaveAttribute(
		"aria-selected",
		"true",
	);
});
