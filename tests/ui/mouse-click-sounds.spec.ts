import { expect, test } from "@playwright/test";
import { installDesktopBridge } from "./bridge";

test("click and whoosh sliders apply independently and preview the click asset", async ({
	page,
}) => {
	await installDesktopBridge(page);
	await page.addInitScript(() => {
		const play = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function () {
			if (this instanceof HTMLAudioElement) Object.assign(window, { clickPreview: this });
			return play.call(this);
		};
	});
	await page.goto("/?windowType=editor");
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sounds", exact: true }).click();
	const click = page.getByRole("slider", { name: "Mouse click volume", exact: true });
	const whoosh = page.getByRole("slider", { name: "Whoosh volume", exact: true });
	await click.focus();
	await page.keyboard.press("End");
	await expect(whoosh).toHaveValue("0.35");
	await whoosh.focus();
	await page.keyboard.press("Home");
	await expect(click).toHaveValue("1");
	const preferences = () =>
		page.evaluate(() =>
			JSON.parse(localStorage.getItem("recordly.editor.preferences") || "{}"),
		);
	expect((await preferences()).mouseClickVolume).toBe(0.35);
	await page.getByRole("button", { name: "Apply changes", exact: true }).click();
	await expect.poll(preferences).toMatchObject({ zoomWhooshVolume: 0, mouseClickVolume: 1 });
	await page.getByRole("button", { name: "Preview mouse click sound", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(window as unknown as { clickPreview: HTMLAudioElement }).clickPreview
						?.readyState,
			),
		)
		.toBeGreaterThanOrEqual(2);
	expect(
		await page.evaluate(
			() => (window as unknown as { clickPreview: HTMLAudioElement }).clickPreview.volume,
		),
	).toBe(1);
	await page.reload();
	await page.getByRole("radio", { name: "Settings", exact: true }).click();
	await page.getByRole("row", { name: "Sounds", exact: true }).click();
	await expect(whoosh).toHaveValue("0");
	await expect(click).toHaveValue("1");
	await click.focus();
	await page.keyboard.press("Home");
	await expect(
		page.getByRole("button", { name: "Preview mouse click sound", exact: true }),
	).toBeDisabled();
	await page.getByRole("button", { name: "Apply changes", exact: true }).click();
	await expect.poll(preferences).toMatchObject({ zoomWhooshVolume: 0, mouseClickVolume: 0 });
	await page.screenshot({ path: "test-results/mouse-click-sounds.png" });
});
