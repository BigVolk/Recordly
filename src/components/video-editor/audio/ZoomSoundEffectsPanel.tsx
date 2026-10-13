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
import {
	DEFAULT_ZOOM_SOUND_EFFECTS,
	ZOOM_SOUND_LIBRARY,
	type ZoomSoundChoice,
	type ZoomSoundEffects,
} from "./zoomSoundSettings";

type SoundSlot = Exclude<keyof ZoomSoundEffects, "largeZoomThreshold">;
const groups = [
	{ size: "small", slots: ["smallZoomIn", "smallZoomOut"] },
	{ size: "large", slots: ["largeZoomIn", "largeZoomOut"] },
] as const;

function auditionVolume(volume: number) {
	return Number.isFinite(volume) && volume > 0 ? Math.min(1, volume) : DEFAULT_ZOOM_WHOOSH_VOLUME;
}

export function ZoomSoundEffectsPanel({
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
