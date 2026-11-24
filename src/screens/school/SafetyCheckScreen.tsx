import React, { useMemo } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  Recycle,
  ShieldAlert,
  Thermometer,
  Truck,
} from 'lucide-react';
import { CivicButton } from '../../components/ui/CivicButton';
import { HairlineCard } from '../../components/ui/HairlineCard';
import { StepHeader } from '../../components/ui/StepHeader';
import { TrafficBanner } from '../../components/ui/TrafficBanner';
import { useSajiAman } from '../../context/SajiAmanContext';
import {
  evaluateSafetyStatus,
  formatHoursId,
  formatWibTime,
} from '../../domain/weakestLinkEngine';

interface SafetyCheckScreenProps {
  batchId: string;
}

export const SafetyCheckScreen: React.FC<SafetyCheckScreenProps> = ({
  batchId,
}) => {
  const {
    batches,
    simulatedNowMs,
    confirmOmprengReceived,
    navigate,
  } = useSajiAman();

  const batch = batches.find((b) => b.id === batchId) ?? batches[0];

  const evaluation = useMemo(() => {
    if (!batch) return null;
    return evaluateSafetyStatus(batch.expiresAt, simulatedNowMs);
  }, [batch, simulatedNowMs]);

  if (!batch || !evaluation) {
    return (
      <div className="flex flex-col h-full bg-[#F4F7FA] items-center justify-center p-6">
        <p className="text-[14px] font-semibold text-[#475569]">
          Data batch tidak ditemukan.
        </p>
        <div className="mt-4 w-full max-w-[220px]">
          <CivicButton onClick={() => navigate({ name: 'school_scanner' })}>
            Kembali ke Pemindai
          </CivicButton>
        </div>
      </div>
    );
  }

  const isRed = evaluation.status === 'RED';
  const isOmprengConfirmed =
    batch.omprengStatus === 'received_school' ||
    batch.omprengStatus === 'returned_sterilized';

  return (
    <div className="flex flex-col h-full bg-[#F4F7FA]">
      <StepHeader
        title="Hasil Verifikasi Boks"
        eyebrow="PROTOKOL KEAMANAN MBG"
        onBack={() => navigate({ name: 'school_scanner' })}
        rightSlot={
          <span className="font-mono text-[11px] font-bold px-2 py-1 rounded-[6px] bg-[#EBF3FA] text-[#0B2E59] border border-[#BDD5EB] tabular-nums">
            {formatWibTime(simulatedNowMs)}
          </span>
        }
      />

      <main className="flex-1 overflow-y-auto sajiaman-scroll flex flex-col">
        {/* Full-Bleed Top Traffic-Light Decision Header (GREEN / YELLOW / RED) */}
        <TrafficBanner
          evaluation={evaluation}
          batchId={batch.id}
          cookedAt={batch.cookedAt}
          expiresAt={batch.expiresAt}
        />

        <div className="px-4 py-4 flex flex-col gap-3.5">
          {/* Primary Decision Actions */}
          {isRed ? (
            /* STATE C — HARD LOCK */
            <section
              aria-label="Kunci distribusi kedaluwarsa"
              className="flex flex-col gap-3"
            >
              {/* Visibly LOCKED / DISABLED bar */}
              <div
                data-testid="hard-lock-bar"
                className="min-h-[48px] rounded-[10px] border border-[#FCA5A5] bg-[#FEE2E2] px-3.5 py-2.5 flex flex-row items-center justify-center gap-2 text-[#B91C1C]"
              >
                <Lock className="w-4 h-4 shrink-0" strokeWidth={2.2} />
                <span className="text-[13px] font-bold">
                  Distribusi ke Siswa Dikunci Sistem
                </span>
              </div>

              <HairlineCard className="border-[#FCA5A5] bg-[#FFF5F5] flex flex-col gap-2">
                <div className="flex flex-row items-center gap-1.5 text-[#B91C1C] font-bold text-[13px]">
                  <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={2.2} />
                  Instruksi Keselamatan Wajib
                </div>
                <ol className="text-[12px] text-[#7F1D1D] leading-[1.45] list-decimal pl-4 flex flex-col gap-1">
                  <li>
                    Jangan buka segel boks untuk dikonsumsi siswa kelas manapun.
                  </li>
                  <li>
                    Segera alihkan seluruh porsi boks ke jalur pakan maggot (BSF) agar tidak terbuang ke TPA.
                  </li>
                </ol>
              </HairlineCard>

              <CivicButton
                variant="danger"
                icon={<Recycle className="w-5 h-5" strokeWidth={2} />}
                onClick={() =>
                  navigate({
                    name: 'school_waste_report',
                    batchId: batch.id,
                    presetCategory: 'expired_red',
                  })
                }
              >
                Alihkan ke Jalur Pakan Maggot (BSF)
              </CivicButton>
            </section>
          ) : (
            /* STATE A (GREEN) or STATE B (YELLOW) */
            <section className="flex flex-col gap-2.5">
              {isOmprengConfirmed ? (
                <div
                  data-testid="ompreng-confirmed-badge"
                  className="min-h-[52px] rounded-[10px] border border-[#86EFAC] bg-[#DCFCE7] px-4 py-3 flex flex-row items-center justify-between gap-2 text-[#14532D]"
                >
                  <span className="flex flex-row items-center gap-2 text-[13px] font-bold">
                    <CheckCircle2 className="w-5 h-5 shrink-0" strokeWidth={2.2} />
                    ✓ {batch.omprengCount} Ompreng Dikonfirmasi Masuk
                  </span>
                  <span className="font-mono text-[11px] font-semibold tabular-nums">
                    {formatWibTime(batch.omprengConfirmedAt ?? simulatedNowMs)}
                  </span>
                </div>
              ) : (
                <CivicButton
                  variant="primary"
                  icon={<ClipboardCheck className="w-5 h-5" strokeWidth={2} />}
                  onClick={() => confirmOmprengReceived(batch.id)}
                >
                  Konfirmasi Terima {batch.omprengCount} Ompreng Stainless
                </CivicButton>
              )}

              <CivicButton
                variant="secondary"
                size="md"
                icon={<Recycle className="w-4 h-4" strokeWidth={2} />}
                onClick={() =>
                  navigate({
                    name: 'school_waste_report',
                    batchId: batch.id,
                    presetCategory: 'post_meal',
                  })
                }
              >
                Lapor Sisa Pasca-Makan (Jalur Maggot)
              </CivicButton>
            </section>
          )}

          {/* Batch Audit & Visual Evidence Card */}
          <HairlineCard className="flex flex-col gap-3">
            <div className="flex flex-row items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569] whitespace-nowrap shrink-0">
                BUKTI SAMPEL DAPUR
              </span>
              <span className="text-[11px] font-semibold text-[#0F4C81] truncate text-right">
                {batch.kitchenName}
              </span>
            </div>

            {/* Live Kitchen Photo Proof or Manual Chef Badge */}
            {batch.samplePhotoUrl ? (
              <div className="flex flex-row items-center gap-3">
                <div className="relative w-24 h-20 rounded-[8px] overflow-hidden border border-[#CBD5E1] shrink-0">
                  <img
                    src={batch.samplePhotoUrl}
                    alt="Foto sampel dapur terkunci"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 right-1 bg-black/80 text-white font-mono text-[9px] font-bold px-1 py-0.5 rounded-[3px] text-center truncate tabular-nums">
                    LIVE {formatWibTime(batch.cookedAt).replace(' WIB', '')}
                  </span>
                </div>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <span className="text-[14px] font-bold text-[#0F172A] leading-snug">
                    {batch.schoolName}
                  </span>
                  <span className="text-[11px] font-semibold text-[#15803D] flex flex-row items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Foto Sampel AI Terverifikasi
                  </span>
                  <span className="font-mono text-[11px] text-[#475569] tabular-nums">
                    {batch.omprengCount} Ompreng • {batch.boxNumber}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-[8px] bg-[#EBF3FA] border border-[#BDD5EB] px-3 py-2.5 flex flex-row items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-[#0B2E59]">
                    {batch.schoolName}
                  </span>
                  <span className="text-[11px] font-semibold text-[#0F4C81]">
                    Dicatat via Mode Cepat Chef
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-[#0B2E59] tabular-nums">
                  {batch.omprengCount} Ompreng
                </span>
              </div>
            )}

            {/* 2-Column Time Audit */}
            <div className="flex flex-row rounded-[8px] border border-[#D8E2EC] bg-[#F4F7FA]">
              <div className="flex-1 p-2.5 border-r border-[#D8E2EC] flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Selesai Masak
                </span>
                <span className="font-mono text-[13px] font-bold text-[#0F172A] tabular-nums">
                  {formatWibTime(batch.cookedAt)}
                </span>
              </div>
              <div className="flex-1 p-2.5 flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  Batas Aman ({formatHoursId(batch.holdingHours)}j)
                </span>
                <span className="font-mono text-[13px] font-bold text-[#B45309] tabular-nums">
                  {formatWibTime(batch.expiresAt)}
                </span>
              </div>
            </div>

            {/* Menu List with Weakest-Link Component Highlighted */}
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                KOMPOSISI MENU BATCH
              </span>
              <div className="flex flex-col gap-1.5">
                {batch.items.map((item) => {
                  const isWeakest = item.id === batch.weakestLinkItemId;
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-row items-center justify-between gap-2 px-2.5 py-2 rounded-[8px] border text-[12px] ${
                        isWeakest
                          ? 'bg-[#FEF3C7] border-[#FCD34D] text-[#78350F]'
                          : 'bg-white border-[#EDF2F7] text-[#0F172A]'
                      }`}
                    >
                      <span className="font-semibold truncate">{item.name}</span>
                      <div className="flex flex-row items-center gap-1.5 shrink-0">
                        {isWeakest ? (
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-[#78350F] text-white text-[9px] font-bold uppercase tracking-[0.04em]">
                            Penentu Batas Waktu
                          </span>
                        ) : null}
                        <span className="font-mono text-[11px] font-bold tabular-nums">
                          {formatHoursId(item.holdingHours)}j
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Logistics Footnote */}
            <div className="pt-2.5 border-t border-[#EDF2F7] flex flex-row items-center justify-between text-[11px] text-[#475569]">
              <span className="flex flex-row items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-[#64748B]" />
                Tiba: {formatWibTime(batch.arrivedAt ?? batch.cookedAt + 45 * 60 * 1000)}
              </span>
              <span className="flex flex-row items-center gap-1 font-mono font-semibold text-[#0F172A] tabular-nums">
                <Thermometer className="w-3.5 h-3.5 text-[#0F4C81]" />
                Suhu Dapur: {batch.kitchenTempC}°C
              </span>
            </div>
          </HairlineCard>
        </div>
      </main>
    </div>
  );
};
