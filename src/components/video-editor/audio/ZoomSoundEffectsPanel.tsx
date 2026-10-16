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
import { saveEditorPreferences } from "../editorPreferences";
import { DEFAULT_ZOOM_WHOOSH_VOLUME } from "../types";
import { getZoomSoundAsset } from "./zoomSoundAssets";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import {
	type CustomSoundEffect,
	type SoundEffectKind,
	mergeCustomSoundEffects,
} from "./customSoundEffects";
import { getMouseClickSoundAsset } from "./mouseClickSound";
import { getScrollSoundAsset } from "./scrollSounds";
import {
	DEFAULT_ZOOM_SOUND_EFFECTS,
	MAX_ZOOM_SOUND_DELAY_MS,
	ZOOM_SOUND_LIBRARY,
	type ZoomSoundChoice,
	type ZoomSoundEffects,
	type ZoomSoundSlot,
	type MouseClickSoundChoice,
	type ScrollSoundChoice,
	type ScrollSoundSlot,
} from "./zoomSoundSettings";

const scrollSlots: { slot: ScrollSoundSlot; label: string }[] = [
	{ slot: "smallScrollUp", label: "Small scroll up" },
	{ slot: "smallScrollDown", label: "Small scroll down" },
	{ slot: "largeScrollUp", label: "Large scroll up" },
	{ slot: "largeScrollDown", label: "Large scroll down" },
];

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
	catalog,
	onImport,
	importing,
}: {
	settings: ZoomSoundEffects;
	onChange: (settings: ZoomSoundEffects) => void;
	volume: number;
	catalog: CustomSoundEffect[];
	onImport: () => void;
	importing: boolean;
}) {
	const t = useScopedT("settings");
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const previewRequestRef = useRef(0);
	const [previewing, setPreviewing] = useState<SoundSlot | null>(null);
	const [delayInputs, setDelayInputs] = useState<Partial<Record<ZoomSoundSlot, string>>>({});
	const stopPreview = useCallback(() => {
		previewRequestRef.current += 1;
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
			previewRequestRef.current += 1;
			audioRef.current?.pause();
			if (audioRef.current) audioRef.current.src = "";
			audioRef.current = null;
		},
		[],
	);

	async function preview(slot: SoundSlot) {
		const soundId = settings[slot];
		const wasPlaying = previewing === slot;
		stopPreview();
		if (wasPlaying || soundId === "none") return;
		const sound = getZoomSoundAsset({ ...settings, customSounds: catalog }, soundId);
		if (!sound) return;
		const request = ++previewRequestRef.current;
		setPreviewing(slot);
		try {
			const source = await resolveMediaElementSource(sound.path);
			if (request !== previewRequestRef.current) {
				source.revoke();
				return;
			}
			const audio = new Audio(source.src);
			audio.dataset.zoomSoundId = soundId;
			audio.volume = auditionVolume(volume);
			audioRef.current = audio;
			audio.onended = () => {
				if (audioRef.current === audio) stopPreview();
			};
			audio.onerror = () => {
				if (audioRef.current === audio) {
					stopPreview();
					toast.warning(t("audio.previewFailed", "Could not preview this sound."));
				}
			};
			await audio.play();
		} catch {
			if (request === previewRequestRef.current) {
				stopPreview();
				toast.warning(t("audio.previewFailed", "Could not preview this sound."));
			}
		}
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
					onClick={() =>
						onChange({
							...DEFAULT_ZOOM_SOUND_EFFECTS,
							customSounds: settings.customSounds,
							mouseClickSound: settings.mouseClickSound,
						})
					}
				>
					{t("audio.resetSounds", "Reset sounds")}
				</Button>
			</div>
			<Button variant="secondary" size="sm" disabled={importing} onClick={onImport}>
				{t("audio.addWhooshes", "Add whoosh files…")}
			</Button>
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
													customSounds: catalog,
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
												{catalog
													.filter((sound) => sound.kind === "whoosh")
													.map((sound) => (
														<SelectItem key={sound.id} value={sound.id}>
															{sound.name}
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
									<div className="flex items-end gap-2">
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
													delaysMs: {
														...settings.delaysMs,
														[slot]: delay,
													},
												})
											}
											formatValue={(delay) =>
												`${delay > 0 ? "+" : ""}${delay} ms`
											}
										/>
										<div className="flex shrink-0 items-center gap-1 pb-2 text-xs">
											<input
												aria-label={`${size === "small" ? "Small" : "Large"} zoom ${direction} delay value`}
												type="number"
												min={-MAX_ZOOM_SOUND_DELAY_MS}
												max={MAX_ZOOM_SOUND_DELAY_MS}
												step={1}
												value={
													delayInputs[slot] ??
													String(settings.delaysMs[slot])
												}
												onChange={(event) => {
													const text = event.target.value;
													setDelayInputs((current) => ({
														...current,
														[slot]: text,
													}));
													if (
														text.trim() !== "" &&
														Number.isFinite(Number(text))
													) {
														const delay = Math.max(
															-MAX_ZOOM_SOUND_DELAY_MS,
															Math.min(
																MAX_ZOOM_SOUND_DELAY_MS,
																Math.round(Number(text)),
															),
														);
														onChange({
															...settings,
															delaysMs: {
																...settings.delaysMs,
																[slot]: delay,
															},
														});
													}
												}}
												onBlur={() => {
													setDelayInputs((current) => ({
														...current,
														[slot]: undefined,
													}));
												}}
												onKeyDown={(event) => {
													if (event.key === "Enter")
														event.currentTarget.blur();
												}}
												className="w-20 rounded-md border border-separator bg-transparent px-2 py-1 text-right"
											/>
											<span>ms</span>
										</div>
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
	const clickAudioRef = useRef<HTMLAudioElement | null>(null);
	const clickPreviewRequestRef = useRef(0);
	const [library, setLibrary] = useState<CustomSoundEffect[]>([]);
	const [importing, setImporting] = useState<SoundEffectKind | null>(null);
	const [scrollDelayInputs, setScrollDelayInputs] = useState<
		Partial<Record<ScrollSoundSlot, string>>
	>({});
	const catalog = mergeCustomSoundEffects(settings.customSounds, library);
	function changeSettings(next: ZoomSoundEffects) {
		saveEditorPreferences({ zoomSoundEffects: next });
		onChange(next);
	}
	function changeWhooshVolume(next: number) {
		saveEditorPreferences({ zoomWhooshVolume: next });
		onVolumeChange(next);
	}
	function changeMouseClickVolume(next: number) {
		saveEditorPreferences({ mouseClickVolume: next });
		onMouseClickVolumeChange(next);
	}
	useEffect(() => {
		let disposed = false;
		void window.electronAPI
			?.getSoundEffectLibrary?.()
			.then((result) => {
				if (!disposed && result.success) setLibrary(result.sounds);
			})
			.catch(() => toast.warning("Could not load the imported sound library."));
		return () => {
			disposed = true;
		};
	}, []);
	async function importSounds(kind: SoundEffectKind) {
		setImporting(kind);
		try {
			const result = await window.electronAPI.importSoundEffects(kind);
			if (result.canceled) return;
			if (result.sounds?.length) {
				const sounds = result.sounds;
				setLibrary((current) => mergeCustomSoundEffects(current, sounds));
				changeSettings({
					...settings,
					customSounds: mergeCustomSoundEffects(settings.customSounds, library, sounds),
					...(kind === "click" ? { mouseClickSound: sounds[0].id } : {}),
					...(kind === "scroll"
						? {
								scrollSounds: Object.fromEntries(
									scrollSlots.map(({ slot }) => [slot, sounds[0].id]),
								) as ZoomSoundEffects["scrollSounds"],
							}
						: {}),
				});
			}
			if (result.errors?.length) toast.warning(result.errors.join("\n"));
			else if (!result.success)
				toast.warning(result.message || "Could not import sound files.");
		} catch {
			toast.warning("Could not import sound files.");
		} finally {
			setImporting(null);
		}
	}
	async function previewClick() {
		clickAudioRef.current?.pause();
		const request = ++clickPreviewRequestRef.current;
		const sound = getMouseClickSoundAsset({ ...settings, customSounds: catalog });
		if (!sound) return;
		try {
			const source = await resolveMediaElementSource(sound.path);
			if (request !== clickPreviewRequestRef.current) {
				source.revoke();
				return;
			}
			const audio = new Audio(source.src);
			audio.volume = mouseClickVolume;
			clickAudioRef.current = audio;
			audio.onerror = () =>
				toast.warning(t("audio.previewFailed", "Could not preview this sound."));
			await audio.play();
		} catch {
			if (request === clickPreviewRequestRef.current)
				toast.warning(t("audio.previewFailed", "Could not preview this sound."));
		}
	}
	useEffect(
		() => () => {
			clickPreviewRequestRef.current += 1;
			clickAudioRef.current?.pause();
			if (clickAudioRef.current) clickAudioRef.current.src = "";
		},
		[],
	);
	useEffect(() => {
		clickPreviewRequestRef.current += 1;
		clickAudioRef.current?.pause();
	}, [settings.mouseClickSound]);

	return (
		<div className="flex flex-col gap-5">
			<h2 className="text-base font-semibold">Sound Effects</h2>
			<section
				aria-label="Zoom whoosh sounds"
				className="flex flex-col gap-3 rounded-xl border border-separator p-3"
			>
				<SliderControl
					label={t("audio.whooshVolume", "Whoosh volume")}
					value={volume}
					min={0}
					max={1}
					step={0.01}
					onChange={changeWhooshVolume}
					formatValue={(value) => `${Math.round(value * 100)}%`}
				/>
				<ZoomSoundEffectsEditor
					settings={settings}
					onChange={changeSettings}
					volume={volume}
					catalog={catalog}
					importing={importing !== null}
					onImport={() => void importSounds("whoosh")}
				/>
			</section>
			<p className="text-xs text-muted-foreground">
				{t(
					"audio.importDescription",
					"Add local audio files up to 60 seconds long. Files are copied into your sound library. Changes take effect immediately.",
				)}
			</p>
			<section
				className="flex flex-col gap-2 rounded-xl border border-separator p-3"
				aria-label="Mouse click sounds"
			>
				<h3 className="text-sm font-semibold">Mouse clicks</h3>
				<Select
					aria-label="Mouse click sound"
					value={settings.mouseClickSound}
					onValueChange={(value) =>
						changeSettings({
							...settings,
							customSounds: catalog,
							mouseClickSound: value as MouseClickSoundChoice,
						})
					}
				>
					<SelectTrigger aria-label="Mouse click sound">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="default-click">
							{t("audio.defaultClick", "Default mouse click")}
						</SelectItem>
						<SelectItem value="none">{t("audio.noSound", "No sound")}</SelectItem>
						{catalog
							.filter((sound) => sound.kind === "click")
							.map((sound) => (
								<SelectItem key={sound.id} value={sound.id}>
									{sound.name}
								</SelectItem>
							))}
					</SelectContent>
				</Select>
				<Button
					variant="secondary"
					size="sm"
					disabled={importing !== null}
					onClick={() => void importSounds("click")}
				>
					{t("audio.addClicks", "Add mouse click files…")}
				</Button>
				<SliderControl
					label={t("audio.mouseClickVolume", "Mouse click volume")}
					value={mouseClickVolume}
					min={0}
					max={1}
					step={0.01}
					onChange={changeMouseClickVolume}
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
					disabled={mouseClickVolume === 0 || settings.mouseClickSound === "none"}
					onClick={() => void previewClick()}
				>
					{t("audio.previewSound", "Preview")}
				</Button>
			</section>
			<section
				aria-label="Scroll sounds"
				className="flex flex-col gap-3 rounded-xl border border-separator p-3"
			>
				<h3 className="text-sm font-semibold">Scrolling</h3>
				<p className="text-xs text-muted-foreground">
					Sounds start with each recorded scroll gesture. A negative delay moves the sound
					earlier; 0 ms follows the scroll event.
				</p>
				<Button
					variant="secondary"
					size="sm"
					disabled={importing !== null}
					onClick={() => void importSounds("scroll")}
				>
					Add scroll sound files…
				</Button>
				<SliderControl
					label="Scroll volume"
					value={settings.scrollVolume}
					min={0}
					max={1}
					step={0.01}
					onChange={(value) => changeSettings({ ...settings, scrollVolume: value })}
					formatValue={(value) => `${Math.round(value * 100)}%`}
				/>
				<SliderControl
					label="Large scroll starts at"
					value={settings.scrollLargeThreshold}
					min={1}
					max={20}
					step={1}
					onChange={(value) =>
						changeSettings({ ...settings, scrollLargeThreshold: value })
					}
					formatValue={(value) => `${value} ticks`}
				/>
				{scrollSlots.map(({ slot, label }) => (
					<div
						key={slot}
						className="flex flex-col gap-2 rounded-lg border border-separator p-2"
					>
						<span className="text-sm font-medium">{label}</span>
						<Select
							aria-label={`${label} sound`}
							value={settings.scrollSounds[slot]}
							onValueChange={(value) =>
								changeSettings({
									...settings,
									customSounds: catalog,
									scrollSounds: {
										...settings.scrollSounds,
										[slot]: value as ScrollSoundChoice,
									},
								})
							}
						>
							<SelectTrigger aria-label={`${label} sound`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default-scroll">Default scroll</SelectItem>
								<SelectItem value="none">No sound</SelectItem>
								{catalog
									.filter((sound) => sound.kind === "scroll")
									.map((sound) => (
										<SelectItem key={sound.id} value={sound.id}>
											{sound.name}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
						<Button
							variant="secondary"
							size="sm"
							disabled={
								settings.scrollSounds[slot] === "none" ||
								settings.scrollVolume === 0
							}
							onClick={() => {
								const sound = getScrollSoundAsset(
									{ ...settings, customSounds: catalog },
									slot,
								);
								if (sound)
									void resolveMediaElementSource(sound.path).then((source) => {
										const audio = new Audio(source.src);
										audio.volume = settings.scrollVolume;
										audio.onended = source.revoke;
										void audio
											.play()
											.catch(() =>
												toast.warning("Could not preview this sound."),
											);
									});
							}}
						>
							Preview
						</Button>
						<SliderControl
							label={`${label} delay`}
							value={settings.scrollDelaysMs[slot]}
							min={-MAX_ZOOM_SOUND_DELAY_MS}
							max={MAX_ZOOM_SOUND_DELAY_MS}
							step={10}
							onChange={(value) =>
								changeSettings({
									...settings,
									scrollDelaysMs: { ...settings.scrollDelaysMs, [slot]: value },
								})
							}
							formatValue={(value) => `${value} ms`}
						/>
						<input
							type="number"
							aria-label={`${label} delay value`}
							className="w-28 rounded border border-separator bg-transparent px-2 py-1 text-sm"
							min={-MAX_ZOOM_SOUND_DELAY_MS}
							max={MAX_ZOOM_SOUND_DELAY_MS}
							step={1}
							value={scrollDelayInputs[slot] ?? settings.scrollDelaysMs[slot]}
							onChange={(event) => {
								setScrollDelayInputs((current) => ({
									...current,
									[slot]: event.target.value,
								}));
								const value = Number(event.target.value);
								if (event.target.value !== "" && Number.isFinite(value))
									changeSettings({
										...settings,
										scrollDelaysMs: {
											...settings.scrollDelaysMs,
											[slot]: Math.round(
												Math.max(
													-MAX_ZOOM_SOUND_DELAY_MS,
													Math.min(MAX_ZOOM_SOUND_DELAY_MS, value),
												),
											),
										},
									});
							}}
							onBlur={() =>
								setScrollDelayInputs((current) => ({
									...current,
									[slot]: undefined,
								}))
							}
						/>
					</div>
				))}
			</section>
		</div>
	);
}
