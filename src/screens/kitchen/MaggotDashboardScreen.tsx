import React from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardList,
  Leaf,
  MapPin,
  PackageCheck,
  Recycle,
  Truck,
} from 'lucide-react';
import { TRAY_PHOTOS } from '../../adapters/cameraAdapter';
import { BottomTabBar } from '../../components/ui/BottomTabBar';
import { CivicButton } from '../../components/ui/CivicButton';
import { HairlineCard } from '../../components/ui/HairlineCard';
import { MonoCounter } from '../../components/ui/MonoCounter';
import { useSajiAman } from '../../context/SajiAmanContext';
import { KITCHEN_PROFILE } from '../../data/mockRepository';
import { formatWibTime } from '../../domain/weakestLinkEngine';
import type { WasteCategory } from '../../types/sajiaman';

function getCategoryBadge(cat: WasteCategory) {
  if (cat === 'expired_red') {
    return {
      label: 'Kedaluwarsa Merah',
      classes: 'bg-[#FEE2E2] text-[#7F1D1D] border-[#FCA5A5]',
    };
  }
  if (cat === 'surplus_intact') {
    return {
      label: 'Surplus Porsi',
      classes: 'bg-[#FEF3C7] text-[#78350F] border-[#FCD34D]',
    };
  }
  return {
    label: 'Sisa Pasca-Makan',
    classes: 'bg-[#EBF3FA] text-[#0B2E59] border-[#BDD5EB]',
  };
}

