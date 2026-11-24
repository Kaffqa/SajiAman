/**
 * SajiAman Weakest-Link Food Safety Engine
 * 100% pure TypeScript — zero React or DOM dependencies.
 * Directly portable to React Native / Expo & Edge Functions.
 */

import type { MenuItem, SafetyEvaluation, WeakestLinkResult } from '../types/sajiaman';

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
 * Computes ompreng inventory breakdown across kitchen, in transit, and at schools.
 */
export function calculateOmprengTelemetry(
  totalInventory: number,
  batches: Array<{ omprengCount: number; omprengStatus: string }>
) {
  let inTransit = 0;
  let atSchools = 0;
  let returnedTotal = 0;

  for (const batch of batches) {
    if (batch.omprengStatus === 'dispatched') {
      inTransit += batch.omprengCount;
    } else if (batch.omprengStatus === 'received_school') {
      atSchools += batch.omprengCount;
    } else if (batch.omprengStatus === 'returned_sterilized') {
      returnedTotal += batch.omprengCount;
    }
  }

  const outOfKitchen = inTransit + atSchools;
  const inKitchen = Math.max(0, totalInventory - outOfKitchen);

  return {
    totalInventory,
    inKitchen,
    inTransit,
    atSchools,
    outOfKitchen,
    returnedTotal,
  };
}
