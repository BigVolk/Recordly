import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { useAppearanceState } from "../state/useAppearanceState";
import { type MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import {
	createEditorHistoryStack,
	type EditorHistorySnapshot,
	recordEditorHistorySnapshot,
	redoEditorHistoryStack,
	resetEditorHistoryStack,
	undoEditorHistoryStack,
} from "../editorHistory";
import { deriveNextId } from "../projectPersistence";
import type { useTimelineState } from "../state/useTimelineState";
import { cloneStructured } from "../videoEditorUtils";

type Input = {
	timeline: ReturnType<typeof useTimelineState>;
	appearance: ReturnType<typeof useAppearanceState>;
	aspectRatio: AspectRatio;
	setAspectRatio: (value: AspectRatio) => void;
	nextZoomIdRef: MutableRefObject<number>;
	nextClipIdRef: MutableRefObject<number>;
	nextAnnotationIdRef: MutableRefObject<number>;
	nextAudioIdRef: MutableRefObject<number>;
	nextAnnotationZIndexRef: MutableRefObject<number>;
};

export function useEditorHistory({
	appearance,
	aspectRatio,
	setAspectRatio,
	timeline,
	nextZoomIdRef,
	nextClipIdRef,
	nextAnnotationIdRef,
	nextAudioIdRef,
	nextAnnotationZIndexRef,
}: Input) {
	const {
		zoomRegions,
		clipRegions,
		speedRegions,
		annotationRegions,
		audioRegions,
		autoCaptions,
		selectedZoomId,
		selectedClipId,
		selectedAnnotationId,
		selectedAudioId,
		setZoomRegions,
		setClipRegions,
		setSpeedRegions,
		setAnnotationRegions,
		setAudioRegions,
		setAutoCaptions,
		setSelectedZoomId,
		setSelectedClipId,
		setSelectedAnnotationId,
		setSelectedAudioId,
	} = timeline;
	const pointerEditRef = useRef(false);
	const pointerRecordedRef = useRef(false);
	useEffect(() => {
		const pointer = () => {
			pointerEditRef.current = true;
			pointerRecordedRef.current = false;
		};
		const key = () => {
			pointerEditRef.current = false;
			pointerRecordedRef.current = false;
		};
		window.addEventListener("pointerdown", pointer, true);
		window.addEventListener("keydown", key, true);
		return () => {
			window.removeEventListener("pointerdown", pointer, true);
			window.removeEventListener("keydown", key, true);
		};
	}, []);
	const historyRef = useRef(createEditorHistoryStack());
	const applyingRef = useRef(false);
	const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false });
	const syncButtons = useCallback(() => {
		const next = {
			canUndo: historyRef.current.past.length > 0,
			canRedo: historyRef.current.future.length > 0,
		};
		setHistoryFlags((current) =>
			current.canUndo === next.canUndo && current.canRedo === next.canRedo ? current : next,
		);
	}, []);
	const buildSnapshot = useCallback(
		(): EditorHistorySnapshot => ({
			settings: {
				appearance: Object.fromEntries(
					Object.entries(appearance).filter(
						([key]) =>
							key !== "resolvedWebcamVideoUrl" &&
							typeof (appearance as unknown as Record<string, unknown>)[
								`set${key[0].toUpperCase()}${key.slice(1)}`
							] === "function",
					),
				),
				timeline: Object.fromEntries(
					[
						"trimRegions",
						"autoCaptionSettings",
						"sourceAudioTrackSettingsByClip",
						"defaultSourceAudioTrackSettings",
					].map((key) => [key, (timeline as unknown as Record<string, unknown>)[key]]),
				),
				aspectRatio,
			},
			zoomRegions,
			clipRegions,
			speedRegions,
			annotationRegions,
			audioRegions,
			autoCaptions,
			selectedZoomId,
			selectedClipId,
			selectedAnnotationId,
			selectedAudioId,
		}),
		[
			appearance,
			timeline,
			aspectRatio,
			zoomRegions,
			clipRegions,
			speedRegions,
			annotationRegions,
			audioRegions,
			autoCaptions,
			selectedZoomId,
			selectedClipId,
			selectedAnnotationId,
			selectedAudioId,
		],
	);
	const applySnapshot = useCallback(
		(snapshot: EditorHistorySnapshot) => {
			applyingRef.current = true;
			const cloned = cloneStructured(snapshot);
			if (cloned.settings) {
				for (const [store, values] of [
					[appearance, cloned.settings.appearance],
					[timeline, cloned.settings.timeline],
				] as const) {
					for (const [key, value] of Object.entries(values)) {
						const setter = (store as unknown as Record<string, unknown>)[
							`set${key[0].toUpperCase()}${key.slice(1)}`
						];
						if (typeof setter === "function")
							(setter as (value: unknown) => void)(value);
					}
				}
				setAspectRatio(cloned.settings.aspectRatio as AspectRatio);
			}
			setZoomRegions(cloned.zoomRegions);
			setClipRegions(cloned.clipRegions);
			setSpeedRegions(cloned.speedRegions);
			setAnnotationRegions(cloned.annotationRegions);
			setAudioRegions(cloned.audioRegions);
			setAutoCaptions(cloned.autoCaptions);
			setSelectedZoomId(cloned.selectedZoomId);
			setSelectedClipId(cloned.selectedClipId);
			setSelectedAnnotationId(cloned.selectedAnnotationId);
			setSelectedAudioId(cloned.selectedAudioId);
			nextZoomIdRef.current = deriveNextId(
				"zoom",
				cloned.zoomRegions.map(({ id }) => id),
			);
			nextClipIdRef.current = deriveNextId(
				"clip",
				cloned.clipRegions.map(({ id }) => id),
			);
			nextAnnotationIdRef.current = deriveNextId(
				"annotation",
				cloned.annotationRegions.map(({ id }) => id),
			);
			nextAudioIdRef.current = deriveNextId(
				"audio",
				cloned.audioRegions.map(({ id }) => id),
			);
			nextAnnotationZIndexRef.current =
				cloned.annotationRegions.reduce((max, region) => Math.max(max, region.zIndex), 0) +
				1;
		},
		[
			appearance,
			timeline,
			setAspectRatio,
			setZoomRegions,
			setClipRegions,
			setSpeedRegions,
			setAnnotationRegions,
			setAudioRegions,
			setAutoCaptions,
			setSelectedZoomId,
			setSelectedClipId,
			setSelectedAnnotationId,
			setSelectedAudioId,
			nextZoomIdRef,
			nextClipIdRef,
			nextAnnotationIdRef,
			nextAudioIdRef,
			nextAnnotationZIndexRef,
		],
	);
	const handleUndo = useCallback(() => {
		recordEditorHistorySnapshot(historyRef.current, buildSnapshot(), {
			coalesce: pointerEditRef.current && pointerRecordedRef.current,
		});
		const previous = undoEditorHistoryStack(historyRef.current, buildSnapshot());
		if (previous) {
			applySnapshot(previous);
			syncButtons();
		}
	}, [applySnapshot, buildSnapshot, syncButtons]);
	const handleRedo = useCallback(() => {
		const next = redoEditorHistoryStack(historyRef.current, buildSnapshot());
		if (next) {
			applySnapshot(next);
			syncButtons();
		}
	}, [applySnapshot, buildSnapshot, syncButtons]);
	const resetHistory = useCallback(() => {
		resetEditorHistoryStack(historyRef.current);
		pointerRecordedRef.current = false;
		applyingRef.current = false;
		syncButtons();
	}, [syncButtons]);

	useEffect(() => {
		const result = recordEditorHistorySnapshot(historyRef.current, buildSnapshot(), {
			applyingHistory: applyingRef.current,
			coalesce: pointerEditRef.current && pointerRecordedRef.current,
		});
		if (result === "recorded") pointerRecordedRef.current = true;
		if (result === "applied") applyingRef.current = false;
		if (result !== "unchanged") syncButtons();
	}, [buildSnapshot, syncButtons]);

	return {
		...historyFlags,
		handleUndo,
		handleRedo,
		resetHistory,
	};
}