export const MaggotDashboardScreen: React.FC = () => {
  const {
    maggotReports,
    totalPlasticsSaved,
    totalOrganicDivertedKg,
    pendingMaggotCount,
    dispatchBsfPartner,
    navigate,
    logoutToRoleSelect,
  } = useSajiAman();

  const formattedPlastics = totalPlasticsSaved.toLocaleString('id-ID');
  const formattedKg = totalOrganicDivertedKg.toFixed(1).replace('.', ',');

  return (
    <div className="flex flex-col h-full bg-[#F4F7FA]">
      <header className="bg-[#0B2E59] text-white px-4 py-3 shrink-0 flex flex-row items-center justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#93C5FD]">
            {KITCHEN_PROFILE.name} • SIRKULAR BSF
          </span>
          <h1 className="text-[17px] font-extrabold tracking-[-0.02em] leading-[1.2] mt-0.5">
            Limbah &amp; Dampak Zero-Waste
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
        {/* Asymmetric 2-Column Environmental Impact Bento */}
        <section
          aria-label="Dampak lingkungan zero-waste"
          className="flex flex-row items-stretch gap-3"
        >
          {/* Left: Dark Navy Card */}
          <div className="flex-1 rounded-[12px] bg-[#0B2E59] text-white p-3.5 flex flex-col justify-between gap-3">
            <div className="flex flex-row items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/10 text-[#86EFAC]">
                <Leaf className="w-4 h-4" strokeWidth={2.2} />
              </span>
              <span className="font-mono text-[10px] font-semibold text-[#93C5FD]">
                0% PLASTIK
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <MonoCounter value={formattedPlastics} size="lg" className="text-white" />
              <span className="text-[11px] leading-[1.35] text-[#CBD5E1] font-medium">
                Kemasan Plastik Sekali Pakai Dicegah
              </span>
            </div>
          </div>

          {/* Right: White Hairline Card with Green Accent */}
          <div className="flex-1 rounded-[12px] bg-white border border-[#D8E2EC] p-3.5 flex flex-col justify-between gap-3">
            <div className="flex flex-row items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#DCFCE7] text-[#15803D]">
                <Recycle className="w-4 h-4" strokeWidth={2.2} />
              </span>
              <span className="font-mono text-[10px] font-semibold text-[#15803D]">
                0 KG TPA
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <MonoCounter
                value={formattedKg}
                unit="kg"
                size="lg"
                className="text-[#15803D]"
              />
              <span className="text-[11px] leading-[1.35] text-[#475569] font-medium">
                Limbah Organik ke Pakan Maggot BSF
              </span>
            </div>
          </div>
        </section>

        {/* Compact Tray Inspection Reference Strip */}
        <HairlineCard className="p-0 overflow-hidden" padded={false}>
          <div className="relative h-[108px] w-full overflow-hidden">
            <img
              src={TRAY_PHOTOS.sotoSet}
              alt="Inspeksi baki ompreng stainless sekat 4"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220]/90 via-[#0B1220]/45 to-transparent" />
            <div className="absolute bottom-2.5 left-3 right-3 flex flex-row items-end justify-between gap-2 text-white">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#93C5FD]">
                  INSPEKSI BAKI &amp; MITRA BIOKONVERSI
                </span>
                <span className="text-[13px] font-bold leading-tight">
                  {KITCHEN_PROFILE.partnerBsfName}
                </span>
              </div>
              <span className="font-mono text-[11px] font-semibold bg-white/15 px-2 py-0.5 rounded-[5px]">
                AUDIT BGN
              </span>
            </div>
          </div>
        </HairlineCard>

        {/* Live Pickup Dispatch Queue */}
        <section className="flex flex-col gap-2.5">
          <div className="flex flex-row items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
              ANTREAN JEMPUT MITRA MAGGOT ({maggotReports.length})
            </h2>
            {pendingMaggotCount > 0 ? (
              <span className="px-2 py-0.5 rounded-[5px] bg-[#FEF3C7] border border-[#FCD34D] text-[#78350F] font-mono text-[10px] font-bold tabular-nums">
                {pendingMaggotCount} MENUNGGU
              </span>
            ) : null}
          </div>

          {maggotReports.map((report) => {
            const cat = getCategoryBadge(report.category);
            const isPending = report.status === 'pending_pickup';

            return (
              <HairlineCard key={report.id} className="flex flex-col gap-3">
                <div className="flex flex-row items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[15px] font-bold text-[#0F172A] truncate">
                      {report.schoolName}
                    </span>
                    <span className="font-mono text-[11px] text-[#475569] tabular-nums mt-0.5">
                      {report.batchId} • {formatWibTime(report.reportedAt)}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-1 rounded-[5px] border text-[10px] font-bold uppercase tracking-[0.04em] whitespace-nowrap shrink-0 ${
                      isPending
                        ? 'bg-[#FEF3C7] text-[#78350F] border-[#FCD34D]'
                        : 'bg-[#DCFCE7] text-[#14532D] border-[#86EFAC]'
                    }`}
                  >
                    {isPending ? 'Siap Dijemput' : 'Dijemput Mitra BSF'}
                  </span>
                </div>

                <div className="flex flex-row items-center justify-between gap-2 bg-[#F4F7FA] border border-[#D8E2EC] rounded-[8px] px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#475569]">
                      ESTIMASI VOLUME
                    </span>
                    <span className="font-mono text-[13px] font-bold text-[#0F172A] tabular-nums">
                      {report.volumeLabel}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-1 rounded-[5px] border text-[10px] font-bold ${cat.classes}`}
                  >
                    {cat.label}
                  </span>
                </div>

                <div className="flex flex-row items-start gap-1.5 text-[12px] text-[#475569]">
                  <MapPin className="w-3.5 h-3.5 text-[#64748B] shrink-0 mt-0.5" />
                  <span className="leading-[1.35]">{report.locationNote}</span>
                </div>

                {isPending ? (
                  <CivicButton
                    variant="primary"
                    size="md"
                    icon={<Truck className="w-4 h-4" strokeWidth={2} />}
                    onClick={() => dispatchBsfPartner(report.id)}
                  >
                    Tugaskan Mitra BSF (Maggot Jaya)
                  </CivicButton>
                ) : (
                  <div className="flex flex-row items-center justify-between rounded-[8px] bg-[#DCFCE7] border border-[#86EFAC] px-3 py-2 text-[11px] font-semibold text-[#14532D]">
                    <span className="flex flex-row items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.2} />
                      {report.assignedPartner ?? KITCHEN_PROFILE.partnerBsfName}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatWibTime(report.dispatchedAt ?? report.reportedAt)}
                    </span>
                  </div>
                )}
              </HairlineCard>
            );
          })}
        </section>
      </main>

      <BottomTabBar
        activeId="maggot"
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
