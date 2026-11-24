import React from 'react';
import { AlertTriangle, Lock, OctagonAlert, ShieldCheck } from 'lucide-react';
import {
  formatCountdown,
  formatExpiredMinutes,
  formatWibTime,
} from '../../domain/weakestLinkEngine';
import type { SafetyEvaluation } from '../../types/sajiaman';

interface TrafficBannerProps {
  evaluation: SafetyEvaluation;
  batchId: string;
  cookedAt: number;
  expiresAt: number;
}

export const TrafficBanner: React.FC<TrafficBannerProps> = ({
  evaluation,
  batchId,
  cookedAt,
  expiresAt,
}) => {
  const isGreen = evaluation.status === 'GREEN';
  const isYellow = evaluation.status === 'YELLOW';

  const bgClass = isGreen
    ? 'bg-[#15803D]'
    : isYellow
      ? 'bg-[#B45309]'
      : 'bg-[#B91C1C]';

  const wellBgClass = isGreen
    ? 'bg-[#14532D]/40 border-white/25'
    : isYellow
      ? 'bg-[#78350F]/45 border-white/25'
      : 'bg-[#7F1D1D]/55 border-white/25';

  const Icon = isGreen ? ShieldCheck : isYellow ? AlertTriangle : OctagonAlert;

  return (
    <section
      aria-label={`Status keamanan pangan ${evaluation.verdictTitle}`}
      className={`flex flex-col items-center px-4 pt-4 pb-5 text-white ${bgClass}`}
    >
      <div className="flex w-full flex-row items-center justify-between mb-3">
        <span className="font-mono text-[12px] font-semibold tracking-[0.04em] bg-black/20 px-2.5 py-1 rounded-[6px] tabular-nums">
          {batchId}
        </span>
        <span className="flex flex-row items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.05em] bg-black/20 px-2.5 py-1 rounded-[6px]">
          <Lock className="w-3 h-3" strokeWidth={2} />
          {evaluation.isExpired ? 'TERKUNCI MUTLAK' : 'WAKTU SERVER'}
        </span>
      </div>

      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#0F172A] mb-2">
        <Icon
          className="w-7 h-7"
          strokeWidth={2.2}
          color={isGreen ? '#15803D' : isYellow ? '#B45309' : '#B91C1C'}
        />
      </div>

      <h1 className="text-[24px] leading-[1.15] font-extrabold tracking-[-0.025em] uppercase text-center">
        {evaluation.verdictTitle}
      </h1>

      <p className="mt-1.5 text-[13px] leading-[1.4] text-white/95 text-center max-w-[320px] font-medium">
        {evaluation.instruction}
      </p>

      {/* Oversized Monospace Countdown Instrument */}
      <div className={`mt-4 w-full rounded-[12px] border px-4 py-3 flex flex-col items-center ${wellBgClass}`}>
        <div className="flex w-full flex-row items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/90">
            {evaluation.isExpired
              ? 'STATUS TERKUNCI SISTEM'
              : isYellow
                ? 'SISA WAKTU SEBELUM KEDALUWARSA'
                : 'SISA WAKTU AMAN KONSUMSI'}
          </span>
          {isYellow ? (
            <span className="font-mono text-[10px] font-bold uppercase bg-white text-[#78350F] px-2 py-0.5 rounded-[5px]">
              &lt; 45 MENIT
            </span>
          ) : evaluation.isExpired ? (
            <span className="font-mono text-[10px] font-bold uppercase bg-white text-[#7F1D1D] px-2 py-0.5 rounded-[5px] tabular-nums">
              LEWAT {formatExpiredMinutes(evaluation.elapsedPastExpiryMs)}
            </span>
          ) : null}
        </div>

        <div
          data-testid="safety-countdown"
          className="font-mono text-[36px] leading-[1.1] font-bold tracking-[-0.02em] tabular-nums mt-0.5"
        >
          {evaluation.isExpired
            ? '00:00:00'
            : formatCountdown(evaluation.remainingMs)}
        </div>

        {evaluation.isExpired ? (
          <div className="mt-1 font-mono text-[12px] font-semibold tracking-[0.02em] text-white/95 tabular-nums">
            KEDALUWARSA • LEWAT {formatCountdown(evaluation.elapsedPastExpiryMs)}
          </div>
        ) : null}

        <div className="mt-2.5 pt-2 border-t border-white/20 w-full flex flex-row items-center justify-between text-[11px] font-mono tabular-nums text-white/90">
          <span>Masak: {formatWibTime(cookedAt)}</span>
          <span>Batas: {formatWibTime(expiresAt)}</span>
        </div>
      </div>
    </section>
  );
};
