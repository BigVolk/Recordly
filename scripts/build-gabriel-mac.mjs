#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildEnv = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" };
const npmPath = process.env.npm_execpath;

function run(command, args, env = buildEnv) {
	const result = spawnSync(command, args, { cwd: projectRoot, env, stdio: "inherit" });
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(" ")} failed${result.signal ? ` (${result.signal})` : ` (exit ${result.status})`}.`,
		);
	}
}

function npm(args, env = buildEnv) {
	if (npmPath) run(process.execPath, [npmPath, ...args], env);
	else run("npm", args, env);
}

function canRun(command, args) {
	return (
		spawnSync(command, args, { cwd: projectRoot, env: buildEnv, stdio: "ignore" }).status === 0
	);
}

function hasStagedWhisper(arch) {
	const runtimeDir = path.join(projectRoot, "electron/native/bin", `darwin-${arch}`);
	try {
		const manifest = JSON.parse(
			readFileSync(path.join(runtimeDir, "whisper-runtime.json"), "utf8"),
		);
		return (
			manifest.version === "v1.8.4" &&
			manifest.arch === arch &&
			existsSync(path.join(runtimeDir, "whisper-cli"))
		);
	} catch {
		return false;
	}
}

function ensureCmake(arch) {
	if (hasStagedWhisper(arch) || canRun("cmake", ["--version"])) return;
	for (const root of [".tmp/gabriel-build-tools", ".tmp/build-tools"]) {
		const binDir = path.join(projectRoot, root, "cmake/data/bin");
		if (existsSync(path.join(binDir, "cmake"))) {
			buildEnv.PATH = `${binDir}${path.delimiter}${buildEnv.PATH ?? ""}`;
			return;
		}
	}
	if (!canRun("python3", ["-m", "pip", "--version"])) {
		throw new Error(
			"The caption engine needs CMake. Install CMake, or install Python 3 with pip, then run this script again.",
		);
	}
	console.log("Downloading CMake into this project's .tmp folder for the caption engine...");
	const toolDir = path.join(projectRoot, ".tmp/gabriel-build-tools");
	run("python3", ["-m", "pip", "install", "--target", toolDir, "cmake"]);
	buildEnv.PATH = `${path.join(toolDir, "cmake/data/bin")}${path.delimiter}${buildEnv.PATH ?? ""}`;
}

function main() {
	if (process.platform !== "darwin") throw new Error("Run this script on a Mac.");
	if (Number(process.versions.node.split(".")[0]) < 22) {
		throw new Error("Install Node.js 22 or newer, then run this script again.");
	}
	if (!canRun("xcrun", ["--find", "swiftc"])) {
		throw new Error(
			"Install Apple's Command Line Tools with xcode-select --install, then run this script again.",
		);
	}
	const arch = process.arch === "arm64" ? "arm64" : "x64";
	buildEnv.WHISPER_RUNTIME_ARCHS = arch;
	console.log(`Building recordly-gabriel for macOS ${arch}...`);

	const tools = ["typescript", "vite", "electron-builder", "ffmpeg-static", "electron"];
	if (
		tools.some(
			(tool) => !existsSync(path.join(projectRoot, "node_modules", tool, "package.json")),
		)
	) {
		console.log("Installing the project's locked dependencies...");
		npm(["ci", "--ignore-scripts"]);
	}
	// Explicit installers also work with npm versions that restrict dependency install scripts.
	run(process.execPath, ["node_modules/electron/install.js"]);
	run(process.execPath, ["scripts/install-ffmpeg-static.mjs"]);
	ensureCmake(arch);
	npm(["run", "build:platform-native-helpers"]);
	npm(["run", "typecheck"]);
	npm(["exec", "--", "vite", "build"]);
	npm(["run", "normalize:electron-main-cjs"]);
	npm(["run", "smoke:electron-main-cjs"]);
	npm([
		"exec",
		"--",
		"electron-builder",
		"--config",
		"build/electron-builder.gabriel.cjs",
		"--mac",
		`--${arch}`,
		"--dir",
		"--publish",
		"never",
	]);

	const appPath = path.join(
		projectRoot,
		"release/gabriel",
		arch === "arm64" ? "mac-arm64" : "mac",
		"recordly-gabriel.app",
	);
	if (!existsSync(appPath)) throw new Error(`The build did not produce ${appPath}.`);
	run("codesign", ["--verify", "--deep", "--strict", appPath]);
	run(process.execPath, ["scripts/smoke-packaged-binaries.mjs"], {
		...buildEnv,
		PACKAGED_SMOKE_ARCH_TAGS: `darwin-${arch}`,
		PACKAGED_SMOKE_RELEASE_DIR: "release/gabriel",
		PACKAGED_SMOKE_PRODUCT_NAME: "recordly-gabriel",
	});
	console.log(
		`\nBuild complete. Your app is at:\n${appPath}\n\nTo install it later, drag recordly-gabriel.app into Applications.`,
	);
}

try {
	main();
} catch (error) {
	console.error(`\nBuild failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
