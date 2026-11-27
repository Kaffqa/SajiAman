/**
 * SajiAman Weakest-Link Food Safety Engine
 * 100% pure TypeScript — zero React or DOM dependencies.
 * Directly portable to React Native / Expo & Edge Functions.
 */

import type { BatchStatus, MenuItem, SafetyEvaluation, WeakestLinkResult } from '../types/sajiaman';

export const WARNING_THRESHOLD_MINUTES = 45;
export const WARNING_THRESHOLD_MS = WARNING_THRESHOLD_MINUTES * 60 * 1000;
export const MS_PER_HOUR = 60 * 60 * 1000;
export const WIB_OFFSET_HOURS = 7;

/**
 * Formats holding hours using Indonesian comma decimal separator (e.g., 3.5 -> "3,5").
 */
export function formatHoursId(hours: number): string {
  return Number.isInteger(hours) ? `${hours},0` : hours.toFixed(1).replace('.', ',');
}

/**
 * Computes the Weakest-Link holding time from selected menu items.
 * The shortest holding duration strictly controls the entire batch safety window.
 */
export function calculateWeakestLink(items: MenuItem[]): WeakestLinkResult | null {
  if (items.length === 0) {
    return null;
  }

  let weakest = items[0];
  for (let i = 1; i < items.length; i += 1) {
    const candidate = items[i];
    if (candidate.holdingHours < weakest.holdingHours) {
      weakest = candidate;
    } else if (
      candidate.holdingHours === weakest.holdingHours &&
      candidate.isHighRisk &&
      !weakest.isHighRisk
    ) {
      weakest = candidate;
    }
  }

  const holdingHours = weakest.holdingHours;
  const holdingMs = Math.round(holdingHours * MS_PER_HOUR);
  const isDryStandard = holdingHours >= 4.5 && !weakest.isHighRisk;
  const hoursStr = formatHoursId(holdingHours);

  const reasonText = isDryStandard
    ? `Menu Kering Penuh — Standar ${hoursStr} Jam (${weakest.name})`
    : `Dipicu: ${weakest.name} (${weakest.riskLabel})`;

  const shortRuleLabel = `${hoursStr} Jam (${weakest.riskLabel})`;

  return {
    holdingHours,
    holdingMs,
    triggerItem: weakest,
    isDryStandard,
    reasonText,
    shortRuleLabel,
  };
}

/**
 * Evaluates live traffic-light food safety verdict against server/simulated time.
 * - GREEN:  remaining > 45 minutes
 * - YELLOW: 0 < remaining <= 45 minutes
 * - RED:    remaining <= 0 (Hard Lock)
 */
export function evaluateSafetyStatus(expiresAtMs: number, nowMs: number): SafetyEvaluation {
  const diff = expiresAtMs - nowMs;

  if (diff <= 0) {
    return {
      status: 'RED',
      remainingMs: 0,
      elapsedPastExpiryMs: Math.abs(diff),
      isExpired: true,
      verdictTitle: 'DILARANG DIBAGIKAN',
      verdictBadge: 'DILARANG',
      instruction:
        'Batas waktu aman habis. Sistem mengunci distribusi demi keselamatan siswa. Alihkan segera ke jalur pakan maggot.',
    };
  }

  if (diff <= WARNING_THRESHOLD_MS) {
    return {
      status: 'YELLOW',
      remainingMs: diff,
      elapsedPastExpiryMs: 0,
      isExpired: false,
      verdictTitle: 'SEGERA KONSUMSI',
      verdictBadge: 'SEGERA',
      instruction:
        'Segera bagikan seluruh porsi kepada siswa sekarang juga tanpa menunda.',
    };
  }

  return {
    status: 'GREEN',
    remainingMs: diff,
    elapsedPastExpiryMs: 0,
    isExpired: false,
    verdictTitle: 'AMAN DIKONSUMSI',
    verdictBadge: 'AMAN',
    instruction: 'Layak dibagikan kepada siswa sesuai jadwal makan.',
  };
}

/**
 * Evaluates full batch safety verdict taking into account batch_status overrides
 * ('voided' and 'rejected_spoiled') before time-based holding window checks.
 */
export function evaluateBatchSafety(
  batch: {
    expiresAt: number;
    batchStatus?: BatchStatus;
    rejectionReason?: string;
    rejectedAt?: number;
    voidReason?: string;
    voidedAt?: number;
  },
  nowMs: number
): SafetyEvaluation {
  if (batch.batchStatus === 'voided') {
    return {
      status: 'RED',
      remainingMs: 0,
      elapsedPastExpiryMs: Math.max(0, nowMs - (batch.voidedAt ?? nowMs)),
      isExpired: true,
      verdictTitle: 'DIBATALKAN DAPUR',
      verdictBadge: 'VOID',
      instruction: `Pengiriman boks dibatalkan oleh Dapur SPPG${batch.voidReason ? `: ${batch.voidReason}` : '.'} Dilarang menerima atau membagikan ke siswa.`,
    };
  }

  if (batch.batchStatus === 'rejected_spoiled') {
    return {
      status: 'RED',
      remainingMs: 0,
      elapsedPastExpiryMs: Math.max(0, nowMs - (batch.rejectedAt ?? nowMs)),
      isExpired: true,
      verdictTitle: 'DITOLAK KOORDINATOR',
      verdictBadge: 'DITOLAK',
      instruction: `Boks ditolak: ${batch.rejectionReason || 'Kondisi makanan tidak layak'}. Distribusi ke siswa dikunci sistem demi keselamatan. Segera alihkan ke jalur pakan maggot.`,
    };
  }

  return evaluateSafetyStatus(batch.expiresAt, nowMs);
}

