import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("opens recorded clicks and scrolls at the end of a recording without a render loop", async ({
	page,
}) => {
	await installDesktopBridge(page);
	await page.addInitScript(() => {
		window.electronAPI.getCursorTelemetry = async () => ({
			success: true,
			samples: [
				{ timeMs: 5900, cx: 0.5, cy: 0.5, interactionType: "click" },
				{ timeMs: 5960, cx: 0.5, cy: 0.5, interactionType: "scroll-up", scrollAmount: 1 },
			],
		});
	});
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/?windowType=editor");
	await page.getByRole("button", { name: "Clip · 0.0s – 6.0s", exact: true }).waitFor();
	const scroll = page.getByRole("button", { name: /^Scroll ·/ });
	await expect(scroll).toHaveCount(1);
	await expect(scroll).toHaveAttribute("data-start-ms", "5960");
	await expect(scroll).toHaveAttribute("data-end-ms", "6000");
	await scroll.click();
	await expect(page.getByRole("region", { name: "Selected sound effect" })).toBeVisible();
	await page.getByRole("radio", { name: "Sound Effects", exact: true }).click();
	await expect(page.getByRole("slider", { name: "Scroll volume", exact: true })).toBeVisible();
	await expect(scroll).toHaveAttribute("data-start-ms", "5960");
	expect(errors).toEqual([]);
});
