import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv[2]) throw new Error("Pass the built recordly-gabriel.app path.");
const appPath = path.resolve(process.argv[2]);
await fs.mkdir(path.join(root, ".tmp"), { recursive: true });
const profile = await fs.mkdtemp(path.join(root, ".tmp/gabriel-ui-smoke-"));
await fs.writeFile(
	path.join(profile, "app-settings.json"),
	JSON.stringify({ "recordly.onboarding.v1.seen": true }),
);
let application;
let browser;
try {
	const endpoint = new Promise((resolve, reject) => {
		application = spawn(
			path.join(appPath, "Contents/MacOS/recordly-gabriel"),
			["--remote-debugging-port=0", `--user-data-dir=${profile}`],
			{
				cwd: root,
				env: {
					...process.env,
					RECORDLY_DEV_OPEN_RECORDING_INPUT: path.join(
						root,
						"tests/ui/fixtures/preview.mp4",
					),
				},
				stdio: ["ignore", "ignore", "pipe"],
			},
		);
		let output = "";
		const timer = setTimeout(
			() => reject(new Error(`Packaged app did not start: ${output}`)),
			30000,
		);
		application.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		application.once("exit", (code) => {
			clearTimeout(timer);
			reject(new Error(`Packaged app exited (${code}): ${output}`));
		});
		application.stderr.on("data", (data) => {
			output += data.toString();
			const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
			if (match) {
				clearTimeout(timer);
				resolve(match[1]);
			}
		});
	});
	const debuggerUrl = await endpoint;
	const targetsUrl = new URL("/json/list", debuggerUrl.replace("ws:", "http:"));
	// Attach after the document loads so the debugger does not interrupt Electron's preload setup.
	await expect
		.poll(
			async () => {
				const targets = await (await fetch(targetsUrl)).json();
				return targets.some(
					(target) =>
						target.type === "page" &&
						target.title &&
						target.title !== target.url &&
						target.url.includes("windowType=editor"),
				);
			},
			{ timeout: 20000 },
		)
		.toBe(true);
	browser = await chromium.connectOverCDP(debuggerUrl);
	const context = browser.contexts()[0];
	await expect.poll(() => context.pages().length, { timeout: 20000 }).toBeGreaterThan(0);
	const page = context.pages()[0];
	const errors = [];
	page.on("pageerror", (error) => {
		errors.push(error.message);
		console.error("Packaged page error:", error.message);
	});
	await page.getByRole("radio", { name: "Settings", exact: true }).waitFor({ timeout: 20000 });
	await expect
		.poll(() => page.evaluate(() => typeof window.electronAPI?.getAppSetting), {
			timeout: 15000,
		})
		.toBe("function");
	assert.equal(await page.evaluate(() => window.electronAPI.getPlatform()), "darwin");
	await page.getByRole("radio", { name: "Settings", exact: true }).click({ timeout: 20000 });
	await page.getByRole("row", { name: "Sounds", exact: true }).click();
	const apply = page.getByRole("button", { name: "Apply changes", exact: true });
	assert.equal(await apply.isDisabled(), true);
	await page.getByRole("button", { name: /Small zoom in sound$/ }).click();
	await page
		.getByRole("listbox", { name: "Small zoom in sound", exact: true })
		.getByRole("option", { name: "Better whoosh", exact: true })
		.click();
	assert.equal(await apply.isEnabled(), true);
	assert.equal(
		await page.evaluate(
			() =>
				window.electronAPI.getAppSetting("recordly.editor.preferences")?.zoomSoundEffects
					?.smallZoomIn,
		),
		"dry-short-in",
	);
	const volume = page.getByRole("slider", { name: "Whoosh volume", exact: true });
	await volume.focus();
	await page.keyboard.press("End");
	await apply.click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					window.electronAPI.getAppSetting("recordly.editor.preferences")
						?.zoomSoundEffects?.smallZoomIn,
			),
		)
		.toBe("better");
	assert.equal(await apply.isDisabled(), true);
	assert.equal(
		await page.evaluate(
			() => window.electronAPI.getAppSetting("recordly.editor.preferences")?.zoomWhooshVolume,
		),
		1,
	);
	await page.evaluate(() => document.fonts.ready);
	const style = await page.evaluate(() => ({
		font: getComputedStyle(document.body).fontFamily,
		loaded: [...document.fonts].some(
			(face) => face.family.includes("DM Sans") && face.status === "loaded",
		),
		sheets: document.styleSheets.length,
	}));
	assert.ok(
		style.font.includes("DM Sans") && style.loaded && style.sheets > 0,
		JSON.stringify(style),
	);
	assert.deepEqual(errors, []);
	await page.screenshot({ path: path.join(root, ".tmp/gabriel-packaged-ui.png") });
	console.log(
		"Packaged UI smoke passed: desktop bridge, styled text, sound selection, Apply, and saved settings.",
	);
} finally {
	if (browser) await browser.close().catch(() => {});
	if (application && application.exitCode === null) {
		const exited = once(application, "exit");
		const timer = setTimeout(() => application.kill("SIGKILL"), 5000);
		application.kill("SIGTERM");
		await exited;
		clearTimeout(timer);
	}
	await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
