import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
	type CustomSoundEffect,
	type SoundEffectKind,
	normalizeCustomSoundEffects,
	MAX_CUSTOM_SOUND_DURATION_MS,
} from "../../../src/components/video-editor/audio/customSoundEffects";

const execute = promisify(execFile);
export const SOUND_EFFECT_EXTENSIONS = [
	"mp3",
	"wav",
	"aac",
	"m4a",
	"flac",
	"ogg",
	"opus",
	"aif",
	"aiff",
];

export async function readSoundEffectLibrary(directory: string): Promise<CustomSoundEffect[]> {
	try {
		const parsed = JSON.parse(await fs.readFile(path.join(directory, "library.json"), "utf8"));
		return normalizeCustomSoundEffects(parsed).map((sound) => ({
			...sound,
			path: path.join(directory, `${sound.id.slice(6)}.wav`),
		}));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw error;
	}
}

function wavDurationMs(buffer: Buffer): number {
	let rate = 0;
	for (let offset = 12; offset + 8 <= buffer.length; ) {
		const kind = buffer.toString("ascii", offset, offset + 4);
		const size = buffer.readUInt32LE(offset + 4);
		if (kind === "fmt " && size >= 16) rate = buffer.readUInt32LE(offset + 16);
		if (kind === "data" && rate > 0) return (size / rate) * 1000;
		offset += 8 + size + (size % 2);
	}
	throw new Error("The file could not be decoded as audio.");
}

export async function importSoundEffectFiles(
	directory: string,
	files: string[],
	kind: SoundEffectKind,
	ffmpeg: string,
) {
	await fs.mkdir(directory, { recursive: true });
	const library = await readSoundEffectLibrary(directory);
	const imported: CustomSoundEffect[] = [];
	const errors: string[] = [];
	for (const source of files) {
		const id = randomUUID();
		const target = path.join(directory, `${id}.wav`);
		try {
			if (!SOUND_EFFECT_EXTENSIONS.includes(path.extname(source).slice(1).toLowerCase()))
				throw new Error("Unsupported audio format.");
			const info = await fs.stat(source);
			if (!info.isFile() || info.size > 100 * 1024 * 1024)
				throw new Error("Choose an audio file smaller than 100 MB.");
			try {
				await execute(
					ffmpeg,
					[
						"-nostdin",
						"-v",
						"error",
						"-i",
						source,
						"-map",
						"0:a:0",
						"-vn",
						"-t",
						"60.01",
						"-c:a",
						"pcm_s16le",
						"-ar",
						"48000",
						"-ac",
						"2",
						target,
					],
					{ timeout: 30000, maxBuffer: 1024 * 1024 },
				);
			} catch {
				throw new Error("The file could not be decoded as audio.");
			}
			const durationMs = wavDurationMs(await fs.readFile(target));
			if (durationMs <= 0 || durationMs > MAX_CUSTOM_SOUND_DURATION_MS)
				throw new Error("Sound effects must be 60 seconds or shorter.");
			imported.push({
				id: `local:${id}`,
				name: path.basename(source, path.extname(source)),
				kind,
				path: target,
				durationMs,
			});
		} catch (error) {
			await fs.rm(target, { force: true });
			errors.push(
				`${path.basename(source)}: ${error instanceof Error ? error.message : "Import failed."}`,
			);
		}
	}
	if (imported.length) {
		const temporary = path.join(directory, `library-${randomUUID()}.tmp`);
		try {
			await fs.writeFile(temporary, JSON.stringify([...library, ...imported], null, 2));
			await fs.rename(temporary, path.join(directory, "library.json"));
		} catch (error) {
			await Promise.all(imported.map((sound) => fs.rm(sound.path, { force: true })));
			throw error;
		} finally {
			await fs.rm(temporary, { force: true });
		}
	}
	return { sounds: imported, errors };
}
