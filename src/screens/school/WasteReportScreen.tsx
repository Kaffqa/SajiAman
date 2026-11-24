import React, { useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  Package,
  Recycle,
  Truck,
} from 'lucide-react';
import { CivicButton } from '../../components/ui/CivicButton';
import { HairlineCard } from '../../components/ui/HairlineCard';
import { StepHeader } from '../../components/ui/StepHeader';
import { useSajiAman } from '../../context/SajiAmanContext';
import { KITCHEN_PROFILE, WASTE_VOLUME_PRESETS } from '../../data/mockRepository';
import { evaluateSafetyStatus, formatWibTime } from '../../domain/weakestLinkEngine';
import type { MaggotReport, WasteCategory, WasteVolumePreset } from '../../types/sajiaman';

interface WasteReportScreenProps {
  batchId: string;
  presetCategory?: WasteCategory;
}

const CATEGORIES: Array<{ id: WasteCategory; label: string; desc: string }> = [
  {
    id: 'post_meal',
    label: 'Sisa Pasca-Makan',
    desc: 'Sisa piring siswa',
  },
  {
    id: 'surplus_intact',
    label: 'Surplus Porsi Utuh',
    desc: 'Porsi tak terbagi',
  },
  {
    id: 'expired_red',
    label: 'Kedaluwarsa (Status Merah)',
    desc: 'Melewati batas aman',
  },
];

