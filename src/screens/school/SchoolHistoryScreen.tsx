import React from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronRight,
  History,
  QrCode,
  Recycle,
} from 'lucide-react';
import { BottomTabBar } from '../../components/ui/BottomTabBar';
import { HairlineCard } from '../../components/ui/HairlineCard';
import { useSajiAman } from '../../context/SajiAmanContext';
import { SCHOOLS } from '../../data/mockRepository';
import { evaluateSafetyStatus, formatWibTime } from '../../domain/weakestLinkEngine';

export const SchoolHistoryScreen: React.FC = () => {
  const {
    batches,
    maggotReports,
    simulatedNowMs,
    navigate,
    logoutToRoleSelect,
  } = useSajiAman();

  const primarySchool = SCHOOLS[0];
  const acceptedBatches = batches.filter(
    (b) => b.omprengStatus === 'received_school' || b.omprengStatus === 'returned_sterilized'
  );

  return (
    <div className="flex flex-col h-full bg-[#F4F7FA]">
      <header className="bg-[#0B2E59] text-white px-4 py-3 shrink-0 flex flex-row items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#93C5FD]">
            {primarySchool.name} • LOG HARIAN
          </span>
          <h1 className="text-[17px] font-extrabold tracking-[-0.02em] leading-[1.2] mt-0.5">
            Riwayat Boks &amp; Lapor Sisa
          </h1>
        </div>
        <button
          type="button"
          onClick={logoutToRoleSelect}
          aria-label="Ganti peran operasional"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white/10 border border-white/15 text-white active:bg-white/20 cursor-pointer"
        >
          <ArrowLeftRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto sajiaman-scroll px-4 pt-4 pb-5 flex flex-col gap-4">
        {/* Accepted Batches Section */}
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
            BOKS DITERIMA SEKOLAH ({acceptedBatches.length})
          </h2>

          {acceptedBatches.length === 0 ? (
            <HairlineCard>
              <p className="text-[13px] text-[#475569] text-center py-2">
                Belum ada boks yang dikonfirmasi penerimaannya hari ini.
              </p>
            </HairlineCard>
          ) : (
            acceptedBatches.map((batch) => {
              const ev = evaluateSafetyStatus(batch.expiresAt, simulatedNowMs);
              return (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() =>
                    navigate({ name: 'school_safety_check', batchId: batch.id })
                  }
                  className="w-full rounded-[12px] border border-[#D8E2EC] bg-white p-3.5 text-left flex flex-col gap-2 active:bg-[#F4F7FA] cursor-pointer"
                >
                  <div className="flex flex-row items-center justify-between gap-2">
                    <span className="font-mono text-[13px] font-bold text-[#0F172A] tabular-nums">
                      {batch.id}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#15803D]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {batch.omprengCount} Ompreng
                    </span>
                  </div>
                  <div className="flex flex-row items-center justify-between text-[12px] text-[#475569]">
                    <span className="truncate font-semibold text-[#0F172A]">
                      {batch.schoolName}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums shrink-0 ml-2">
                      {ev.verdictBadge}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#EDF2F7] flex flex-row items-center justify-between text-[11px]">
                    <span className="text-[#475569]">
                      Dikonfirmasi {formatWibTime(batch.omprengConfirmedAt ?? batch.cookedAt)}
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-bold text-[#0F4C81]">
                      Buka Detail
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </section>

        {/* Submitted Maggot Reports Section */}
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
            LAPORAN JALUR MAGGOT BSF ({maggotReports.length})
          </h2>

          {maggotReports.map((report) => {
            const isPending = report.status === 'pending_pickup';
            return (
              <HairlineCard key={report.id} className="flex flex-col gap-2">
                <div className="flex flex-row items-center justify-between gap-2">
                  <span className="flex flex-row items-center gap-1.5 font-mono text-[12px] font-bold text-[#0F172A]">
                    <Recycle className="w-3.5 h-3.5 text-[#15803D]" />
                    {report.batchId}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-[5px] border text-[10px] font-bold uppercase ${
                      isPending
                        ? 'bg-[#FEF3C7] text-[#78350F] border-[#FCD34D]'
                        : 'bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]'
                    }`}
                  >
                    {isPending ? 'Siap Dijemput' : 'Dijemput Mitra BSF'}
                  </span>
                </div>
                <div className="flex flex-row items-center justify-between text-[12px]">
                  <span className="font-semibold text-[#0F172A]">{report.schoolName}</span>
                  <span className="font-mono font-bold text-[#0F4C81] tabular-nums">
                    {report.volumeLabel}
                  </span>
                </div>
                <p className="text-[11px] text-[#475569]">{report.locationNote}</p>
              </HairlineCard>
            );
          })}
        </section>
      </main>

      <BottomTabBar
        activeId="riwayat"
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
    </div>
  );
};
