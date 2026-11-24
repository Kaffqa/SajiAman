import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronRight,
  History,
  Keyboard,
  QrCode,
  ScanLine,
  X,
} from 'lucide-react';
import { normalizeScannedBatchCode } from '../../adapters/qrAdapter';
import { BottomTabBar } from '../../components/ui/BottomTabBar';
import { CivicButton } from '../../components/ui/CivicButton';
import { useSajiAman } from '../../context/SajiAmanContext';
import { SCHOOLS } from '../../data/mockRepository';
import {
  evaluateSafetyStatus,
  formatCountdown,
  formatWibTime,
} from '../../domain/weakestLinkEngine';

export const SchoolScannerScreen: React.FC = () => {
  const {
    batches,
    simulatedNowMs,
    navigate,
    logoutToRoleSelect,
    showToast,
  } = useSajiAman();

  const [scanningBatchId, setScanningBatchId] = useState<string | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const primarySchool = SCHOOLS[0];

  const incomingBatches = useMemo(
    () =>
      batches
        .filter((b) => b.omprengStatus !== 'returned_sterilized')
        .map((batch) => ({
          batch,
          evaluation: evaluateSafetyStatus(batch.expiresAt, simulatedNowMs),
        })),
    [batches, simulatedNowMs]
  );

  const triggerScanForBatch = (batchId: string) => {
    if (scanningBatchId) return;
    setScanningBatchId(batchId);
    window.setTimeout(() => {
      setScanningBatchId(null);
      navigate({ name: 'school_safety_check', batchId });
    }, 320);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeScannedBatchCode(manualCode);
    if (!code) {
      showToast('Masukkan kode batch terlebih dahulu', 'warning');
      return;
    }
    const found = batches.find((b) => b.id.toUpperCase() === code);
    if (!found) {
      showToast(`Kode batch ${code} tidak ditemukan pada kiriman hari ini`, 'warning');
      return;
    }
    setShowManualModal(false);
    setManualCode('');
    triggerScanForBatch(found.id);
  };

  return (
    <div className="relative flex flex-col h-full bg-[#0B1220]">
      {/* Top School Header */}
      <header className="bg-[#0B2E59] text-white px-4 py-3 shrink-0 flex flex-row items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[15px] font-bold tracking-[-0.015em] truncate">
            {primarySchool.name}
          </span>
          <span className="text-[11px] font-medium text-[#CBD5E1]">
            Koordinator: {primarySchool.picName}
          </span>
        </div>

        <div className="flex flex-row items-center gap-2 shrink-0">
          <span className="px-2.5 py-1.5 rounded-[8px] bg-white/10 border border-white/15 font-mono text-[12px] font-semibold tabular-nums">
            {formatWibTime(simulatedNowMs)}
          </span>
          <button
            type="button"
            onClick={logoutToRoleSelect}
            aria-label="Ganti peran operasional"
            className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/10 border border-white/15 text-white active:bg-white/20 cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Top Dark Precision Scanner Viewfinder (~42% height) */}
      <section
        aria-label="Pemindai QR Boks MBG"
        className="relative bg-[#0B1220] px-5 pt-4 pb-5 flex flex-col items-center justify-center shrink-0 min-h-[268px]"
      >
        {/* Subtle technical grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #38BDF8 1px, transparent 1px), linear-gradient(to bottom, #38BDF8 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Viewfinder Reticle Box */}
        <div className="relative w-[178px] h-[150px] flex items-center justify-center">
          <span className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-[#38BDF8] rounded-tl-[4px]" />
          <span className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-[#38BDF8] rounded-tr-[4px]" />
          <span className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-[#38BDF8] rounded-bl-[4px]" />
          <span className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-[#38BDF8] rounded-br-[4px]" />

          {/* Scanning horizontal beam */}
          <div className="absolute inset-x-3 top-3 bottom-3 overflow-hidden pointer-events-none">
            <div className="w-full h-[2px] bg-[#38BDF8] scan-line-active" />
          </div>

          {scanningBatchId ? (
            <div className="z-10 px-3 py-1.5 rounded-[8px] bg-[#15803D] text-white font-mono text-[11px] font-bold tracking-[0.04em]">
              QR TERKUNCI • {scanningBatchId}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-white/75">
              <ScanLine className="w-7 h-7 text-[#38BDF8]" strokeWidth={1.75} />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#93C5FD]">
                SIAP PINDAI 1-DETIK
              </span>
            </div>
          )}
        </div>

        <p className="relative z-10 mt-3 text-[12px] text-[#CBD5E1] text-center max-w-[280px] leading-[1.35]">
          Arahkan kamera ke Kode QR pada boks utama MBG
        </p>

        <button
          type="button"
          onClick={() => setShowManualModal(true)}
          className="relative z-10 mt-2.5 inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-[8px] bg-white/10 border border-white/20 text-white text-[12px] font-semibold active:bg-white/20 cursor-pointer"
        >
          <Keyboard className="w-3.5 h-3.5 text-[#38BDF8]" strokeWidth={2} />
          Input Kode Manual
        </button>
      </section>

      {/* Anchored Light Bottom Sheet: Incoming Boxes for 1-Tap Demo Scanning */}
      <main className="flex-1 bg-[#F4F7FA] rounded-t-[20px] flex flex-col overflow-hidden">
        <div className="px-4 pt-3.5 pb-2.5 border-b border-[#D8E2EC] bg-white rounded-t-[20px] shrink-0">
          <div className="mx-auto w-9 h-1 rounded-full bg-[#CBD5E1] mb-2.5" />
          <div className="flex flex-row items-center justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#0B2E59]">
              SIMULASI PINDAI QR — BOKS MASUK HARI INI
            </h2>
            <span className="font-mono text-[11px] font-bold text-[#475569] tabular-nums">
              {incomingBatches.length} Boks
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[#475569]">
            Ketuk salah satu batch untuk simulasi hasil pindai instan
          </p>
        </div>

        <div className="flex-1 overflow-y-auto sajiaman-scroll px-4 pt-3 pb-4 flex flex-col gap-2.5">
          {incomingBatches.map(({ batch, evaluation }) => {
            const isGreen = evaluation.status === 'GREEN';
            const isYellow = evaluation.status === 'YELLOW';

            const accentBar = isGreen
              ? 'bg-[#15803D]'
              : isYellow
                ? 'bg-[#B45309]'
                : 'bg-[#B91C1C]';

            const pillClasses = isGreen
              ? 'bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]'
              : isYellow
                ? 'bg-[#FEF3C7] text-[#78350F] border-[#FCD34D]'
                : 'bg-[#FEE2E2] text-[#7F1D1D] border-[#FCA5A5]';

            const timerText = isGreen
              ? 'text-[#15803D]'
              : isYellow
                ? 'text-[#B45309]'
                : 'text-[#B91C1C]';

            return (
              <button
                key={batch.id}
                type="button"
                onClick={() => triggerScanForBatch(batch.id)}
                className="w-full rounded-[12px] border border-[#D8E2EC] bg-white overflow-hidden text-left flex flex-row transition-transform duration-150 active:scale-[0.98] hover:border-[#0F4C81] cursor-pointer"
              >
                <span className={`w-1 shrink-0 ${accentBar}`} aria-hidden="true" />
                <div className="flex-1 p-3 flex flex-col gap-1.5 min-w-0">
                  <div className="flex flex-row items-center justify-between gap-2">
                    <span className="font-mono text-[13px] font-bold text-[#0F172A] tabular-nums">
                      {batch.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-[5px] border text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap ${pillClasses}`}
                    >
                      {evaluation.verdictBadge}
                    </span>
                  </div>

                  <div className="flex flex-row items-center justify-between gap-2 text-[12px]">
                    <span className="font-semibold text-[#0F172A] truncate">
                      {batch.schoolName}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#475569] shrink-0 tabular-nums">
                      {batch.omprengCount} Ompreng
                    </span>
                  </div>

                  <div className="flex flex-row items-center justify-between gap-2 pt-1 border-t border-[#EDF2F7]">
                    <span className={`font-mono text-[12px] font-bold tabular-nums ${timerText}`}>
                      {evaluation.isExpired
                        ? 'KEDALUWARSA • TERKUNCI'
                        : `${formatCountdown(evaluation.remainingMs)} tersisa`}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#0F4C81]">
                      Pindai
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* School Bottom Tab Bar */}
      <BottomTabBar
        activeId="pindai"
        onSelect={(id) => {
          if (id === 'pindai') navigate({ name: 'school_scanner' });
          if (id === 'riwayat') navigate({ name: 'school_history' });
        }}
        tabs={[
          {
            id: 'pindai',
            label: 'Pindai QR',
            icon: <QrCode className="w-5 h-5" strokeWidth={1.85} />,
          },
          {
            id: 'riwayat',
            label: 'Riwayat Boks',
            icon: <History className="w-5 h-5" strokeWidth={1.85} />,
          },
        ]}
      />

      {/* Manual Batch Code Modal Sheet */}
      {showManualModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Input Kode Batch Manual"
          className="absolute inset-0 z-40 bg-black/60 flex items-end justify-center p-3"
        >
          <form
            onSubmit={handleManualSubmit}
            className="w-full rounded-[14px] bg-white border border-[#D8E2EC] p-4 flex flex-col gap-3"
          >
            <div className="flex flex-row items-center justify-between">
              <span className="text-[15px] font-bold text-[#0F172A]">
                Input Kode Batch Manual
              </span>
              <button
                type="button"
                aria-label="Tutup dialog"
                onClick={() => setShowManualModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#F4F7FA] text-[#475569] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="manual-batch-code"
                className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#475569]"
              >
                KODE SEGEL BOKS (CONTOH: MBG-2411-G01)
              </label>
              <input
                id="manual-batch-code"
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="MBG-2411-G01"
                className="min-h-[48px] w-full rounded-[10px] border border-[#94A3B8] px-3.5 font-mono text-[14px] font-semibold uppercase text-[#0F172A] focus:outline-none focus:border-[#0F4C81]"
              />
            </div>

            <CivicButton type="submit" variant="primary" size="md">
              Cek Kelayakan Batch
            </CivicButton>
          </form>
        </div>
      ) : null}
    </div>
  );
};
