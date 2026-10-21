import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SliderControl } from "../SliderControl";
import { soundEventCategory } from "./soundEvents";
import { ZOOM_SOUND_LIBRARY, type ZoomSoundEffects } from "./zoomSoundSettings";
import { useState } from "react";

export function SoundEventEditor({
	advanced = false,
	id,
	settings,
	onChange,
}: {
	advanced?: boolean;
	id: string;
	settings: ZoomSoundEffects;
	onChange: (settings: ZoomSoundEffects) => void;
}) {
	const category = soundEventCategory(id);
	const edit = settings.events[id] ?? {};
	const [draft, setDraft] = useState<string | null>(null);
	if (!category) return null;
	function change(patch: typeof edit) {
		onChange({ ...settings, events: { ...settings.events, [id]: { ...edit, ...patch } } });
	}
	return (
		<section className="flex flex-col gap-3" aria-label="Selected sound effect">
			<h3 className="text-sm font-semibold">
				{category === "whoosh" ? "Whoosh" : "Mouse click"} event
			</h3>
			<Select
				value={edit.soundId ?? "inherit"}
				onValueChange={(value) =>
					change({ soundId: value === "inherit" ? undefined : value })
				}
			>
				<SelectTrigger aria-label="Event sound">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="inherit">Choose sound</SelectItem>
					{category === "whoosh" ? (
						ZOOM_SOUND_LIBRARY.map((sound) => (
							<SelectItem key={sound.id} value={sound.id}>
								{sound.label}
							</SelectItem>
						))
					) : (
						<SelectItem value="default-click">Default {category} sound</SelectItem>
					)}
					{settings.customSounds
						.filter((sound) => sound.kind === category)
						.map((sound) => (
							<SelectItem key={sound.id} value={sound.id}>
								{sound.name}
							</SelectItem>
						))}
				</SelectContent>
			</Select>
			{advanced && (
				<>
					<SliderControl
						label="Event delay"
						value={edit.delayMs ?? 0}
						min={-2000}
						max={2000}
						step={10}
						onChange={(delayMs) => change({ delayMs })}
						formatValue={(value) => `${value} ms`}
					/>
					<label className="text-xs">
						Delay from category timing (ms)
						<input
							className="mt-1 w-full rounded border border-separator bg-transparent p-2"
							aria-label="Event delay value"
							type="number"
							min={-60000}
							max={60000}
							value={draft ?? edit.delayMs ?? 0}
							onBlur={() => setDraft(null)}
							onChange={(event) => {
								const text = event.target.value;
								setDraft(text);
								if (text && Number.isFinite(Number(text)))
									change({
										delayMs: Math.max(
											-60000,
											Math.min(60000, Math.round(Number(text))),
										),
									});
							}}
						/>
					</label>
				</>
			)}
		</section>
	);
}