export const WasteReportScreen: React.FC<WasteReportScreenProps> = ({
  batchId,
  presetCategory,
}) => {
  const { batches, simulatedNowMs, submitMaggotReport, navigate } = useSajiAman();
  const batch = batches.find((b) => b.id === batchId) ?? batches[0];

  const evaluation = batch
    ? evaluateSafetyStatus(batch.expiresAt, simulatedNowMs)
    : null;

  const initialCategory: WasteCategory =
    presetCategory ?? (evaluation?.status === 'RED' ? 'expired_red' : 'post_meal');

  const [category, setCategory] = useState<WasteCategory>(initialCategory);
  const [volumeId, setVolumeId] = useState<WasteVolumePreset['id']>(
    initialCategory === 'expired_red' ? 'surplus_penuh' : 'sedang'
  );
  const [locationNote, setLocationNote] = useState('');
  const [submittedReport, setSubmittedReport] = useState<MaggotReport | null>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const created = submitMaggotReport({
      batchId: batch.id,
      category,
      volumePresetId: volumeId,
      locationNote,
    });
    if (created) {
      setSubmittedReport(created);
    }
  };

  if (submittedReport) {
    return (
      <div className="flex flex-col h-full bg-[#F4F7FA]">
        <StepHeader
          title="Laporan Sisa Terkirim"
          eyebrow="JALUR BIOKONVERSI MAGGOT BSF"
          onBack={() => navigate({ name: 'school_scanner' })}
        />

        <main className="flex-1 overflow-y-auto sajiaman-scroll px-4 pt-6 pb-5 flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-4">
            <HairlineCard className="border-[#86EFAC] bg-[#DCFCE7] flex flex-col items-center text-center gap-2.5 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#15803D] text-white">
                <CheckCircle2 className="w-7 h-7" strokeWidth={2.2} />
              </div>
              <h2 className="text-[18px] font-extrabold text-[#14532D] tracking-[-0.02em]">
                Laporan Terkirim ke {KITCHEN_PROFILE.name}
              </h2>
              <p className="text-[13px] font-semibold text-[#14532D] max-w-[290px]">
                Status: Siap Dijemput Mitra Maggot BSF
              </p>
            </HairlineCard>

            <HairlineCard className="flex flex-col gap-2.5">
              <div className="flex flex-row items-center justify-between text-[12px]">
                <span className="text-[#475569]">Nomor Tiket Jemput</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {submittedReport.id}
                </span>
              </div>
              <div className="flex flex-row items-center justify-between text-[12px]">
                <span className="text-[#475569]">Batch Terkait</span>
                <span className="font-mono font-bold text-[#0F4C81]">
                  {submittedReport.batchId}
                </span>
              </div>
              <div className="flex flex-row items-center justify-between text-[12px]">
                <span className="text-[#475569]">Estimasi Volume</span>
                <span className="font-mono font-bold text-[#15803D]">
                  {submittedReport.volumeLabel}
                </span>
              </div>
              <div className="flex flex-row items-center justify-between text-[12px]">
                <span className="text-[#475569]">Waktu Lapor</span>
                <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                  {formatWibTime(submittedReport.reportedAt)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#EDF2F7] text-[12px] text-[#475569]">
                Lokasi: <strong className="text-[#0F172A]">{submittedReport.locationNote}</strong>
              </div>
            </HairlineCard>
          </div>

          <div className="flex flex-col gap-2.5">
            <CivicButton
              variant="primary"
              onClick={() => navigate({ name: 'school_scanner' })}
            >
              Kembali ke Pemindai QR
            </CivicButton>
            <CivicButton
              variant="secondary"
              size="md"
              onClick={() => navigate({ name: 'school_history' })}
            >
              Lihat Riwayat Laporan Sekolah
            </CivicButton>
          </div>
        </main>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-[#F4F7FA]">
      <StepHeader
        title="Lapor Sisa & Surplus"
        eyebrow="KORLAP SEKOLAH • ~15 DETIK"
        onBack={() =>
          navigate({ name: 'school_safety_check', batchId: batch.id })
        }
      />

      {/* Batch Reference Strip */}
      <div className="bg-[#EBF3FA] border-b border-[#BDD5EB] px-4 py-2.5 shrink-0 flex flex-row items-center justify-between gap-2">
        <div className="flex flex-row items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-[#0F4C81] shrink-0" />
          <span className="font-mono text-[12px] font-bold text-[#0B2E59] truncate">
            {batch.id} • {batch.schoolName}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-[5px] text-[10px] font-bold uppercase shrink-0 ${
            evaluation.status === 'RED'
              ? 'bg-[#FEE2E2] text-[#7F1D1D] border border-[#FCA5A5]'
              : evaluation.status === 'YELLOW'
                ? 'bg-[#FEF3C7] text-[#78350F] border border-[#FCD34D]'
                : 'bg-[#DCFCE7] text-[#14532D] border border-[#86EFAC]'
          }`}
        >
          {evaluation.verdictBadge}
        </span>
      </div>

      <main className="flex-1 overflow-y-auto sajiaman-scroll px-4 pt-4 pb-5 flex flex-col gap-4">
        {/* Section 1: 3 Tactile Category Pills */}
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
            1. KATEGORI LAPORAN
          </span>
          <div className="flex flex-col gap-2">
            {CATEGORIES.map((cat) => {
              const selected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategory(cat.id)}
                  className={`min-h-[48px] px-3.5 py-2.5 rounded-[10px] text-left flex flex-row items-center justify-between gap-2 transition-colors cursor-pointer ${
                    selected
                      ? cat.id === 'expired_red'
                        ? 'bg-[#FEE2E2] border-2 border-[#B91C1C] text-[#7F1D1D]'
                        : 'bg-[#EBF3FA] border-2 border-[#0F4C81] text-[#0B2E59]'
                      : 'bg-white border border-[#D8E2EC] text-[#0F172A]'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold leading-tight">
                      {cat.label}
                    </span>
                    <span className="text-[11px] opacity-80">{cat.desc}</span>
                  </div>
                  <span
                    className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selected
                        ? cat.id === 'expired_red'
                          ? 'border-[#B91C1C] bg-[#B91C1C]'
                          : 'border-[#0F4C81] bg-[#0F4C81]'
                        : 'border-[#94A3B8] bg-white'
                    }`}
                  >
                    {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: 2x2 Tactile Volume Selector Grid */}
        <section className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
            2. ESTIMASI VOLUME PRAKTIS (TANPA TIMBANGAN)
          </span>
          <div className="flex flex-row flex-wrap gap-2.5">
            {WASTE_VOLUME_PRESETS.map((preset) => {
              const selected = volumeId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setVolumeId(preset.id)}
                  className={`w-[calc(50%-5px)] min-h-[88px] rounded-[12px] p-3 text-left flex flex-col justify-between transition-transform duration-150 active:scale-[0.98] cursor-pointer ${
                    selected
                      ? 'bg-[#EBF3FA] border-2 border-[#0F4C81] text-[#0B2E59]'
                      : 'bg-white border border-[#D8E2EC] text-[#0F172A]'
                  }`}
                >
                  <div className="flex flex-row items-center justify-between">
                    <span className="text-[14px] font-extrabold tracking-[-0.01em]">
                      {preset.title}
                    </span>
                    <Recycle
                      className={`w-4 h-4 ${
                        selected ? 'text-[#0F4C81]' : 'text-[#94A3B8]'
                      }`}
                    />
                  </div>
                  <span className="font-mono text-[12px] font-bold text-[#0F4C81] tabular-nums">
                    {preset.unitLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 3: Optional Single-Line Note */}
        <section className="flex flex-col gap-1.5">
          <label
            htmlFor="waste-location-note"
            className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569] flex flex-row items-center gap-1"
          >
            <MapPin className="w-3.5 h-3.5" />
            3. CATATAN SINGKAT LOKASI (OPSIONAL)
          </label>
          <input
            id="waste-location-note"
            type="text"
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
            placeholder="Titip di pos satpam dekat gerbang utama"
            className="min-h-[48px] w-full rounded-[10px] border border-[#94A3B8] bg-white px-3.5 text-[13px] font-medium text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:border-[#0F4C81]"
          />
        </section>

        <div className="rounded-[10px] border border-[#86EFAC] bg-[#DCFCE7] px-3.5 py-2.5 text-[12px] text-[#14532D] leading-[1.4]">
          Sinkronisasi otomatis: Laporan langsung masuk antrean{' '}
          <strong>&ldquo;Siap Dijemput Mitra Maggot&rdquo;</strong> di dasbor{' '}
          {KITCHEN_PROFILE.name}.
        </div>
      </main>

      {/* Pinned Submit CTA */}
      <footer className="bg-white border-t border-[#D8E2EC] px-4 py-3 shrink-0">
        <CivicButton
          type="submit"
          variant="primary"
          icon={<Truck className="w-5 h-5" strokeWidth={2} />}
        >
          Kirim &amp; Panggil Penjemputan Maggot
        </CivicButton>
      </footer>
    </form>
  );
};
