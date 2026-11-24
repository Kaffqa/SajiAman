import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOmprengTelemetry,
  calculateWeakestLink,
  evaluateSafetyStatus,
  formatCountdown,
  formatHoursId,
  formatWibTime,
  MS_PER_HOUR,
  WARNING_THRESHOLD_MS,
} from './weakestLinkEngine';
import type { MenuItem } from '../types/sajiaman';

const NASI_PUTIH: MenuItem = {
  id: 'nasi-putih',
  name: 'Nasi Putih',
  category: 'karbohidrat',
  holdingHours: 4.5,
  riskLabel: 'Menu Kering',
  isHighRisk: false,
};

const AYAM_GORENG: MenuItem = {
  id: 'ayam-goreng',
  name: 'Ayam Goreng Kering',
  category: 'protein',
  holdingHours: 5.0,
  riskLabel: 'Menu Kering',
  isHighRisk: false,
};

const SAYUR_LODEH: MenuItem = {
  id: 'sayur-lodeh',
  name: 'Sayur Lodeh Santan',
  category: 'sayur',
  holdingHours: 3.5,
  riskLabel: 'Berkuah/Santan',
  isHighRisk: true,
};

const PISANG: MenuItem = {
  id: 'pisang',
  name: 'Pisang Ambon',
  category: 'buah',
  holdingHours: 6.0,
  riskLabel: 'Buah Utuh',
  isHighRisk: false,
};

test('calculateWeakestLink returns null for empty list', () => {
  assert.equal(calculateWeakestLink([]), null);
});

test('calculateWeakestLink applies dry standard 4.5h when only dry items selected', () => {
  const result = calculateWeakestLink([AYAM_GORENG, NASI_PUTIH, PISANG]);
  assert.ok(result);
  assert.equal(result.holdingHours, 4.5);
  assert.equal(result.triggerItem.id, 'nasi-putih');
  assert.equal(result.isDryStandard, true);
  assert.match(result.reasonText, /Menu Kering Penuh/);
});

test('calculateWeakestLink locks to 3.5h when perishable coconut dish is present', () => {
  const result = calculateWeakestLink([NASI_PUTIH, AYAM_GORENG, SAYUR_LODEH, PISANG]);
  assert.ok(result);
  assert.equal(result.holdingHours, 3.5);
  assert.equal(result.holdingMs, 3.5 * MS_PER_HOUR);
  assert.equal(result.triggerItem.id, 'sayur-lodeh');
  assert.equal(result.isDryStandard, false);
  assert.match(result.reasonText, /Sayur Lodeh Santan/);
});

test('evaluateSafetyStatus classifies GREEN, YELLOW, and RED boundaries accurately', () => {
  const expiresAt = 1_700_000_000_000;

  // > 45 minutes remaining -> GREEN
  const green = evaluateSafetyStatus(expiresAt, expiresAt - (WARNING_THRESHOLD_MS + 1000));
  assert.equal(green.status, 'GREEN');
  assert.equal(green.isExpired, false);
  assert.equal(green.verdictTitle, 'AMAN DIKONSUMSI');

  // Exactly 45 minutes remaining -> YELLOW
  const yellowBoundary = evaluateSafetyStatus(expiresAt, expiresAt - WARNING_THRESHOLD_MS);
  assert.equal(yellowBoundary.status, 'YELLOW');
  assert.equal(yellowBoundary.verdictTitle, 'SEGERA KONSUMSI');

  // 1 second remaining -> YELLOW
  const yellowNearZero = evaluateSafetyStatus(expiresAt, expiresAt - 1000);
  assert.equal(yellowNearZero.status, 'YELLOW');

  // 0 ms remaining -> RED hard lock
  const redBoundary = evaluateSafetyStatus(expiresAt, expiresAt);
  assert.equal(redBoundary.status, 'RED');
  assert.equal(redBoundary.isExpired, true);
  assert.equal(redBoundary.verdictTitle, 'DILARANG DIBAGIKAN');

  // Past expiry -> RED with elapsedPastExpiryMs
  const redPast = evaluateSafetyStatus(expiresAt, expiresAt + 20 * 60 * 1000);
  assert.equal(redPast.status, 'RED');
  assert.equal(redPast.remainingMs, 0);
  assert.equal(redPast.elapsedPastExpiryMs, 20 * 60 * 1000);
});

test('formatCountdown and formatHoursId render deterministic tabular strings', () => {
  assert.equal(formatCountdown(2 * MS_PER_HOUR + 14 * 60 * 1000 + 52 * 1000), '02:14:52');
  assert.equal(formatCountdown(0), '00:00:00');
  assert.equal(formatCountdown(27 * 60 * 1000 + 5 * 1000), '00:27:05');
  assert.equal(formatHoursId(3.5), '3,5');
  assert.equal(formatHoursId(4), '4,0');
});

test('formatWibTime formats UTC timestamps strictly in WIB (UTC+7)', () => {
  // 2026-11-24T00:15:08Z -> 07:15:08 WIB
  const utcMs = Date.UTC(2026, 10, 24, 0, 15, 8);
  assert.equal(formatWibTime(utcMs, false), '07:15 WIB');
  assert.equal(formatWibTime(utcMs, true), '07:15:08 WIB');
});

test('calculateOmprengTelemetry sums kitchen, transit, school, and returned counts', () => {
  const telemetry = calculateOmprengTelemetry(600, [
    { omprengCount: 150, omprengStatus: 'dispatched' },
    { omprengCount: 120, omprengStatus: 'received_school' },
    { omprengCount: 90, omprengStatus: 'returned_sterilized' },
  ]);

  assert.equal(telemetry.totalInventory, 600);
  assert.equal(telemetry.inTransit, 150);
  assert.equal(telemetry.atSchools, 120);
  assert.equal(telemetry.outOfKitchen, 270);
  assert.equal(telemetry.inKitchen, 330);
  assert.equal(telemetry.returnedTotal, 90);
});
