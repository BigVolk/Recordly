import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { useScopedT } from "@/contexts/I18nContext";
import { SliderControl } from "../SliderControl";
import { DEFAULT_ZOOM_WHOOSH_VOLUME } from "../types";
import { resolveZoomSoundUrl } from "./zoomSoundAssets";
import { resolveMouseClickSoundUrl } from "./mouseClickSound";
import {
	DEFAULT_ZOOM_SOUND_EFFECTS,
	MAX_ZOOM_SOUND_DELAY_MS,
	ZOOM_SOUND_LIBRARY,
	type ZoomSoundChoice,
	type ZoomSoundEffects,
	type ZoomSoundSlot,
} from "./zoomSoundSettings";

type SoundSlot = ZoomSoundSlot;
const groups = [
	{ size: "small", slots: ["smallZoomIn", "smallZoomOut"] },
	{ size: "large", slots: ["largeZoomIn", "largeZoomOut"] },
] as const;

function auditionVolume(volume: number) {
	return Number.isFinite(volume) && volume > 0 ? Math.min(1, volume) : DEFAULT_ZOOM_WHOOSH_VOLUME;
}

function ZoomSoundEffectsEditor({
	settings,
	onChange,
	volume,
}: {
	settings: ZoomSoundEffects;
	onChange: (settings: ZoomSoundEffects) => void;
	volume: number;
}) {
	const t = useScopedT("settings");
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const [previewing, setPreviewing] = useState<SoundSlot | null>(null);
	const stopPreview = useCallback(() => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.src = "";
			audioRef.current = null;
		}
		setPreviewing(null);
	}, []);

	useEffect(() => {
		const audio = audioRef.current;
		if (audio && previewing && audio.dataset.zoomSoundId !== settings[previewing])
			stopPreview();
	}, [settings, previewing, stopPreview]);
	useEffect(() => {
		if (audioRef.current) audioRef.current.volume = auditionVolume(volume);
	}, [volume]);
	useEffect(
		() => () => {
			audioRef.current?.pause();
			if (audioRef.current) audioRef.current.src = "";
			audioRef.current = null;
		},
		[],
	);

	function preview(slot: SoundSlot) {
		const soundId = settings[slot];
		const wasPlaying = previewing === slot;
		stopPreview();
		if (wasPlaying || soundId === "none") return;
		const audio = new Audio(resolveZoomSoundUrl(soundId));
		audio.dataset.zoomSoundId = soundId;
		audio.volume = auditionVolume(volume);
		audioRef.current = audio;
		setPreviewing(slot);
		audio.onended = () => {
			if (audioRef.current === audio) stopPreview();
		};
		audio.onerror = () => {
			if (audioRef.current !== audio) return;
			stopPreview();
			toast.warning(t("audio.previewFailed", "Could not preview this sound."));
		};
		void audio.play().catch(() => {
			if (audioRef.current === audio) stopPreview();
		});
	}

	return (
		<section
			aria-label={t("audio.zoomSounds", "Zoom sound effects")}
			className="flex flex-col gap-5"
		>
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-sm font-medium">
					{t("audio.zoomSounds", "Zoom sound effects")}
				</h2>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onChange({ ...DEFAULT_ZOOM_SOUND_EFFECTS })}
				>
					{t("audio.resetSounds", "Reset sounds")}
				</Button>
			</div>
			<p className="text-xs text-muted-foreground">
				{t(
					"audio.delayDescription",
					"Negative delay plays the whoosh before the zoom; positive delay plays it after. 0 ms keeps it aligned with the zoom.",
				)}
			</p>
			{groups.map(({ size, slots }) => (
				<section
					key={size}
					aria-label={`${size === "small" ? "Small" : "Large"} zoom sounds`}
					className="rounded-xl border border-separator p-3"
				>
					<h3 className="mb-3 text-sm font-medium">
						{size === "small"
							? t("audio.smallZooms", "Small zooms")
							: t("audio.largeZooms", "Large zooms")}
					</h3>
					<div className="flex flex-col gap-3">
						{slots.map((slot, index) => {
							const direction = index === 0 ? "in" : "out";
							const label = `${size === "small" ? "Small" : "Large"} zoom ${direction} sound`;
							return (
								<div key={slot} className="flex flex-col gap-1.5">
									<span className="text-xs text-muted-foreground">
										{direction === "in"
											? t("audio.zoomIn", "Zoom in")
											: t("audio.zoomOut", "Zoom out")}
									</span>
									<div className="flex items-center gap-2">
										<Select
											aria-label={label}
											value={settings[slot]}
											onValueChange={(value) =>
												onChange({
													...settings,
													[slot]: value as ZoomSoundChoice,
												})
											}
											className="min-w-0 flex-1"
										>
											<SelectTrigger aria-label={label} className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">
													{t("audio.noSound", "No sound")}
												</SelectItem>
												{ZOOM_SOUND_LIBRARY.map((sound) => (
													<SelectItem key={sound.id} value={sound.id}>
														{sound.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<Button
											variant="secondary"
											size="sm"
											className="shrink-0"
											aria-label={`${previewing === slot ? "Stop" : "Preview"} ${size} zoom ${direction} sound`}
											disabled={settings[slot] === "none"}
											onClick={() => preview(slot)}
										>
											{previewing === slot
												? t("audio.stopPreview", "Stop")
												: t("audio.previewSound", "Preview")}
										</Button>
									</div>
									<SliderControl
										label={t(
											`audio.delay.${slot}`,
											`${size === "small" ? "Small" : "Large"} zoom ${direction} delay`,
										)}
										value={settings.delaysMs[slot]}
										min={-MAX_ZOOM_SOUND_DELAY_MS}
										max={MAX_ZOOM_SOUND_DELAY_MS}
										step={10}
										onChange={(delay) =>
											onChange({
												...settings,
												delaysMs: { ...settings.delaysMs, [slot]: delay },
											})
										}
										formatValue={(delay) =>
											`${delay > 0 ? "+" : ""}${delay} ms`
										}
									/>
								</div>
							);
						})}
					</div>
				</section>
			))}
			<div className="flex flex-col gap-2">
				<SliderControl
					label={t("audio.largeZoomThreshold", "Large zoom starts at")}
					value={settings.largeZoomThreshold}
					min={1.1}
					max={5}
					step={0.1}
					onChange={(value) => onChange({ ...settings, largeZoomThreshold: value })}
					formatValue={(value) => `${Number(value.toFixed(1))}×`}
				/>
				<p className="text-xs text-muted-foreground">
					{t(
						"audio.zoomSizeDescription",
						"Large zooms change magnification by {{factor}}× or more. Smaller changes use the small zoom sounds.",
						{ factor: Number(settings.largeZoomThreshold.toFixed(1)) },
					)}
				</p>
			</div>
		</section>
	);
}

export function ZoomSoundEffectsPanel({
	settings,
	onChange,
	volume,
	onVolumeChange,
	mouseClickVolume,
	onMouseClickVolumeChange,
}: {
	settings: ZoomSoundEffects;
	onChange: (settings: ZoomSoundEffects) => void;
	volume: number;
	onVolumeChange: (volume: number) => void;
	mouseClickVolume: number;
	onMouseClickVolumeChange: (volume: number) => void;
}) {
	const t = useScopedT("settings");
	const [draft, setDraft] = useState(() => ({ ...settings }));
	const [draftVolume, setDraftVolume] = useState(volume);
	const [draftClickVolume, setDraftClickVolume] = useState(mouseClickVolume);
	const clickAudioRef = useRef<HTMLAudioElement | null>(null);
	useEffect(
		() => () => {
			clickAudioRef.current?.pause();
			if (clickAudioRef.current) clickAudioRef.current.src = "";
		},
		[],
	);
	useEffect(() => {
		setDraft({ ...settings });
		setDraftVolume(volume);
		setDraftClickVolume(mouseClickVolume);
	}, [settings, volume, mouseClickVolume]);
	const hasChanges =
		draftClickVolume !== mouseClickVolume ||
		draftVolume !== volume ||
		(Object.keys(settings) as (keyof ZoomSoundEffects)[]).some((key) =>
			key === "delaysMs"
				? (Object.keys(settings.delaysMs) as SoundSlot[]).some(
						(slot) => draft.delaysMs[slot] !== settings.delaysMs[slot],
					)
				: draft[key] !== settings[key],
		);
	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-2">
				<Button
					disabled={!hasChanges}
					onClick={() => {
						onChange({ ...draft });
						onVolumeChange(draftVolume);
						onMouseClickVolumeChange(draftClickVolume);
					}}
				>
					{t("audio.applyChanges", "Apply changes")}
				</Button>
				<p role="status" className="text-xs text-muted-foreground">
					{hasChanges
						? t(
								"audio.unappliedChanges",
								"Unapplied changes. Apply to update playback and exports.",
							)
						: t("audio.changesApplied", "Your sound settings are applied.")}
				</p>
			</div>
			<SliderControl
				label={t("audio.whooshVolume", "Whoosh volume")}
				value={draftVolume}
				min={0}
				max={1}
				step={0.01}
				onChange={setDraftVolume}
				formatValue={(value) => `${Math.round(value * 100)}%`}
			/>
			<section className="flex flex-col gap-2" aria-label="Mouse click sounds">
				<SliderControl
					label={t("audio.mouseClickVolume", "Mouse click volume")}
					value={draftClickVolume}
					min={0}
					max={1}
					step={0.01}
					onChange={setDraftClickVolume}
					formatValue={(value) => `${Math.round(value * 100)}%`}
				/>
				<p className="text-xs text-muted-foreground">
					{t(
						"audio.mouseClickDescription",
						"Adds a sound to recorded mouse clicks. Set to 0% to mute.",
					)}
				</p>
				<Button
					variant="secondary"
					size="sm"
					aria-label="Preview mouse click sound"
					disabled={draftClickVolume === 0}
					onClick={() => {
						clickAudioRef.current?.pause();
						const audio = new Audio(resolveMouseClickSoundUrl());
						audio.volume = draftClickVolume;
						clickAudioRef.current = audio;
						void audio
							.play()
							.catch(() =>
								toast.warning(
									t("audio.previewFailed", "Could not preview this sound."),
								),
							);
					}}
				>
					{t("audio.previewSound", "Preview")}
				</Button>
			</section>
			<ZoomSoundEffectsEditor settings={draft} onChange={setDraft} volume={draftVolume} />
		</div>
	);
}
