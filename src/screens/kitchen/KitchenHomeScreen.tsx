import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronRight,
  ClipboardList,
  PackageCheck,
  PlusCircle,
  Recycle,
} from 'lucide-react';
import { BottomTabBar } from '../../components/ui/BottomTabBar';
import { CivicButton } from '../../components/ui/CivicButton';
import { useSajiAman } from '../../context/SajiAmanContext';
import { KITCHEN_PROFILE } from '../../data/mockRepository';
import {
  calculateOmprengTelemetry,
  evaluateSafetyStatus,
  formatCountdown,
  formatHoursId,
  formatWibTime,
} from '../../domain/weakestLinkEngine';

type BatchFilter = 'all' | 'safe' | 'critical';

export const KitchenHomeScreen: React.FC = () => {
  const {
    batches,
    simulatedNowMs,
    pendingMaggotCount,
    navigate,
    logoutToRoleSelect,
  } = useSajiAman();

  const [filter, setFilter] = useState<BatchFilter>('all');

  const omprengStats = useMemo(
    () => calculateOmprengTelemetry(KITCHEN_PROFILE.totalOmprengInventory, batches),
    [batches]
  );

  const evaluatedBatches = useMemo(
    () =>
      batches.map((batch) => ({
        batch,
        evaluation: evaluateSafetyStatus(batch.expiresAt, simulatedNowMs),
      })),
    [batches, simulatedNowMs]
  );

  const filteredBatches = useMemo(() => {
    if (filter === 'safe') {
      return evaluatedBatches.filter((x) => x.evaluation.status === 'GREEN');
    }
    if (filter === 'critical') {
      return evaluatedBatches.filter(
        (x) => x.evaluation.status === 'YELLOW' || x.evaluation.status === 'RED'
      );
    }
    return evaluatedBatches;
  }, [evaluatedBatches, filter]);

  const activeBatchCount = batches.filter(
    (b) => b.omprengStatus !== 'returned_sterilized'
  ).length;

  return (
    <div className="flex flex-col h-full bg-[#F4F7FA]">
      {/* Compact Navy Operational Header */}
      <header className="bg-[#0B2E59] text-white px-4 py-3 shrink-0 flex flex-row items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[15px] font-bold tracking-[-0.015em] truncate">
            {KITCHEN_PROFILE.name}
          </span>
          <div className="flex flex-row items-center gap-1.5 mt-0.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[#22C55E]" />
            <span className="text-[11px] font-medium text-[#CBD5E1]">
              Server Waktu Sinkron
            </span>
          </div>
        </div>

        <div className="flex flex-row items-center gap-2 shrink-0">
          <div className="px-2.5 py-1.5 rounded-[8px] bg-white/10 border border-white/15 font-mono text-[12px] font-semibold tabular-nums">
            {formatWibTime(simulatedNowMs, true)}
          </div>
          <button
            type="button"
            onClick={logoutToRoleSelect}
            aria-label="Ganti peran operasional"
            title="Ganti peran"
            className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-white/10 border border-white/15 text-white active:bg-white/20 cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Flush 3-Column Hairline Telemetry Strip */}
      <section
        aria-label="Ringkasan operasional dapur"
        className="bg-white border-b border-[#D8E2EC] flex flex-row items-stretch shrink-0"
      >
        <div className="flex-1 py-3 px-3 flex flex-col items-center justify-center border-r border-[#D8E2EC]">
          <span className="font-mono text-[22px] font-bold text-[#0F172A] tabular-nums leading-none">
            {activeBatchCount}
          </span>
          <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569] whitespace-nowrap">
            Batch Aktif
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigate({ name: 'kitchen_ompreng' })}
          className="flex-1 py-3 px-3 flex flex-col items-center justify-center border-r border-[#D8E2EC] active:bg-[#F4F7FA] cursor-pointer"
        >
          <span className="font-mono text-[22px] font-bold text-[#0F4C81] tabular-nums leading-none">
            {omprengStats.outOfKitchen}
          </span>
          <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569] whitespace-nowrap">
            Ompreng Keluar
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate({ name: 'kitchen_maggot' })}
          className="flex-1 py-3 px-3 flex flex-col items-center justify-center active:bg-[#F4F7FA] cursor-pointer"
        >
          <span
            className={`font-mono text-[22px] font-bold tabular-nums leading-none ${
              pendingMaggotCount > 0 ? 'text-[#B45309]' : 'text-[#0F172A]'
            }`}
          >
            {pendingMaggotCount}
          </span>
          <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569] whitespace-nowrap">
            Jemput Maggot
          </span>
        </button>
      </section>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto sajiaman-scroll px-4 pt-4 pb-5 flex flex-col gap-4">
        {/* Primary CTA */}
        <CivicButton
          variant="primary"
          icon={<PlusCircle className="w-5 h-5" strokeWidth={2} />}
          onClick={() => navigate({ name: 'kitchen_create_batch' })}
        >
          Catat Produksi Batch Baru
        </CivicButton>

        {/* Active Batches Ledger */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-row items-center justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
              BATCH PRODUKSI HARI INI ({batches.length})
            </h2>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-row items-center gap-2">
            {(
              [
                { id: 'all', label: `Semua (${batches.length})` },
                {
                  id: 'safe',
                  label: `Aman (${evaluatedBatches.filter((x) => x.evaluation.status === 'GREEN').length})`,
                },
                {
                  id: 'critical',
                  label: `Kritis/Merah (${evaluatedBatches.filter((x) => x.evaluation.status !== 'GREEN').length})`,
                },
              ] as const
            ).map((opt) => {
              const active = filter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilter(opt.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-[8px] text-[12px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0F4C81] text-white border border-[#0F4C81]'
                      : 'bg-white text-[#475569] border border-[#D8E2EC] active:bg-[#EDF2F7]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Dense Batch Rows */}
          {filteredBatches.length === 0 ? (
            <div className="rounded-[12px] border border-[#D8E2EC] bg-white p-6 text-center">
              <p className="text-[13px] font-semibold text-[#475569]">
                Tidak ada batch pada kategori filter ini.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredBatches.map(({ batch, evaluation }) => {
                const isGreen = evaluation.status === 'GREEN';
                const isYellow = evaluation.status === 'YELLOW';

                const leftBarColor = isGreen
                  ? 'bg-[#15803D]'
                  : isYellow
                    ? 'bg-[#B45309]'
                    : 'bg-[#B91C1C]';

                const badgeClasses = isGreen
                  ? 'bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]'
                  : isYellow
                    ? 'bg-[#FEF3C7] text-[#78350F] border-[#FCD34D]'
                    : 'bg-[#FEE2E2] text-[#7F1D1D] border-[#FCA5A5]';

                const countdownTextColor = isGreen
                  ? 'text-[#15803D]'
                  : isYellow
                    ? 'text-[#B45309]'
                    : 'text-[#B91C1C]';

                const menuSummary = batch.items.map((i) => i.name).join(', ');

                return (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() =>
                      navigate({ name: 'kitchen_batch_qr', batchId: batch.id })
                    }
                    className="relative w-full rounded-[12px] border border-[#D8E2EC] bg-white overflow-hidden text-left flex flex-row transition-transform duration-150 active:scale-[0.99] hover:border-[#94A3B8] cursor-pointer"
                  >
                    {/* 4px Solid Left Semantic Safety Bar */}
                    <span className={`w-1 shrink-0 ${leftBarColor}`} aria-hidden="true" />

                    <div className="flex-1 p-3.5 flex flex-col gap-2 min-w-0">
                      {/* Top Row */}
                      <div className="flex flex-row items-center justify-between gap-2">
                        <span className="text-[15px] font-bold text-[#0F172A] truncate">
                          {batch.schoolName}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-[#475569] bg-[#EDF2F7] px-2 py-0.5 rounded-[5px] shrink-0 tabular-nums">
                          {batch.id}
                        </span>
                      </div>

                      {/* Middle Row: Menu Summary + Weakest Link + Ompreng */}
                      <p className="text-[12px] text-[#475569] truncate">{menuSummary}</p>

                      <div className="flex flex-row items-center justify-between gap-2 text-[11px]">
                        <span className="text-[#475569] font-medium truncate">
                          Terentan:{' '}
                          <strong className="font-semibold text-[#0F172A]">
                            {batch.weakestLinkItemName}
                          </strong>{' '}
                          • <span className="font-mono">{formatHoursId(batch.holdingHours)}j</span>
                        </span>
                        <span className="font-mono font-semibold text-[#0F4C81] shrink-0 tabular-nums">
                          {batch.omprengCount} Ompreng
                        </span>
                      </div>

                      {/* Bottom Row: Live Ticking Countdown + Status Tag */}
                      <div className="pt-2 border-t border-[#EDF2F7] flex flex-row items-center justify-between gap-2">
                        <span
                          className={`font-mono text-[13px] font-bold tabular-nums ${countdownTextColor}`}
                        >
                          {evaluation.isExpired
                            ? 'KEDALUWARSA'
                            : `${formatCountdown(evaluation.remainingMs)} tersisa`}
                        </span>

                        <div className="flex flex-row items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-[0.05em] px-2 py-0.5 rounded-[5px] border ${badgeClasses}`}
                          >
                            {evaluation.verdictBadge}
                          </span>
                          <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Role-Scoped Kitchen Bottom Navigation */}
      <BottomTabBar
        activeId="produksi"
        onSelect={(id) => {
          if (id === 'produksi') navigate({ name: 'kitchen_home' });
          if (id === 'ompreng') navigate({ name: 'kitchen_ompreng' });
          if (id === 'maggot') navigate({ name: 'kitchen_maggot' });
        }}
        tabs={[
          {
            id: 'produksi',
            label: 'Produksi',
            icon: <ClipboardList className="w-5 h-5" strokeWidth={1.85} />,
          },
          {
            id: 'ompreng',
            label: 'Ompreng',
            icon: <PackageCheck className="w-5 h-5" strokeWidth={1.85} />,
          },
          {
            id: 'maggot',
            label: 'Maggot',
            icon: <Recycle className="w-5 h-5" strokeWidth={1.85} />,
            badgeCount: pendingMaggotCount,
          },
        ]}
      />
    </div>
  );
};
