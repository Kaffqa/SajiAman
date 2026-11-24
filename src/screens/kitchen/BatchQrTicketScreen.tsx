import React from 'react';
import { CheckCircle2, Home, Lock, Printer } from 'lucide-react';
import { CivicButton } from '../../components/ui/CivicButton';
import { QrCodeSvg } from '../../components/ui/QrCodeSvg';
import { StepHeader } from '../../components/ui/StepHeader';
import { useSajiAman } from '../../context/SajiAmanContext';
import { formatHoursId, formatWibTime } from '../../domain/weakestLinkEngine';

interface BatchQrTicketScreenProps {
  batchId: string;
}

export const BatchQrTicketScreen: React.FC<BatchQrTicketScreenProps> = ({
  batchId,
}) => {
  const { batches, navigate, showToast } = useSajiAman();
  const batch = batches.find((b) => b.id === batchId) ?? batches[0];

  if (!batch) {
    return (
      <div className="flex flex-col h-full bg-[#F4F7FA] items-center justify-center p-6">
        <p className="text-[14px] font-semibold text-[#475569]">
          Data batch tidak ditemukan.
        </p>
        <div className="mt-4 w-full max-w-[220px]">
          <CivicButton onClick={() => navigate({ name: 'kitchen_home' })}>
            Kembali ke Dasbor
          </CivicButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#E2E8F0]">
      <StepHeader
        title="Segel Boks Berhasil"
        eyebrow="VERIFIKASI KEAMANAN MBG"
        onBack={() => navigate({ name: 'kitchen_home' })}
        rightSlot={
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-[#DCFCE7] border border-[#86EFAC] font-mono text-[11px] font-bold text-[#14532D]">
            <Lock className="w-3 h-3" strokeWidth={2.2} />
            TERKUNCI
          </span>
        }
      />

      <main className="flex-1 overflow-y-auto sajiaman-scroll px-4 pt-4 pb-5">
        {/* Physical Thermal Dispatch Ticket */}
        <article className="rounded-[12px] border border-[#94A3B8] bg-white overflow-hidden">
          {/* Deep Navy Header Strip */}
          <div className="bg-[#0B2E59] text-white px-4 py-3 flex flex-row items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#93C5FD]">
              LABEL SEGEL BOKS MBG
            </span>
            <span className="font-mono text-[12px] font-bold bg-white/15 px-2 py-0.5 rounded-[5px] tabular-nums">
              {batch.id}
            </span>
          </div>

          {/* Target School & Ompreng Bar */}
          <div className="px-4 py-3.5 border-b border-[#D8E2EC] flex flex-col gap-2">
            <div className="flex flex-row items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <h2 className="text-[18px] font-extrabold text-[#0F172A] tracking-[-0.02em] leading-[1.2]">
                  {batch.schoolName}
                </h2>
                <span className="mt-0.5 text-[12px] text-[#475569]">
                  Dari: {batch.kitchenName} • {batch.boxNumber}
                </span>
              </div>
            </div>

            <div className="inline-flex self-start items-center px-2.5 py-1 rounded-[6px] bg-[#0B2E59] text-white font-mono text-[11px] font-bold tracking-[0.04em] tabular-nums">
              {batch.omprengCount} OMPRENG STAINLESS
            </div>
          </div>

          {/* Centered Monochrome SVG QR Code Zone */}
          <div className="px-4 py-5 flex flex-col items-center justify-center bg-white">
            <div className="relative p-3 rounded-[10px] border border-[#D8E2EC] bg-white">
              <span className="absolute -top-[1px] -left-[1px] w-3 h-3 border-t-2 border-l-2 border-[#0B2E59]" />
              <span className="absolute -top-[1px] -right-[1px] w-3 h-3 border-t-2 border-r-2 border-[#0B2E59]" />
              <span className="absolute -bottom-[1px] -left-[1px] w-3 h-3 border-b-2 border-l-2 border-[#0B2E59]" />
              <span className="absolute -bottom-[1px] -right-[1px] w-3 h-3 border-b-2 border-r-2 border-[#0B2E59]" />
              <QrCodeSvg value={batch.id} size={172} />
            </div>

            <span className="mt-3 font-mono text-[15px] font-bold tracking-[0.14em] text-[#0F172A] tabular-nums">
              {batch.id}
            </span>
            <p className="mt-1 text-[12px] text-[#475569] text-center max-w-[260px]">
              Pindai di sekolah sebelum dibagikan ke siswa
            </p>
          </div>

          {/* Dashed Perforation Tear-Line with Semicircular Side Notches */}
          <div className="relative flex flex-row items-center">
            <span
              aria-hidden="true"
              className="-ml-2.5 h-5 w-5 rounded-full bg-[#E2E8F0] border-r border-[#94A3B8] shrink-0"
            />
            <div className="flex-1 border-t-2 border-dashed border-[#CBD5E1]" />
            <span
              aria-hidden="true"
              className="-mr-2.5 h-5 w-5 rounded-full bg-[#E2E8F0] border-l border-[#94A3B8] shrink-0"
            />
          </div>

          {/* 2x2 Anti-Tampering Audit Grid */}
          <div className="flex flex-col border-b border-[#D8E2EC]">
            <div className="flex flex-row border-b border-[#D8E2EC]">
              <div className="flex-1 p-3 border-r border-[#D8E2EC] flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  WAKTU MASAK TERKUNCI
                </span>
                <span className="flex flex-row items-center gap-1 font-mono text-[14px] font-bold text-[#0F172A] tabular-nums">
                  <Lock className="w-3.5 h-3.5 text-[#0F4C81]" strokeWidth={2.2} />
                  {formatWibTime(batch.cookedAt)}
                </span>
              </div>

              <div className="flex-1 p-3 flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  BATAS AMAN KONSUMSI
                </span>
                <span className="font-mono text-[14px] font-bold text-[#B45309] tabular-nums">
                  {formatWibTime(batch.expiresAt)}
                </span>
              </div>
            </div>

            <div className="flex flex-row">
              <div className="flex-1 p-3 border-r border-[#D8E2EC] flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  ATURAN TERENTAN
                </span>
                <span className="text-[12px] font-bold text-[#0F172A]">
                  {formatHoursId(batch.holdingHours)} Jam ({batch.weakestLinkRiskLabel})
                </span>
              </div>

              <div className="flex-1 p-3 flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                  MODE INPUT
                </span>
                <span className="flex flex-row items-center gap-1 text-[12px] font-bold text-[#15803D]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                  {batch.inputMode === 'ai_camera' ? 'Foto AI Valid' : 'Manual Chef'}
                </span>
              </div>
            </div>
          </div>

          {/* Menu Proof & Optional AI Sample Photo */}
          <div className="p-3.5 bg-[#F4F7FA] flex flex-row items-center gap-3">
            {batch.samplePhotoUrl ? (
              <img
                src={batch.samplePhotoUrl}
                alt="Thumbnail sampel baki ompreng dapur"
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-[8px] object-cover border border-[#CBD5E1] shrink-0"
              />
            ) : null}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                KOMPOSISI MENU TERSEGEL
              </span>
              <p className="mt-0.5 text-[12px] leading-[1.4] font-semibold text-[#0F172A]">
                {batch.items.map((item) => item.name).join(', ')}
              </p>
            </div>
          </div>
        </article>
      </main>

      {/* Action Footer */}
      <footer className="bg-white border-t border-[#D8E2EC] px-4 py-3 shrink-0 flex flex-row items-center gap-2.5">
        <div className="flex-[1.25] min-w-0">
          <CivicButton
            variant="primary"
            size="md"
            className="px-3 text-[13px]"
            icon={<Printer className="w-4 h-4" strokeWidth={2} />}
            onClick={() =>
              showToast('Label QR siap cetak thermal 80mm', 'success')
            }
          >
            Cetak / Simpan QR
          </CivicButton>
        </div>
        <div className="flex-1 min-w-0">
          <CivicButton
            variant="secondary"
            size="md"
            className="px-3 text-[13px]"
            icon={<Home className="w-4 h-4" strokeWidth={2} />}
            onClick={() => navigate({ name: 'kitchen_home' })}
          >
            Ke Dasbor
          </CivicButton>
        </div>
      </footer>
    </div>
  );
};