/**
 * Formats a non-negative duration in milliseconds into HH:MM:SS tabular format.
 */
export function formatCountdown(durationMs: number): string {
  const safeSeconds = Math.max(0, Math.floor(Math.abs(durationMs) / 1000));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Formats an epoch timestamp into deterministic WIB (UTC+7) clock string.
 */
export function formatWibTime(epochMs: number, includeSeconds = false): string {
  const wibDate = new Date(epochMs + WIB_OFFSET_HOURS * MS_PER_HOUR);
  const hh = String(wibDate.getUTCHours()).padStart(2, '0');
  const mm = String(wibDate.getUTCMinutes()).padStart(2, '0');
  if (!includeSeconds) {
    return `${hh}:${mm} WIB`;
  }
  const ss = String(wibDate.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss} WIB`;
}

/**
 * Formats a compact minutes label when expired (e.g., "+18 MNT").
 */
export function formatExpiredMinutes(elapsedMs: number): string {
  const mins = Math.max(1, Math.floor(elapsedMs / 60000));
  return `+${mins} MNT`;
}

/**
 * Generates a deterministic MBG batch code for newly sealed batches.
 */
export function generateBatchId(sequenceNumber: number): string {
  const suffix = String(sequenceNumber).padStart(2, '0');
  return `MBG-2411-B${suffix}`;
}

/**
 * Computes zero-sum ompreng inventory breakdown across kitchen, in transit,
 * at schools (including ready_pickup), returned sterilized, and missing/discrepancy units.
 */
export function calculateOmprengTelemetry(
  totalInventory: number,
  batches: Array<{
    omprengCount: number;
    omprengReceivedCount?: number;
    omprengStatus: string;
    batchStatus?: string;
  }>
) {
  let inTransit = 0;
  let atSchools = 0;
  let returnedTotal = 0;
  let missingOrDiscrepancy = 0;

  for (const batch of batches) {
    if (batch.batchStatus === 'voided') continue;
    const sent = Math.max(0, Number(batch.omprengCount) || 0);
    const hasReceived =
      batch.omprengReceivedCount !== undefined && batch.omprengReceivedCount !== null;
    const received = hasReceived
      ? Math.max(0, Math.min(sent, Number(batch.omprengReceivedCount) || 0))
      : sent;
    const diff = Math.max(0, sent - received);

    if (batch.omprengStatus === 'dispatched') {
      inTransit += sent;
    } else if (
      batch.omprengStatus === 'received_school' ||
      batch.omprengStatus === 'ready_pickup'
    ) {
      atSchools += received;
      missingOrDiscrepancy += diff;
    } else if (batch.omprengStatus === 'returned_sterilized') {
      returnedTotal += received;
      missingOrDiscrepancy += diff;
    }
  }

  const outOfKitchen = inTransit + atSchools;
  const inKitchen = Math.max(0, totalInventory - outOfKitchen - missingOrDiscrepancy);

  return {
    totalInventory,
    inKitchen,
    inTransit,
    atSchools,
    outOfKitchen,
    returnedTotal,
    missingOrDiscrepancy,
  };
}

/**
 * Computes midnight (00:00:00.000) of the current WIB (UTC+7) day as UTC epoch ms.
 */
export function getWibStartOfDayMs(epochMs: number): number {
  const wibDate = new Date(epochMs + WIB_OFFSET_HOURS * MS_PER_HOUR);
  wibDate.setUTCHours(0, 0, 0, 0);
  return wibDate.getTime() - WIB_OFFSET_HOURS * MS_PER_HOUR;
}

/**
 * Classifies high-risk perishable dish names while exempting sterile/packaged UHT dairy.
 * Mirrors PostgreSQL server-side clamping rules in `seal_production_batch`.
 */
export function isPerishableHighRiskName(name: string, explicitHighRisk: boolean = false): boolean {
  if (explicitHighRisk) return true;
  const lower = (name || '').toLowerCase();
  if (/(santan|kuah|soto|lodeh|gulai|opor|sop)/.test(lower)) {
    return true;
  }
  if (/susu/.test(lower) && !/(uht|kotak|kemasan|botol|steril)/.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Detects offline clock rollback across app restarts/force-close by comparing
 * current estimated server time (local clock + cached drift) against last verified server epoch.
 */
export function detectOfflineClockRollback(
  localNowMs: number,
  cachedDriftMs: number,
  lastKnownServerMs?: number | null,
  toleranceMs: number = 5 * 60 * 1000
): boolean {
  if (!lastKnownServerMs || !Number.isFinite(lastKnownServerMs) || lastKnownServerMs <= 0) {
    return false;
  }
  const estimatedNowMs = localNowMs + (Number.isFinite(cachedDriftMs) ? cachedDriftMs : 0);
  return estimatedNowMs + toleranceMs < lastKnownServerMs;
}
