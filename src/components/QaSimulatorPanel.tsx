import React from 'react';
import {
  ChefHat,
  Clock,
  RotateCcw,
  School,
  SlidersHorizontal,
} from 'lucide-react';
import { useSajiAman } from '../context/SajiAmanContext';
import { formatWibTime, MS_PER_HOUR } from '../domain/weakestLinkEngine';

const CLOCK_JUMPS = [
  { label: '+30m', deltaMs: 30 * 60 * 1000 },
  { label: '+1 Jam', deltaMs: 1 * MS_PER_HOUR },
  { label: '+3 Jam', deltaMs: 3 * MS_PER_HOUR },
  { label: '+3.5 Jam', deltaMs: 3.5 * MS_PER_HOUR },
  { label: '+4.5 Jam', deltaMs: 4.5 * MS_PER_HOUR },
];

export const QaSimulatorPanel: React.FC = () => {
  const {
    role,
    simulatedNowMs,
    clockOffsetMs,
    shiftClockByMs,
    resetClock,
    selectRole,
    resetDemoData,
  } = useSajiAman();

  const offsetMinutes = Math.round(clockOffsetMs / 60000);
  const offsetDisplay =
    offsetMinutes === 0
      ? '+0 mnt'
      : offsetMinutes >= 60
        ? `+${(offsetMinutes / 60).toFixed(1).replace('.0', '')} jam`
        : `+${offsetMinutes} mnt`;

  return (
    <aside
      aria-label="SajiAman QA & Clock Simulator"
      className="hidden md:flex flex-col w-[300px] shrink-0 rounded-[16px] border border-[#CBD5E1] bg-white p-4 gap-4 self-start"
    >
      {/* Header */}
      <div className="flex flex-row items-center justify-between border-b border-[#D8E2EC] pb-3">
        <div className="flex flex-row items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#0B2E59] text-white">
            <SlidersHorizontal className="w-4 h-4" strokeWidth={2} />
          </span>
          <div className="flex flex-col">
            <h2 className="text-[13px] font-extrabold text-[#0F172A] tracking-[-0.01em]">
              SajiAman QA &amp; Clock Simulator
            </h2>
            <span className="text-[11px] text-[#475569]">
              Uji siklus 4 jam &amp; sinkronisasi peran
            </span>
          </div>
        </div>
      </div>

      {/* Live Simulated Server Time */}
      <div className="rounded-[10px] bg-[#0B2E59] text-white p-3 flex flex-col gap-1">
        <div className="flex flex-row items-center justify-between text-[10px] font-bold uppercase tracking-[0.07em] text-[#93C5FD]">
          <span className="flex flex-row items-center gap-1">
            <Clock className="w-3 h-3" />
            WAKTU SERVER SIMULASI
          </span>
          <span className="font-mono text-[#86EFAC]">{offsetDisplay}</span>
        </div>
        <span
          data-testid="qa-simulated-clock"
          className="font-mono text-[22px] font-bold tabular-nums tracking-[-0.02em]"
        >
          {formatWibTime(simulatedNowMs, true)}
        </span>
      </div>

      {/* Clock Offset Controls */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#475569]">
          LOMPATAN JAM SISTEM
        </span>
        <div className="flex flex-row flex-wrap gap-1.5">
          <button
            type="button"
            onClick={resetClock}
            className="min-h-[38px] px-2.5 py-1.5 rounded-[8px] border border-[#94A3B8] bg-[#F4F7FA] text-[12px] font-bold text-[#0F172A] active:bg-[#EDF2F7] cursor-pointer"
          >
            Reset Jam
          </button>
          {CLOCK_JUMPS.map((jump) => (
            <button
              key={jump.label}
              type="button"
              onClick={() => shiftClockByMs(jump.deltaMs)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-[8px] border border-[#BDD5EB] bg-[#EBF3FA] font-mono text-[12px] font-bold text-[#0B2E59] active:bg-[#D7E8F8] cursor-pointer"
            >
              {jump.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-[1.4] text-[#64748B]">
          Buka batch HIJAU di Sekolah lalu klik <strong>+3 Jam</strong> /{' '}
          <strong>+4.5 Jam</strong> untuk melihat transisi live HIJAU → KUNING → MERAH.
        </p>
      </div>

      {/* Quick Role Switcher */}
      <div className="flex flex-col gap-2 pt-2 border-t border-[#D8E2EC]">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#475569]">
          PINDAH PERAN CEPAT
        </span>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => selectRole('kitchen')}
            className={`min-h-[42px] px-3 py-2 rounded-[8px] border text-[12px] font-bold flex flex-row items-center gap-2 cursor-pointer ${
              role === 'kitchen'
                ? 'bg-[#0F4C81] border-[#0F4C81] text-white'
                : 'bg-white border-[#D8E2EC] text-[#0F172A] hover:border-[#0F4C81]'
            }`}
          >
            <ChefHat className="w-4 h-4 shrink-0" />
            Masuk Dapur (SPPG)
          </button>
          <button
            type="button"
            onClick={() => selectRole('school')}
            className={`min-h-[42px] px-3 py-2 rounded-[8px] border text-[12px] font-bold flex flex-row items-center gap-2 cursor-pointer ${
              role === 'school'
                ? 'bg-[#0F4C81] border-[#0F4C81] text-white'
                : 'bg-white border-[#D8E2EC] text-[#0F172A] hover:border-[#0F4C81]'
            }`}
          >
            <School className="w-4 h-4 shrink-0" />
            Masuk Sekolah
          </button>
        </div>
      </div>

      {/* Reset Demo Data */}
      <div className="pt-2 border-t border-[#D8E2EC]">
        <button
          type="button"
          onClick={resetDemoData}
          className="w-full min-h-[42px] px-3 py-2 rounded-[8px] border border-[#FCA5A5] bg-[#FEE2E2] text-[#7F1D1D] text-[12px] font-bold flex flex-row items-center justify-center gap-2 active:bg-[#FECACA] cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Data Demo
        </button>
      </div>
    </aside>
  );
};
