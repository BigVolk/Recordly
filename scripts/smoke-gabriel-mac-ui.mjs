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
const customDirectory = path.join(profile, "sound-effects");
await fs.mkdir(customDirectory, { recursive: true });
const customClickId = "22222222-2222-4222-8222-222222222222";
await fs.copyFile(
	path.join(root, "src/assets/sounds/mouse-click.wav"),
	path.join(customDirectory, `${customClickId}.wav`),
);
await fs.writeFile(
	path.join(customDirectory, "library.json"),
	JSON.stringify([
		{
			id: `local:${customClickId}`,
			name: "Smoke custom click",
			kind: "click",
			path: path.join(customDirectory, `${customClickId}.wav`),
			durationMs: 100,
		},
	]),
);
let application;
let browser;
const errors = [];
async function launchApp() {
	const endpoint = new Promise((resolve, reject) => {
		application = spawn(
			path.join(appPath, "Contents/MacOS/recordly-gabriel"),
			["--remote-debugging-port=0", `--user-data-dir=${profile}`],
			{
				cwd: root,
				env: {
					...process.env,
					RECORDLY_DEV_OPEN_RECORDING_INPUT:
						process.env.RECORDLY_SMOKE_RECORDING_INPUT ||
						path.join(root, "tests/ui/fixtures/preview.mp4"),
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
	page.on("pageerror", (error) => {
		errors.push(error.message);
		console.error("Packaged page error:", error.message);
	});
	await page
		.getByRole("radio", { name: "Sound Effects", exact: true })
		.waitFor({ timeout: 20000 });
	await expect
		.poll(
			() =>
				page.evaluate(() => {
					const video = document.querySelector(
						'video[preload="auto"][aria-hidden="true"]',
					);
					return (
						video instanceof HTMLVideoElement &&
						video.readyState >= 2 &&
						video.videoWidth > 0 &&
						!video.error
					);
				}),
			{ timeout: 20000 },
		)
		.toBe(true);
	return page;
}

async function stopApp() {
	if (browser) await browser.close().catch(() => {});
	browser = undefined;
	if (application && application.exitCode === null && application.signalCode === null) {
		const exited = once(application, "exit");
		const timer = setTimeout(() => application.kill("SIGKILL"), 5000);
		application.kill("SIGTERM");
		await exited;
		clearTimeout(timer);
	}
	application = undefined;
}

try {
	let page = await launchApp();
	await expect
		.poll(() => page.evaluate(() => typeof window.electronAPI?.getAppSetting), {
			timeout: 15000,
		})
		.toBe("function");
	assert.equal(await page.evaluate(() => window.electronAPI.getPlatform()), "darwin");
	await page.getByRole("radio", { name: "Sound Effects", exact: true }).click({ timeout: 20000 });
	assert.equal(
		(await page.evaluate(() => window.electronAPI.getSoundEffectLibrary())).sounds[0].name,
		"Smoke custom click",
	);
	await page.getByRole("switch", { name: "Advanced settings", exact: true }).press("Space");
	await page.getByRole("tab", { name: "Mouse Clicks", exact: true }).click();
	await page.locator('button[aria-label="Mouse click sound"]').click();
	await page
		.getByRole("listbox", { name: "Mouse click sound" })
		.getByRole("option", { name: "Smoke custom click" })
		.click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					window.electronAPI.getAppSetting("recordly.editor.preferences")
						?.zoomSoundEffects?.mouseClickSound,
			),
		)
		.toBe(`local:${customClickId}`);
	await page.getByRole("tab", { name: "Whooshes", exact: true }).click();
	await page.getByRole("button", { name: /Small zoom in sound$/ }).click();
	await page
		.getByRole("listbox", { name: "Small zoom in sound", exact: true })
		.getByRole("option", { name: "Better whoosh", exact: true })
		.click();
	const volume = page.getByRole("slider", { name: "Whoosh volume", exact: true });
	await volume.focus();
	await page.keyboard.press("End");
	const clickVolume = page.getByRole("slider", { name: "Mouse click volume", exact: true });
	await page.getByRole("tab", { name: "Mouse Clicks", exact: true }).click();
	await clickVolume.focus();
	await page.keyboard.press("Home");
	for (let i = 0; i < 60; i++) await page.keyboard.press("ArrowRight");
	await page.getByRole("tab", { name: "Whooshes", exact: true }).click();
	await expect(volume).toHaveValue("1");
	const delayValues = {
		smallZoomIn: -150,
		smallZoomOut: 200,
		largeZoomIn: 300,
		largeZoomOut: -400,
	};
	for (const [label, value] of [
		["Small zoom in delay", -150],
		["Small zoom out delay", 200],
		["Large zoom in delay", 300],
		["Large zoom out delay", -400],
	]) {
		await page.getByRole("slider", { name: label, exact: true }).focus();
		for (let i = 0; i < Math.abs(value / 10); i++)
			await page.keyboard.press(value < 0 ? "ArrowLeft" : "ArrowRight");
	}
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					window.electronAPI.getAppSetting("recordly.editor.preferences")
						?.zoomSoundEffects?.smallZoomIn,
			),
		)
		.toBe("better");
	assert.equal(
		await page.evaluate(
			() => window.electronAPI.getAppSetting("recordly.editor.preferences")?.zoomWhooshVolume,
		),
		1,
	);
	assert.equal(
		await page.evaluate(
			() => window.electronAPI.getAppSetting("recordly.editor.preferences")?.mouseClickVolume,
		),
		0.6,
	);
	assert.deepEqual(
		await page.evaluate(
			() =>
				window.electronAPI.getAppSetting("recordly.editor.preferences")?.zoomSoundEffects
					?.delaysMs,
		),
		delayValues,
	);
	await page.getByRole("tab", { name: "Whooshes", exact: true }).click();
	const delayInput = page.getByRole("spinbutton", { name: "Small zoom in delay value" });
	await delayInput.fill("-275");
	await page.keyboard.press("Control+z");
	await expect(delayInput).toHaveValue("-150");
	await page.getByRole("tab", { name: "Mouse Clicks", exact: true }).click();
	await page.evaluate(() => {
		const play = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function () {
			if (this instanceof HTMLAudioElement) window.smokeClickAudio = this;
			return play.call(this);
		};
	});
	await page.getByRole("button", { name: "Preview mouse click sound", exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => window.smokeClickAudio?.readyState))
		.toBeGreaterThanOrEqual(2);
	assert.equal(await page.evaluate(() => window.smokeClickAudio.volume), 0.6);
	assert.equal(
		await page.evaluate(async () => {
			const response = await fetch(window.smokeClickAudio.src);
			const context = new AudioContext();
			try {
				return (await context.decodeAudioData(await response.arrayBuffer())).duration;
			} finally {
				await context.close();
			}
		}),
		0.1,
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
	await stopApp();
	page = await launchApp();
	await page.getByRole("radio", { name: "Sound Effects", exact: true }).click();
	await page.getByRole("switch", { name: "Advanced settings", exact: true }).press("Space");
	await page.getByRole("tab", { name: "Mouse Clicks", exact: true }).click();
	await expect(page.locator('button[aria-label="Mouse click sound"]')).toContainText(
		"Smoke custom click",
	);
	await page.getByRole("tab", { name: "Whooshes", exact: true }).click();
	await expect(page.getByRole("button", { name: /Small zoom in sound$/ })).toContainText(
		"Better whoosh",
	);
	await expect(page.getByRole("slider", { name: "Whoosh volume", exact: true })).toHaveValue("1");
	await page.getByRole("tab", { name: "Mouse Clicks", exact: true }).click();
	await expect(page.getByRole("slider", { name: "Mouse click volume", exact: true })).toHaveValue(
		"0.6",
	);
	await page.getByRole("tab", { name: "Whooshes", exact: true }).click();
	for (const [label, value] of [
		["Small zoom in delay", -150],
		["Small zoom out delay", 200],
		["Large zoom in delay", 300],
		["Large zoom out delay", -400],
	]) {
		await expect(
			page.getByRole("spinbutton", { name: `${label} value`, exact: true }),
		).toHaveValue(String(value));
	}
	assert.deepEqual(errors, []);
	console.log(
		"Packaged UI smoke passed: desktop bridge, styled text, click/whoosh sounds, independent volumes and delays restored after app relaunch.",
	);
} finally {
	await stopApp();
	await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
