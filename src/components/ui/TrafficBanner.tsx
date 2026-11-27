import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Lock, OctagonAlert, ShieldCheck } from 'lucide-react-native';
import {
  formatCountdown,
  formatExpiredMinutes,
  formatWibTime,
} from '../../domain/weakestLinkEngine';
import type { SafetyEvaluation } from '../../types/sajiaman';
import { CircularGaugeSvg } from './CircularGaugeSvg';
import { PulseDot } from './PulseDot';

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
  const iconColor = isGreen ? '#15803D' : isYellow ? '#B45309' : '#B91C1C';

  const totalWindowMs = Math.max(expiresAt - cookedAt, 1);
  const progressRatio = evaluation.isExpired
    ? 0
    : Math.max(0, Math.min(1, evaluation.remainingMs / totalWindowMs));
  const progressPctLabel = `${Math.round(progressRatio * 100)}%`;

  return (
    <View className={`w-full px-4 pt-2.5 pb-4 items-center ${bgClass}`}>
      {/* Top Header Strip: Batch ID & Dynamic Warning Tag */}
      <View className="w-full flex-row items-center justify-between gap-2 mb-2.5">
        <View className="bg-black/25 px-2.5 py-1 rounded-[6px] shrink-0">
          <Text style={styles.batchMono}>{batchId}</Text>
        </View>
        {isYellow ? (
          <View className="bg-white px-2 py-0.5 rounded-[5px] flex-row items-center gap-1 shrink-0">
            <PulseDot color="#D97706" size={5} />
            <Text style={styles.badgeAmberText}>&lt; 45 MENIT</Text>
          </View>
        ) : evaluation.isExpired ? (
          <View className="bg-white px-2 py-0.5 rounded-[5px] shrink-0">
            <Text style={styles.badgeRedText}>
              LEWAT {formatExpiredMinutes(evaluation.elapsedPastExpiryMs)}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1 bg-black/20 px-2 py-0.5 rounded-[5px] shrink-0">
            <Lock size={11} color="#FFFFFF" strokeWidth={2} />
            <Text style={styles.lockMono}>AMAN</Text>
          </View>
        )}
      </View>

      {/* Hero Icon & Headline */}
      <View className="flex-row items-center justify-center gap-2.5 mb-1">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm shrink-0">
          <Icon size={20} strokeWidth={2.4} color={iconColor} />
        </View>
        <Text className="font-sans font-extrabold text-[20px] text-white tracking-[-0.025em] uppercase">
          {evaluation.verdictTitle}
        </Text>
      </View>

      {/* Operational Instruction */}
      <Text className="font-sans text-[12px] text-white/95 text-center leading-[17px] max-w-[320px] font-medium">
        {evaluation.instruction}
      </Text>

      {/* Hero Monospace Countdown Well + SVG Radial Gauge */}
      <View className={`mt-3 w-full rounded-[14px] border px-4 py-2.5 ${wellBgClass}`}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-white/90">
              {evaluation.isExpired
                ? 'STATUS TERKUNCI SISTEM'
                : isYellow
                  ? 'SISA WAKTU SEBELUM BASI'
                  : 'SISA WAKTU AMAN KONSUMSI'}
            </Text>

            <Text style={styles.heroCountdown}>
              {evaluation.isExpired
                ? '00:00:00'
                : formatCountdown(evaluation.remainingMs)}
            </Text>

            {evaluation.isExpired ? (
              <Text style={styles.expiredSub}>
                KEDALUWARSA • LEWAT {formatCountdown(evaluation.elapsedPastExpiryMs)}
              </Text>
            ) : null}
          </View>

          <CircularGaugeSvg
            progress={progressRatio}
            size={56}
            strokeWidth={5}
            color="#FFFFFF"
            trackColor="rgba(255,255,255,0.24)"
            centerLabel={progressPctLabel}
            centerTextColor="#FFFFFF"
          />
        </View>

        {/* Timestamps audit footer */}
        <View className="mt-2 pt-2 border-t border-white/20 w-full flex-row items-center justify-between">
          <Text style={styles.auditMono}>Masak: {formatWibTime(cookedAt)}</Text>
          <Text style={styles.auditMono}>Batas: {formatWibTime(expiresAt)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  batchMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  lockMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroCountdown: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontVariant: ['tabular-nums'],
    fontSize: 34,
    lineHeight: 40,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  expiredSub: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 2,
  },
  auditMono: {
    fontFamily: 'JetBrainsMono_600SemiBold',
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  badgeAmberText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: '#78350F',
  },
  badgeRedText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    color: '#7F1D1D',
  },
});
