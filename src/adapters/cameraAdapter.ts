/**
 * Camera Adapter (Strict Native Boundary)
 * // TODO(expo-migration): Swap with `expo-camera` (CameraView + takePictureAsync).
 * Gallery upload is strictly forbidden per SajiAman anti-tampering protocol.
 */

import { formatWibTime } from '../domain/weakestLinkEngine';

export interface LiveCaptureResult {
  photoUrl: string;
  capturedAtMs: number;
  watermarkText: string;
  detectedItemIds: string[];
  nutritionChecklist: {
    karbohidrat: boolean;
    protein: boolean;
    sayur: boolean;
    buah: boolean;
  };
}

export const TRAY_PHOTOS = {
  lodehSet: '/src/assets/images/mbg_tray_lodeh_1795490909814.jpg',
  sotoSet: '/src/assets/images/mbg_tray_soto_1795490911923.jpg',
} as const;

export interface CameraStreamHandle {
  stop: () => void;
  isLiveHardware: boolean;
}

/**
 * Attempts real browser camera access if explicitly requested by operator;
 * otherwise operates seamlessly in simulated SPPG kitchen tray live preview mode.
 */
export async function requestLiveCameraStream(
  videoEl: HTMLVideoElement | null
): Promise<CameraStreamHandle> {
  // TODO(expo-migration): Request permissions via Camera.requestCameraPermissionsAsync()
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia ||
    !videoEl
  ) {
    return { stop: () => {}, isLiveHardware: false };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    return {
      isLiveHardware: true,
      stop: () => {
        stream.getTracks().forEach((track) => track.stop());
      },
    };
  } catch {
    return { stop: () => {}, isLiveHardware: false };
  }
}

/**
 * Captures a live sample frame with burned-in WIB server timestamp and runs
 * simulated AI 4-component nutrition + weakest-link detection.
 */
export async function captureLiveSamplePhoto(
  simulatedNowMs: number,
  variant: 'lodeh' | 'soto' = 'lodeh'
): Promise<LiveCaptureResult> {
  // TODO(expo-migration): Call cameraRef.current.takePictureAsync() and upload to Supabase Storage
  await new Promise((resolve) => setTimeout(resolve, 1150));

  const wibStamp = formatWibTime(simulatedNowMs, true);
  const isLodeh = variant === 'lodeh';

  return {
    photoUrl: isLodeh ? TRAY_PHOTOS.lodehSet : TRAY_PHOTOS.sotoSet,
    capturedAtMs: simulatedNowMs,
    watermarkText: `SPPG SMG • ${wibStamp} • VERIFIED`,
    detectedItemIds: isLodeh
      ? ['nasi-putih', 'ayam-goreng', 'sayur-lodeh', 'pisang-ambon']
      : ['nasi-putih', 'tempe-orek', 'sop-wortel-bakso', 'jeruk-medan'],
    nutritionChecklist: {
      karbohidrat: true,
      protein: true,
      sayur: true,
      buah: true,
    },
  };
}
