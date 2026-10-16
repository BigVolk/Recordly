import path from "node:path";
import { dialog, ipcMain } from "electron";
import { USER_DATA_PATH } from "../../appPaths";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";
import {
	importSoundEffectFiles,
	readSoundEffectLibrary,
	SOUND_EFFECT_EXTENSIONS,
} from "../sounds/library";

export function registerSoundEffectHandlers() {
	const directory = path.join(USER_DATA_PATH, "sound-effects");
	let importing = false;
	ipcMain.handle("get-sound-effect-library", async () => {
		try {
			return { success: true, sounds: await readSoundEffectLibrary(directory) };
		} catch {
			return { success: false, sounds: [], message: "Could not read the sound library." };
		}
	});
	ipcMain.handle("import-sound-effects", async (_, kind: unknown) => {
		if (kind !== "whoosh" && kind !== "click" && kind !== "scroll")
			return { success: false, message: "Choose a sound effect category." };
		if (importing) return { success: false, message: "A sound import is already in progress." };
		importing = true;
		try {
			const selected = await dialog.showOpenDialog({
				title:
					kind === "whoosh"
						? "Add Whoosh Sounds"
						: kind === "scroll"
							? "Add Scroll Sounds"
							: "Add Mouse Click Sounds",
				filters: [{ name: "Audio Files", extensions: SOUND_EFFECT_EXTENSIONS }],
				properties: ["openFile", "multiSelections"],
			});
			if (selected.canceled || !selected.filePaths.length)
				return { success: false, canceled: true };
			const result = await importSoundEffectFiles(
				directory,
				selected.filePaths,
				kind,
				getFfmpegBinaryPath(),
			);
			return { success: result.sounds.length > 0, ...result };
		} catch {
			return { success: false, message: "Could not import the selected sound files." };
		} finally {
			importing = false;
		}
	});
}
