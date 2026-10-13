import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import { afterEach, describe, expect, it } from "vitest";
import { importSoundEffectFiles, readSoundEffectLibrary } from "./library";

const execute = promisify(execFile);
const directories: string[] = [];
afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => fs.rm(directory, { recursive: true, force: true })),
	);
});
async function fixture(duration = 0.25, extension = "mp3") {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), "recordly-sound-import-"));
	directories.push(directory);
	const source = path.join(directory, `My sound.${extension}`);
	await execute(ffmpeg!, [
		"-v",
		"error",
		"-f",
		"lavfi",
		"-i",
		`sine=frequency=880:duration=${duration}`,
		source,
	]);
	return { directory, source, library: path.join(directory, "library") };
}
describe("local sound library", () => {
	it("decodes compressed audio into an owned copy that survives deleting the original", async () => {
		const { source, library } = await fixture();
		const result = await importSoundEffectFiles(library, [source], "whoosh", ffmpeg!);
		expect(result.errors).toEqual([]);
		expect(result.sounds).toHaveLength(1);
		const sound = result.sounds[0];
		expect(sound).toMatchObject({ name: "My sound", kind: "whoosh" });
		expect(sound.durationMs).toBeCloseTo(250, 1);
		await fs.rm(source);
		expect((await fs.readFile(sound.path)).toString("ascii", 0, 4)).toBe("RIFF");
		expect(await readSoundEffectLibrary(library)).toEqual(result.sounds);
		const relocated = `${library}-moved`;
		await fs.rename(library, relocated);
		expect((await readSoundEffectLibrary(relocated))[0].path).toBe(
			path.join(relocated, path.basename(sound.path)),
		);
	});
	it("imports valid files in a mixed batch without replacing earlier sounds", async () => {
		const { directory, source, library } = await fixture(0.1, "wav");
		const old = await importSoundEffectFiles(library, [source], "whoosh", ffmpeg!);
		const corrupt = path.join(directory, "broken.wav");
		await fs.writeFile(corrupt, "this is not audio");
		const result = await importSoundEffectFiles(library, [corrupt, source], "click", ffmpeg!);
		expect(result.errors).toEqual(["broken.wav: The file could not be decoded as audio."]);
		expect(result.sounds[0]).toMatchObject({ kind: "click", durationMs: 100 });
		expect(await readSoundEffectLibrary(library)).toEqual([...old.sounds, ...result.sounds]);
		expect((await fs.readdir(library)).sort()).toEqual(
			[
				"library.json",
				...old.sounds.map((s) => path.basename(s.path)),
				...result.sounds.map((s) => path.basename(s.path)),
			].sort(),
		);
	});
	it("rejects sounds longer than a minute and leaves no partial imported file", async () => {
		const { source, library } = await fixture(61, "wav");
		const result = await importSoundEffectFiles(library, [source], "click", ffmpeg!);
		expect(result.sounds).toEqual([]);
		expect(result.errors[0]).toContain("60 seconds or shorter");
		expect(await fs.readdir(library)).toEqual([]);
	});
});
