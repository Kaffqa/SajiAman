import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  captureLiveSamplePhoto,
  requestLiveCameraStream,
  TRAY_PHOTOS,
  type LiveCaptureResult,
} from '../../adapters/cameraAdapter';
import { CivicButton } from '../../components/ui/CivicButton';
import { HairlineCard } from '../../components/ui/HairlineCard';
import { StepHeader } from '../../components/ui/StepHeader';
import { TactileChip } from '../../components/ui/TactileChip';
import { useSajiAman } from '../../context/SajiAmanContext';
import { MENU_CATALOG, SCHOOLS } from '../../data/mockRepository';
import {
  calculateWeakestLink,
  formatHoursId,
  formatWibTime,
} from '../../domain/weakestLinkEngine';
import type { MenuCategory, ProductionInputMode } from '../../types/sajiaman';

const CATEGORY_ORDER: Array<{ key: MenuCategory; label: string }> = [
  { key: 'karbohidrat', label: 'Karbohidrat' },
  { key: 'protein', label: 'Protein' },
  { key: 'sayur', label: 'Sayur' },
  { key: 'buah', label: 'Buah' },
];

export const CreateBatchScreen: React.FC = () => {
  const { simulatedNowMs, createBatch, navigate, showToast } = useSajiAman();

  const [mode, setMode] = useState<ProductionInputMode>('manual');
  const [selectedIds, setSelectedIds] = useState<string[]>([
    'nasi-putih',
    'ayam-goreng',
    'tumis-buncis',
    'pisang-ambon',
  ]);
  const [schoolId, setSchoolId] = useState<string>(SCHOOLS[0].id);
  const [omprengCount, setOmprengCount] = useState<number>(SCHOOLS[0].defaultPortions);

  // AI Camera states
  const [isScanning, setIsScanning] = useState(false);
  const [captureResult, setCaptureResult] = useState<LiveCaptureResult | null>(null);
  const [previewVariant, setPreviewVariant] = useState<'lodeh' | 'soto'>('lodeh');
  const [liveCameraActive, setLiveCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamStopRef = useRef<(() => void) | null>(null);

  const selectedItems = useMemo(
    () => MENU_CATALOG.filter((item) => selectedIds.includes(item.id)),
    [selectedIds]
  );

  const weakestLink = useMemo(
    () => calculateWeakestLink(selectedItems),
    [selectedItems]
  );

  const toggleMenuItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSchoolChange = (nextSchoolId: string) => {
    setSchoolId(nextSchoolId);
    const found = SCHOOLS.find((s) => s.id === nextSchoolId);
    if (found) {
      setOmprengCount(found.defaultPortions);
    }
  };

  const handleActivateDeviceCamera = async () => {
    if (liveCameraActive && streamStopRef.current) {
      streamStopRef.current();
      streamStopRef.current = null;
      setLiveCameraActive(false);
      return;
    }
    const handle = await requestLiveCameraStream(videoRef.current);
    if (handle.isLiveHardware) {
      streamStopRef.current = handle.stop;
      setLiveCameraActive(true);
      showToast('Kamera perangkat aktif — mode bidik langsung', 'info');
    } else {
      setPreviewVariant((v) => (v === 'lodeh' ? 'soto' : 'lodeh'));
      showToast('Menggunakan pratinjau sampel dapur SPPG langsung', 'info');
    }
  };

  const handleCaptureLiveSample = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const result = await captureLiveSamplePhoto(simulatedNowMs, previewVariant);
      setCaptureResult(result);
      setSelectedIds(result.detectedItemIds);
      showToast('Foto sampel AI diverifikasi & komponen gizi terkunci', 'success');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSealBatch = () => {
    if (!weakestLink) return;
    if (streamStopRef.current) {
      streamStopRef.current();
      streamStopRef.current = null;
    }
    const created = createBatch({
      schoolId,
      items: selectedItems,
      omprengCount,
      inputMode: mode === 'ai_camera' && captureResult ? 'ai_camera' : 'manual',
      samplePhotoUrl: captureResult?.photoUrl,
      samplePhotoTimestamp: captureResult?.watermarkText,
      aiVerifiedNutrition: captureResult?.nutritionChecklist,
    });
    if (created) {
      navigate({ name: 'kitchen_batch_qr', batchId: created.id });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F7FA]">
      <StepHeader
        title="Catat Produksi Batch"
        eyebrow="SPPG SEMARANG TENGAH"
        onBack={() => {
          if (streamStopRef.current) {
            streamStopRef.current();
          }
          navigate({ name: 'kitchen_home' });
        }}
        rightSlot={
          <span className="flex flex-row items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#EBF3FA] border border-[#BDD5EB] font-mono text-[11px] font-semibold text-[#0B2E59] tabular-nums">
            <Lock className="w-3 h-3" strokeWidth={2} />
            {formatWibTime(simulatedNowMs)}
          </span>
        }
      />

      {/* Sticky Segmented Mode Switcher */}
      <div className="px-4 py-2.5 bg-white border-b border-[#D8E2EC] shrink-0">
        <div
          role="tablist"
          aria-label="Mode pencatatan produksi"
          className="flex flex-row items-center gap-1 p-1 rounded-[10px] bg-[#EDF2F7]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'manual'}
            onClick={() => setMode('manual')}
            className={`flex-1 min-h-[40px] px-2 rounded-[8px] text-[12px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'manual'
                ? 'bg-white text-[#0B2E59] border border-[#D8E2EC]'
                : 'text-[#475569]'
            }`}
          >
            Mode Cepat Manual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'ai_camera'}
            onClick={() => setMode('ai_camera')}
            className={`flex-1 min-h-[40px] px-2 rounded-[8px] text-[12px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'ai_camera'
                ? 'bg-white text-[#0B2E59] border border-[#D8E2EC]'
                : 'text-[#475569]'
            }`}
          >
            Mode Foto Sampel AI
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <main className="flex-1 overflow-y-auto sajiaman-scroll px-4 pt-4 pb-5 flex flex-col gap-4">
        {mode === 'manual' ? (
          /* Mode 1: Tactile Chef Preset Matrix */
          <div className="flex flex-col gap-4">
            <div className="flex flex-row items-center justify-between text-[11px] text-[#475569]">
              <span className="font-bold uppercase tracking-[0.06em]">
                PILIH KOMPOSISI MENU BATCH
              </span>
              <span className="flex flex-row items-center gap-1.5 font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-[#B45309]" />
                Cepat basi (3,5j)
              </span>
            </div>

            {CATEGORY_ORDER.map(({ key, label }) => {
              const catItems = MENU_CATALOG.filter((m) => m.category === key);
              return (
                <section key={key} className="flex flex-col gap-2">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
                    {label}
                  </h2>
                  <div className="flex flex-row flex-wrap gap-2">
                    {catItems.map((item) => (
                      <div key={item.id} className="w-[calc(50%-4px)]">
                        <TactileChip
                          label={item.name}
                          badgeText={`${formatHoursId(item.holdingHours)}j`}
                          selected={selectedIds.includes(item.id)}
                          isHighRisk={item.isHighRisk}
                          onPress={() => toggleMenuItem(item.id)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          /* Mode 2: Live AI Sample Capture (Zero Gallery Upload) */
          <div className="flex flex-col gap-3">
            {/* Dark 4:3 Hardware Viewfinder */}
            <div className="relative w-full aspect-[4/3] rounded-[12px] overflow-hidden bg-[#0B1220] border border-[#0F4C81]">
              {/* Live video stream OR simulated MBG stainless tray feed */}
              <video
                ref={videoRef}
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover ${
                  liveCameraActive ? 'block' : 'hidden'
                }`}
              />
              {!liveCameraActive ? (
                <img
                  src={
                    captureResult
                      ? captureResult.photoUrl
                      : previewVariant === 'lodeh'
                        ? TRAY_PHOTOS.lodehSet
                        : TRAY_PHOTOS.sotoSet
                  }
                  alt="Pratinjau kamera langsung baki ompreng MBG"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : null}

              {/* Contrast Scrim */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/75 pointer-events-none" />

              {/* Top-left Anti-Tampering Security Lock Badge (NO Gallery Button) */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-row items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#0B1220]/90 border border-[#EF4444]/60 text-[10px] font-mono font-bold tracking-[0.04em] text-white">
                  <Lock className="w-3 h-3 text-[#FCA5A5]" strokeWidth={2.2} />
                  KAMERA LANGSUNG • UNGGAH GALERI NONAKTIF
                </span>
              </div>

              {/* Optical Alignment Corner Brackets */}
              <span className="absolute top-11 left-4 w-5 h-5 border-t-2 border-l-2 border-[#38BDF8]" />
              <span className="absolute top-11 right-4 w-5 h-5 border-t-2 border-r-2 border-[#38BDF8]" />
              <span className="absolute bottom-11 left-4 w-5 h-5 border-b-2 border-l-2 border-[#38BDF8]" />
              <span className="absolute bottom-11 right-4 w-5 h-5 border-b-2 border-r-2 border-[#38BDF8]" />

              {/* Scanning Sweep Line */}
              {isScanning ? (
                <div className="absolute inset-x-4 top-11 bottom-11 overflow-hidden pointer-events-none">
                  <div className="w-full h-[2px] bg-[#38BDF8] scan-line-active" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="px-3 py-1.5 rounded-[8px] bg-[#0B2E59]/95 border border-[#38BDF8] font-mono text-[11px] font-bold text-white">
                      MEMINDAI 4 KOMPONEN GIZI...
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Burned-in Watermark Timestamp after Capture */}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex flex-row items-center justify-between gap-2">
                <span className="px-2 py-1 rounded-[5px] bg-black/80 font-mono text-[10px] font-semibold text-[#86EFAC] tabular-nums">
                  {captureResult
                    ? captureResult.watermarkText
                    : `LIVE • ${formatWibTime(simulatedNowMs, true)}`}
                </span>
                <button
                  type="button"
                  onClick={handleActivateDeviceCamera}
                  className="px-2 py-1 rounded-[5px] bg-black/75 border border-white/25 text-white text-[10px] font-semibold flex flex-row items-center gap-1 cursor-pointer active:bg-black"
                >
                  <RefreshCw className="w-3 h-3" />
                  {liveCameraActive ? 'Simulasi' : 'Ganti Sampel'}
                </button>
              </div>
            </div>

            {/* Capture Shutter Button */}
            <CivicButton
              variant="primary"
              icon={<Camera className="w-5 h-5" strokeWidth={2} />}
              onClick={handleCaptureLiveSample}
              disabled={isScanning}
            >
              {isScanning
                ? 'Memverifikasi Sampel AI...'
                : captureResult
                  ? 'Ambil Ulang Foto Sampel Langsung'
                  : 'Ambil Foto Sampel Langsung'}
            </CivicButton>

            {/* 4-Component Nutrition Verification Strip */}
            {captureResult ? (
              <HairlineCard className="flex flex-col gap-2.5">
                <div className="flex flex-row items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#15803D] flex flex-row items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" strokeWidth={2.2} />
                    VERIFIKASI 4 KOMPONEN GIZI MBG
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#475569]">
                    AI VALID
                  </span>
                </div>
                <div className="flex flex-row flex-wrap gap-2">
                  {(
                    [
                      ['Karbohidrat', captureResult.nutritionChecklist.karbohidrat],
                      ['Protein', captureResult.nutritionChecklist.protein],
                      ['Sayur', captureResult.nutritionChecklist.sayur],
                      ['Buah', captureResult.nutritionChecklist.buah],
                    ] as const
                  ).map(([name, ok]) => (
                    <span
                      key={name}
                      className={`w-[calc(50%-4px)] px-2.5 py-2 rounded-[8px] border text-[12px] font-bold flex flex-row items-center justify-between ${
                        ok
                          ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#14532D]'
                          : 'bg-[#FEF3C7] border-[#FCD34D] text-[#78350F]'
                      }`}
                    >
                      <span>{name}</span>
                      <span>✓</span>
                    </span>
                  ))}
                </div>
                <p className="text-[12px] text-[#475569]">
                  Menu terdeteksi otomatis:{' '}
                  <strong className="text-[#0F172A]">
                    {selectedItems.map((i) => i.name).join(', ')}
                  </strong>
                </p>
              </HairlineCard>
            ) : (
              <div className="rounded-[10px] border border-[#BDD5EB] bg-[#EBF3FA] px-3.5 py-2.5 text-[12px] text-[#0B2E59] leading-[1.45]">
                Foto diambil langsung dari kamera dapur dengan stempel waktu server terkunci. Unggah galeri dinonaktifkan untuk mencegah manipulasi jam masak.
              </div>
            )}
          </div>
        )}

        {/* Logistics & Ompreng Container Block */}
        <HairlineCard className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="school-select"
              className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]"
            >
              SEKOLAH TUJUAN
            </label>
            <select
              id="school-select"
              value={schoolId}
              onChange={(e) => handleSchoolChange(e.target.value)}
              className="min-h-[48px] w-full rounded-[10px] border border-[#94A3B8] bg-white px-3.5 text-[14px] font-semibold text-[#0F172A] focus:outline-none focus:border-[#0F4C81]"
            >
              {SCHOOLS.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} (PIC: {school.picName})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-[#EDF2F7] flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
              JUMLAH OMPRENG STAINLESS
            </span>

            <div className="flex flex-row items-center justify-between gap-3">
              <button
                type="button"
                aria-label="Kurangi 10 ompreng"
                onClick={() => setOmprengCount((c) => Math.max(10, c - 10))}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-[#94A3B8] bg-white text-[#0F172A] active:bg-[#EDF2F7] cursor-pointer"
              >
                <Minus className="w-5 h-5" strokeWidth={2.2} />
              </button>

              <div className="flex-1 flex flex-col items-center justify-center py-1 rounded-[10px] bg-[#F4F7FA] border border-[#D8E2EC]">
                <span
                  data-testid="ompreng-count-value"
                  className="font-mono text-[26px] font-bold text-[#0B2E59] tabular-nums leading-none"
                >
                  {omprengCount}
                </span>
                <span className="text-[11px] font-semibold text-[#475569] mt-0.5">
                  Ompreng Stainless
                </span>
              </div>

              <button
                type="button"
                aria-label="Tambah 10 ompreng"
                onClick={() => setOmprengCount((c) => Math.min(500, c + 10))}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-[#94A3B8] bg-white text-[#0F172A] active:bg-[#EDF2F7] cursor-pointer"
              >
                <Plus className="w-5 h-5" strokeWidth={2.2} />
              </button>
            </div>

            <div className="flex flex-row items-center gap-2">
              {[25, 50, 100].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => setOmprengCount((c) => Math.min(500, c + inc))}
                  className="flex-1 min-h-[40px] rounded-[8px] border border-[#D8E2EC] bg-[#F4F7FA] font-mono text-[12px] font-bold text-[#0F4C81] active:bg-[#EBF3FA] cursor-pointer"
                >
                  +{inc}
                </button>
              ))}
            </div>
          </div>
        </HairlineCard>
      </main>

      {/* Sticky Bottom Action Dock with Live Weakest-Link Rule Strip */}
      <footer className="bg-white border-t border-[#D8E2EC] px-4 pt-3 pb-3.5 shrink-0 flex flex-col gap-2.5">
        {weakestLink ? (
          <div
            data-testid="weakest-link-strip"
            className={`rounded-[10px] border px-3 py-2 flex flex-row items-center justify-between gap-2 ${
              weakestLink.holdingHours <= 3.5
                ? 'bg-[#FEF3C7] border-[#FCD34D] text-[#78350F]'
                : 'bg-[#EBF3FA] border-[#BDD5EB] text-[#0B2E59]'
            }`}
          >
            <div className="flex flex-col min-w-0">
              <div className="flex flex-row items-center gap-1.5">
                {weakestLink.holdingHours <= 3.5 ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                )}
                <span className="font-mono text-[13px] font-bold tabular-nums">
                  Batas Aman: {formatHoursId(weakestLink.holdingHours)} Jam
                </span>
              </div>
              <span className="text-[11px] font-medium truncate mt-0.5">
                {weakestLink.reasonText}
              </span>
            </div>
            <span className="font-mono text-[11px] font-bold shrink-0 px-2 py-0.5 rounded-[5px] bg-white/80 tabular-nums">
              {selectedItems.length} item
            </span>
          </div>
        ) : (
          <div className="rounded-[10px] border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-[12px] font-semibold text-[#7F1D1D]">
            Pilih minimal 1 komponen menu untuk menghitung batas aman konsumsi.
          </div>
        )}

        <CivicButton
          variant="primary"
          icon={<ShieldCheck className="w-5 h-5" strokeWidth={2} />}
          disabled={!weakestLink}
          onClick={handleSealBatch}
        >
          Selesai Masak &amp; Segel Boks
        </CivicButton>
      </footer>
    </div>
  );
};
