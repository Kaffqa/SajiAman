import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  Recycle,
  Sparkles,
} from 'lucide-react';
import { BottomTabBar } from '../../components/ui/BottomTabBar';
import { CivicButton } from '../../components/ui/CivicButton';
import { HairlineCard } from '../../components/ui/HairlineCard';
import { useSajiAman } from '../../context/SajiAmanContext';
import { KITCHEN_PROFILE } from '../../data/mockRepository';
import {
  calculateOmprengTelemetry,
  formatWibTime,
} from '../../domain/weakestLinkEngine';
import type { OmprengCustodyStatus } from '../../types/sajiaman';

type CustodyFilter = 'all' | OmprengCustodyStatus;

export const OmprengTrackerScreen: React.FC = () => {
  const {
    batches,
    simulatedNowMs,
    pendingMaggotCount,
    confirmOmprengReturned,
    navigate,
    logoutToRoleSelect,
  } = useSajiAman();

  const [filter, setFilter] = useState<CustodyFilter>('all');

  const stats = useMemo(
    () => calculateOmprengTelemetry(KITCHEN_PROFILE.totalOmprengInventory, batches),
    [batches]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return batches;
    return batches.filter((b) => b.omprengStatus === filter);
  }, [batches, filter]);

  return (
    <div className="flex flex-col h-full bg-[#F4F7FA]">
      {/* Navy Operational Header */}
      <header className="bg-[#0B2E59] text-white px-4 py-3 shrink-0 flex flex-row items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#93C5FD]">
            {KITCHEN_PROFILE.name} • LOGISTIK
          </span>
          <h1 className="text-[17px] font-extrabold tracking-[-0.02em] leading-[1.2] mt-0.5">
            Sirkulasi Ompreng Stainless
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

      {/* 4-Tile Inventory Summary Strip */}
      <section
        aria-label="Inventaris ompreng"
        className="bg-white border-b border-[#D8E2EC] flex flex-row items-stretch shrink-0"
      >
        {[
          { label: 'Total', value: stats.totalInventory, color: 'text-[#0F172A]' },
          { label: 'Di Dapur', value: stats.inKitchen, color: 'text-[#15803D]' },
          { label: 'Di Sekolah', value: stats.atSchools, color: 'text-[#B45309]' },
          { label: 'Dalam Kirim', value: stats.inTransit, color: 'text-[#0F4C81]' },
        ].map((tile, idx) => (
          <div
            key={tile.label}
            className={`flex-1 py-2.5 px-1.5 flex flex-col items-center justify-center ${
              idx < 3 ? 'border-r border-[#D8E2EC]' : ''
            }`}
          >
            <span className={`font-mono text-[18px] font-bold tabular-nums leading-none ${tile.color}`}>
              {tile.value}
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.04em] text-[#475569] whitespace-nowrap">
              {tile.label}
            </span>
          </div>
        ))}
      </section>

      <main className="flex-1 overflow-y-auto sajiaman-scroll px-4 pt-3.5 pb-5 flex flex-col gap-3.5">
        {/* Filter Chips */}
        <div className="flex flex-row items-center gap-1.5 overflow-x-auto pb-0.5">
          {(
            [
              { id: 'all', label: `Semua (${batches.length})` },
              { id: 'received_school', label: 'Di Sekolah' },
              { id: 'dispatched', label: 'Dalam Kirim' },
              { id: 'returned_sterilized', label: 'Kembali' },
            ] as const
          ).map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-[8px] text-[12px] font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#0F4C81] text-white border border-[#0F4C81]'
                    : 'bg-white text-[#475569] border border-[#D8E2EC]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Per-Batch Custody Stepper Cards */}
        <div className="flex flex-col gap-3">
          {filtered.map((batch) => {
            const stepIndex =
              batch.omprengStatus === 'dispatched'
                ? 1
                : batch.omprengStatus === 'received_school'
                  ? 2
                  : 3;

            const statusBadge =
              batch.omprengStatus === 'returned_sterilized'
                ? {
                    text: 'KEMBALI LENGKAP',
                    classes: 'bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]',
                  }
                : batch.omprengStatus === 'received_school'
                  ? {
                      text: 'DITERIMA SEKOLAH',
                      classes: 'bg-[#FEF3C7] text-[#78350F] border-[#FCD34D]',
                    }
                  : {
                      text: 'DALAM PENGIRIMAN',
                      classes: 'bg-[#EBF3FA] text-[#0B2E59] border-[#BDD5EB]',
                    };

            return (
              <HairlineCard key={batch.id} className="flex flex-col gap-3">
                <div className="flex flex-row items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[15px] font-bold text-[#0F172A] truncate">
                      {batch.schoolName}
                    </span>
                    <div className="flex flex-row items-center gap-2 mt-0.5 text-[11px] font-mono text-[#475569] tabular-nums">
                      <span>{batch.id}</span>
                      <span>•</span>
                      <span className="font-bold text-[#0F4C81]">
                        {batch.omprengCount} unit
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-1 rounded-[5px] border text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap shrink-0 ${statusBadge.classes}`}
                  >
                    {statusBadge.text}
                  </span>
                </div>

                {/* 3-Step Horizontal Custody Pipeline */}
                <div className="rounded-[10px] bg-[#F4F7FA] border border-[#D8E2EC] px-3 py-3">
                  <div className="flex flex-row items-center justify-between">
                    {/* Node 1 */}
                    <div className="flex flex-col items-center gap-1 w-[84px]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F4C81] text-white">
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </span>
                      <span className="text-[10px] font-bold text-[#0F172A] text-center leading-tight">
                        Dikirim Dapur
                      </span>
                    </div>

                    {/* Line 1 -> 2 */}
                    <div
                      className={`flex-1 h-[2px] -mt-4 ${
                        stepIndex >= 2 ? 'bg-[#0F4C81]' : 'bg-[#CBD5E1]'
                      }`}
                    />

                    {/* Node 2 */}
                    <div className="flex flex-col items-center gap-1 w-[84px]">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          stepIndex >= 2
                            ? stepIndex === 3
                              ? 'bg-[#15803D] text-white'
                              : 'bg-[#0F4C81] text-white'
                            : 'bg-white border-2 border-[#94A3B8] text-[#94A3B8]'
                        }`}
                      >
                        {stepIndex >= 2 ? (
                          <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-[#94A3B8]" />
                        )}
                      </span>
                      <span
                        className={`text-[10px] font-bold text-center leading-tight ${
                          stepIndex >= 2 ? 'text-[#0F172A]' : 'text-[#64748B]'
                        }`}
                      >
                        Diterima Sekolah
                      </span>
                    </div>

                    {/* Line 2 -> 3 */}
                    <div
                      className={`flex-1 h-[2px] -mt-4 ${
                        stepIndex >= 3 ? 'bg-[#15803D]' : 'bg-[#CBD5E1]'
                      }`}
                    />

                    {/* Node 3 */}
                    <div className="flex flex-col items-center gap-1 w-[84px]">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          stepIndex >= 3
                            ? 'bg-[#15803D] text-white'
                            : 'bg-white border-2 border-[#CBD5E1] text-[#94A3B8]'
                        }`}
                      >
                        {stepIndex >= 3 ? (
                          <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
                        )}
                      </span>
                      <span
                        className={`text-[10px] font-bold text-center leading-tight ${
                          stepIndex >= 3 ? 'text-[#14532D]' : 'text-[#64748B]'
                        }`}
                      >
                        Kembali &amp; Steril
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contextual Action / Audit Metadata */}
                {batch.omprengStatus === 'received_school' ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] text-[#475569]">
                      Dikonfirmasi {batch.omprengConfirmedBy ?? 'PIC Sekolah'} •{' '}
                      <span className="font-mono tabular-nums">
                        {formatWibTime(batch.omprengConfirmedAt ?? simulatedNowMs)}
                      </span>
                    </span>
                    <CivicButton
                      variant="primary"
                      size="md"
                      icon={<CheckCircle2 className="w-4 h-4" strokeWidth={2} />}
                      onClick={() => confirmOmprengReturned(batch.id)}
                    >
                      Konfirmasi Wadah Kembali Lengkap
                    </CivicButton>
                  </div>
                ) : batch.omprengStatus === 'returned_sterilized' ? (
                  <div className="flex flex-row items-center justify-between text-[11px] text-[#14532D] bg-[#DCFCE7] border border-[#86EFAC] rounded-[8px] px-3 py-2 font-semibold">
                    <span className="flex flex-row items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Kembali &amp; siap sterilisasi mesin cuci
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatWibTime(batch.omprengReturnedAt ?? simulatedNowMs)}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#475569]">
                    Menunggu pemindaian QR dan konfirmasi penerimaan oleh Koordinator Sekolah.
                  </p>
                )}
              </HairlineCard>
            );
          })}
        </div>
      </main>

      <BottomTabBar
        activeId="ompreng"
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
