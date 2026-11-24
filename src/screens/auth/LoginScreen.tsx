import React from 'react';
import {
  ChefHat,
  ChevronRight,
  Clock,
  Leaf,
  Recycle,
  School,
  ShieldCheck,
} from 'lucide-react';
import { useSajiAman } from '../../context/SajiAmanContext';
import { KITCHEN_PROFILE, SCHOOLS } from '../../data/mockRepository';
import { formatWibTime } from '../../domain/weakestLinkEngine';

export const LoginScreen: React.FC = () => {
  const { selectRole, simulatedNowMs } = useSajiAman();
  const primarySchool = SCHOOLS[0];

  return (
    <div className="flex flex-col h-full bg-[#F4F7FA]">
      {/* Upper Brand Hero Band (~38% height) */}
      <section className="relative bg-[#0B2E59] text-white px-5 pt-7 pb-5 flex flex-col justify-between shrink-0 min-h-[305px] overflow-hidden">
        {/* Subtle Swiss architectural grid lines */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #FFFFFF 1px, transparent 1px), linear-gradient(to bottom, #FFFFFF 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative z-10 flex flex-col">
          <div className="flex flex-row items-center justify-between mb-5">
            <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-[#93C5FD] border border-white/20 bg-white/5 px-2.5 py-1 rounded-[6px]">
              STANDAR SPPG • CLOSED-LOOP
            </span>
            <span className="font-mono text-[11px] font-semibold text-white/85 tabular-nums">
              {formatWibTime(simulatedNowMs)}
            </span>
          </div>

          <div className="flex flex-row items-center gap-3.5">
            {/* Geometric SajiAman Emblem */}
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-[12px] bg-[#0F4C81] border border-white/25">
              <ShieldCheck className="w-7 h-7 text-white" strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-[26px] leading-[1.1] font-extrabold tracking-[-0.025em] text-white">
                SajiAman
              </h1>
              <p className="mt-1 text-[13px] leading-[1.35] text-[#CBD5E1] font-medium">
                Kendali Mutu Pangan &amp; Sirkulasi MBG
              </p>
            </div>
          </div>

          <p className="mt-4 text-[12px] leading-[1.5] text-white/80">
            Sistem operasional penguncian waktu masak, pelacakan ompreng stainless guna ulang, dan jalur biokonversi maggot BSF.
          </p>
        </div>

        {/* 3 Institutional Pillars */}
        <div className="relative z-10 mt-5 pt-3.5 border-t border-white/15 flex flex-row items-center justify-between gap-2 text-[11px] font-semibold text-[#E2E8F0]">
          <span className="flex flex-row items-center gap-1.5 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-[#93C5FD]" strokeWidth={2} />
            Waktu Terkunci
          </span>
          <span className="flex flex-row items-center gap-1.5 whitespace-nowrap">
            <Leaf className="w-3.5 h-3.5 text-[#86EFAC]" strokeWidth={2} />
            0% Plastik
          </span>
          <span className="flex flex-row items-center gap-1.5 whitespace-nowrap">
            <Recycle className="w-3.5 h-3.5 text-[#93C5FD]" strokeWidth={2} />
            Nol Limbah TPA
          </span>
        </div>
      </section>

      {/* Lower Role Entry Sheet */}
      <main className="flex-1 flex flex-col justify-between px-5 pt-6 pb-5 overflow-y-auto sajiaman-scroll">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#475569]">
              PILIH PERAN OPERASIONAL
            </span>
            <p className="text-[13px] text-[#475569] leading-[1.4]">
              Masuk sesuai tugas lapangan hari ini untuk sinkronisasi batch MBG secara langsung.
            </p>
          </div>

          {/* Role Card 1: Kitchen SPPG */}
          <button
            type="button"
            onClick={() => selectRole('kitchen')}
            className="w-full min-h-[104px] rounded-[12px] border border-[#D8E2EC] bg-white p-4 text-left flex flex-col justify-between gap-3 transition-transform duration-150 active:scale-[0.98] active:border-[#0F4C81] hover:border-[#0F4C81] cursor-pointer"
          >
            <div className="flex flex-row items-start justify-between gap-3">
              <div className="flex flex-row items-start gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#EBF3FA] border border-[#BDD5EB] text-[#0F4C81]">
                  <ChefHat className="w-5 h-5" strokeWidth={2} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[16px] font-bold text-[#0F172A] tracking-[-0.015em]">
                    Dapur Penyedia (SPPG)
                  </span>
                  <span className="mt-0.5 text-[13px] leading-[1.4] text-[#475569]">
                    Catat produksi batch, kunci waktu masak, pantau ompreng &amp; maggot
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#64748B] shrink-0 mt-0.5" strokeWidth={2} />
            </div>

            <div className="pt-2.5 border-t border-[#EDF2F7] flex flex-row items-center justify-between text-[12px] font-mono font-semibold text-[#0F4C81]">
              <span className="truncate">
                {KITCHEN_PROFILE.picName} • {KITCHEN_PROFILE.name}
              </span>
              <span className="text-[11px] text-[#475569] shrink-0 ml-2">MASUK</span>
            </div>
          </button>

          {/* Role Card 2: School Coordinator */}
          <button
            type="button"
            onClick={() => selectRole('school')}
            className="w-full min-h-[104px] rounded-[12px] border border-[#D8E2EC] bg-white p-4 text-left flex flex-col justify-between gap-3 transition-transform duration-150 active:scale-[0.98] active:border-[#0F4C81] hover:border-[#0F4C81] cursor-pointer"
          >
            <div className="flex flex-row items-start justify-between gap-3">
              <div className="flex flex-row items-start gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#EBF3FA] border border-[#BDD5EB] text-[#0F4C81]">
                  <School className="w-5 h-5" strokeWidth={2} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[16px] font-bold text-[#0F172A] tracking-[-0.015em]">
                    Koordinator Sekolah
                  </span>
                  <span className="mt-0.5 text-[13px] leading-[1.4] text-[#475569]">
                    Pindai QR boks, cek kelayakan konsumsi, lapor sisa maggot
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#64748B] shrink-0 mt-0.5" strokeWidth={2} />
            </div>

            <div className="pt-2.5 border-t border-[#EDF2F7] flex flex-row items-center justify-between text-[12px] font-mono font-semibold text-[#0F4C81]">
              <span className="truncate">
                {primarySchool.picName} • {primarySchool.name}
              </span>
              <span className="text-[11px] text-[#475569] shrink-0 ml-2">MASUK</span>
            </div>
          </button>
        </div>

        {/* Quiet footer note */}
        <footer className="mt-6 pt-3 border-t border-[#D8E2EC] flex flex-row items-center justify-between text-[11px] font-mono text-[#64748B]">
          <span>Sinkronisasi Waktu Server Aktif</span>
          <span>MBG RI • SPPG</span>
        </footer>
      </main>
    </div>
  );
};
