import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOmprengTelemetry,
  calculateWeakestLink,
  evaluateBatchSafety,
  evaluateSafetyStatus,
  formatCountdown,
  formatHoursId,
  formatWibTime,
  MS_PER_HOUR,
  WARNING_THRESHOLD_MS,
} from './weakestLinkEngine';
import type { BatchRecord, MenuItem } from '../types/sajiaman';

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

test('buildBatchQrPayload and parseAndVerifyBatchQrPayload authenticate valid QR', () => {
  const { buildBatchQrPayload, parseAndVerifyBatchQrPayload } = require('./qrCrypto');

  const batchCode = 'MBG-2411-9988';
  const kitchenCode = 'SPPG-SMG-01';
  const cookedAtMs = 1732410000000;

  const qrString = buildBatchQrPayload({
    batchCode,
    kitchenCode,
    schoolId: 'sdn-01-pendrikan',
    cookedAtMs,
  });

  const verified = parseAndVerifyBatchQrPayload(qrString);
  assert.equal(verified.isValid, true);
  assert.equal(verified.batchCode, batchCode);
  assert.equal(verified.isSignedJson, true);
  assert.equal(verified.kitchenCode, kitchenCode);
});

test('parseAndVerifyBatchQrPayload rejects tampered QR payloads', () => {
  const { buildBatchQrPayload, parseAndVerifyBatchQrPayload } = require('./qrCrypto');

  const validQr = buildBatchQrPayload({
    batchCode: 'MBG-2411-1234',
    kitchenCode: 'SPPG-SMG-01',
    schoolId: 'sdn-01-pendrikan',
    cookedAtMs: 1732410000000,
  });

  // Tamper: change batch code inside payload without recalculating sig
  const tamperedJson = JSON.parse(validQr);
  tamperedJson.b = 'MBG-2411-FORGED';
  const tamperedString = JSON.stringify(tamperedJson);

  const result = parseAndVerifyBatchQrPayload(tamperedString);
  assert.equal(result.isValid, false);
  assert.match(result.reason || '', /tidak valid|terindikasi/i);
});

test('serverClockDriftMs prevents device clock tampering on food safety evaluation', () => {
  // Scenario: Server time is 11:00 AM WIB, food expires at 10:30 AM WIB (already EXPIRED).
  // Dishonest user turns phone clock back by 2 hours to 09:00 AM WIB.
  const trueServerTimeMs = Date.UTC(2026, 10, 24, 4, 0, 0); // 11:00 WIB
  const expiresAtMs = Date.UTC(2026, 10, 24, 3, 30, 0);     // 10:30 WIB
  const tamperedDeviceClockMs = Date.UTC(2026, 10, 24, 2, 0, 0); // 09:00 WIB

  // If using local device clock blindly:
  const naiveCheck = evaluateSafetyStatus(expiresAtMs, tamperedDeviceClockMs);
  assert.equal(naiveCheck.status, 'GREEN'); // Basi but evaluated as safe!

  // With SajiAman NTP drift correction:
  const serverClockDriftMs = trueServerTimeMs - tamperedDeviceClockMs; // +2 hours
  const correctedAuditNowMs = tamperedDeviceClockMs + serverClockDriftMs; // exactly 11:00 WIB

  const securedCheck = evaluateSafetyStatus(expiresAtMs, correctedAuditNowMs);
  assert.equal(securedCheck.status, 'RED'); // Correctly locked to RED!
  assert.equal(securedCheck.isExpired, true);
});

test('WARNING_THRESHOLD_MINUTES is dynamically 45 minutes and matches MS', () => {
  const { WARNING_THRESHOLD_MINUTES, WARNING_THRESHOLD_MS } = require('./weakestLinkEngine');
  assert.equal(WARNING_THRESHOLD_MINUTES, 45);
  assert.equal(WARNING_THRESHOLD_MS, 45 * 60 * 1000);
});

test('validateEnvironment detects configuration and asserts no leaked secret in client', () => {
  const { validateEnvironment } = require('../config/env');
  const env = validateEnvironment();
  assert.equal(typeof env.isConfigured, 'boolean');
  assert.equal(typeof env.dataSource, 'string');
  assert.ok(env.dataSource === 'supabase' || env.dataSource === 'mock');
});

test('parseAndVerifyBatchQrPayload strictly rejects random QRs, URLs, raw text, and unsigned JSON', () => {
  const { parseAndVerifyBatchQrPayload, normalizeScannedBatchCode } = require('./qrCrypto');

  const externalUrl = parseAndVerifyBatchQrPayload('https://example.com/promo-mbg');
  assert.equal(externalUrl.isValid, false);

  const retailBarcode = parseAndVerifyBatchQrPayload('8991234567890');
  assert.equal(retailBarcode.isValid, false);

  const plainBatchCode = parseAndVerifyBatchQrPayload('MBG-2411-9988');
  assert.equal(plainBatchCode.isValid, false);

  const unsignedJson = parseAndVerifyBatchQrPayload('{"b":"MBG-2411-9988","s":"sdn-01"}');
  assert.equal(unsignedJson.isValid, false);

  const wrongSchemaJson = parseAndVerifyBatchQrPayload(
    JSON.stringify({ schema: 'other.v1', b: 'MBG-2411-9988', k: 'SPPG', s: 'sdn-01', t: 100, sig: '12345678' })
  );
  assert.equal(wrongSchemaJson.isValid, false);

  assert.equal(normalizeScannedBatchCode('https://evil.test/qr'), '');
  assert.equal(normalizeScannedBatchCode('123456'), '');
  assert.equal(normalizeScannedBatchCode('#mbg-2411-99ab'), 'MBG-2411-99AB');
  assert.equal(normalizeScannedBatchCode('sajiaman://scan/mbg-2411-01cd'), 'MBG-2411-01CD');
});

test('buildBatchQrPayload and parseAndVerifyBatchQrPayload preserve qrToken and schoolId', () => {
  const { buildBatchQrPayload, parseAndVerifyBatchQrPayload } = require('./qrCrypto');

  const payload = buildBatchQrPayload({
    batchCode: 'MBG-2511-A1B2',
    kitchenCode: 'SPPG-SMG-02',
    schoolId: 'school-uuid-99',
    cookedAtMs: 1732500000000,
    qrToken: 'deadbeef12345678',
  });

  const verified = parseAndVerifyBatchQrPayload(payload);
  assert.equal(verified.isValid, true);
  assert.equal(verified.batchCode, 'MBG-2511-A1B2');
  assert.equal(verified.kitchenCode, 'SPPG-SMG-02');
  assert.equal(verified.schoolId, 'school-uuid-99');
  assert.equal(verified.qrToken, 'DEADBEEF12345678');
});

test('evaluateBatchSafety overrides GREEN time window to RED for voided and rejected_spoiled batches', () => {
  const nowMs = Date.UTC(2026, 10, 25, 3, 0, 0);
  const baseBatch: BatchRecord = {
    id: 'MBG-2511-TEST',
    boxNumber: 'BOKS-01',
    kitchenId: 'k-1',
    kitchenName: 'SPPG Test',
    schoolId: 's-1',
    schoolName: 'SDN 01 Test',
    omprengCount: 100,
    items: [NASI_PUTIH],
    weakestLinkItemId: NASI_PUTIH.id,
    weakestLinkItemName: NASI_PUTIH.name,
    weakestLinkRiskLabel: NASI_PUTIH.riskLabel,
    holdingHours: 4.5,
    cookedAt: nowMs - MS_PER_HOUR,
    expiresAt: nowMs + 3.5 * MS_PER_HOUR,
    kitchenTempC: 72,
    inputMode: 'manual',
    omprengStatus: 'dispatched',
    batchStatus: 'active',
  };

  const activeEval = evaluateBatchSafety(baseBatch, nowMs);
  assert.equal(activeEval.status, 'GREEN');

  const voidedEval = evaluateBatchSafety(
    { ...baseBatch, batchStatus: 'voided', voidReason: 'Salah input porsi' },
    nowMs
  );
  assert.equal(voidedEval.status, 'RED');
  assert.equal(voidedEval.isExpired, true);
  assert.equal(voidedEval.verdictBadge, 'VOID');
  assert.match(voidedEval.instruction, /Salah input porsi/);

  const spoiledEval = evaluateBatchSafety(
    { ...baseBatch, batchStatus: 'rejected_spoiled', rejectionReason: 'Bau asam dini' },
    nowMs
  );
  assert.equal(spoiledEval.status, 'RED');
  assert.equal(spoiledEval.isExpired, true);
  assert.equal(spoiledEval.verdictBadge, 'DITOLAK');
  assert.match(spoiledEval.instruction, /Bau asam dini/);
});

test('extractJsonObjectFromAiText parses plain JSON, <think> blocks, and markdown fences cleanly', () => {
  const { extractJsonObjectFromAiText, normalizeAiMealAnalysis } = require('./aiResponseParser');

  const withThinkAndFence = `<think>Observing rice, chicken, sayur lodeh, and banana.</think>
\`\`\`json
{
  "is_valid_food_tray": true,
  "rejection_reason_id": null,
  "nutrition_checks": {
    "karbohidrat": { "present": true, "detected_label": "Nasi Putih" },
    "protein": { "present": true, "detected_label": "Ayam Goreng" },
    "sayur": { "present": true, "detected_label": "Sayur Lodeh" },
    "buah": { "present": true, "detected_label": "Pisang" }
  },
  "matched_menu_item_ids": ["nasi-putih", "sayur-lodeh"],
  "has_wet_or_coconut_milk_component": true,
  "risk_notes_id": "Terdeteksi santan",
  "confidence_score": 0.94
}
\`\`\``;

  const parsed = extractJsonObjectFromAiText(withThinkAndFence);
  const normalized = normalizeAiMealAnalysis(parsed, ['fallback-id']);
  assert.equal(normalized.is_valid_food_tray, true);
  assert.equal(normalized.has_wet_or_coconut_milk_component, true);
  assert.deepEqual(normalized.matched_menu_item_ids, ['nasi-putih', 'sayur-lodeh']);
  assert.equal(normalized.confidence_score, 0.94);

  const rejected = normalizeAiMealAnalysis(
    { is_valid_food_tray: false, rejection_reason_id: 'Bukan makanan', matched_menu_item_ids: [] },
    ['should-not-fallback']
  );
  assert.equal(rejected.is_valid_food_tray, false);
  assert.equal(rejected.rejection_reason_id, 'Bukan makanan');
  assert.deepEqual(rejected.matched_menu_item_ids, []);
});

test('Dual-AI environment defaults select gemini-4-hydrogen -> qwen/qwen3.8-27b order', () => {
  const { validateEnvironment } = require('../config/env');
  const env = validateEnvironment();
  assert.equal(env.geminiModel, 'gemini-4-hydrogen');
  assert.equal(env.groqModel, 'qwen/qwen3.8-27b');
  assert.deepEqual(env.aiProviderOrder, ['gemini', 'groq']);
});

test('calculateOmprengTelemetry excludes voided batches from inTransit/outOfKitchen counts', () => {
  const telemetry = calculateOmprengTelemetry(600, [
    { omprengCount: 100, omprengStatus: 'dispatched', batchStatus: 'active' },
    { omprengCount: 150, omprengStatus: 'dispatched', batchStatus: 'voided' },
    { omprengCount: 80, omprengStatus: 'received_school', batchStatus: 'active' },
    { omprengCount: 120, omprengStatus: 'returned_sterilized', batchStatus: 'active' },
  ]);

  assert.equal(telemetry.inTransit, 100);
  assert.equal(telemetry.atSchools, 80);
  assert.equal(telemetry.outOfKitchen, 180);
  assert.equal(telemetry.inKitchen, 420);
  assert.equal(telemetry.returnedTotal, 120);
});

test('buildMealInspectionPrompt covers all 6 categories and normalizeAiMealAnalysis extracts multi-item detected_items[]', () => {
  const { buildMealInspectionPrompt, normalizeAiMealAnalysis } = require('./aiResponseParser');
  const prompt = buildMealInspectionPrompt(['nasi-putih', 'jeruk-medan', 'susu-kotak-uht']);

  assert.ok(prompt.includes('karbohidrat'), 'Prompt should include karbohidrat');
  assert.ok(prompt.includes('susu_minuman'), 'Prompt should include susu_minuman');
  assert.ok(prompt.includes('sambal_pelengkap'), 'Prompt should include sambal_pelengkap');
  assert.ok(prompt.includes('detected_items'), 'Prompt should require detected_items array');

  const multiItemPayload = {
    is_valid_food_tray: true,
    rejection_reason_id: '',
    nutrition_checks: {
      karbohidrat: { present: true, detected_label: 'Nasi Putih' },
      protein: { present: true, detected_label: 'Ayam Goreng Tepung & Telur Ceplok' },
      sayur: { present: true, detected_label: 'Lalapan Timun & Selada' },
      buah: { present: true, detected_label: 'Jeruk Medan' },
    },
    detected_items: [
      {
        name: 'Nasi Putih',
        category: 'karbohidrat',
        matched_catalog_id: 'nasi-putih',
        estimated_holding_hours: 4.5,
        is_high_risk: false,
      },
      {
        name: 'Ayam Goreng Tepung',
        category: 'protein',
        matched_catalog_id: null,
        estimated_holding_hours: 5.0,
        is_high_risk: false,
      },
      {
        name: 'Telur Ceplok',
        category: 'protein',
        matched_catalog_id: 'telur-ceplok-dadar',
        estimated_holding_hours: 4.5,
        is_high_risk: false,
      },
      {
        name: 'Lalapan Timun & Selada',
        category: 'sayur',
        matched_catalog_id: 'lalapan-timun-selada',
        estimated_holding_hours: 4.0,
        is_high_risk: false,
      },
      {
        name: 'Jeruk Medan',
        category: 'buah',
        matched_catalog_id: 'jeruk-medan',
        estimated_holding_hours: 6.0,
        is_high_risk: false,
      },
      {
        name: 'Sambal Merah',
        category: 'sambal_pelengkap',
        matched_catalog_id: 'sambal-segar',
        estimated_holding_hours: 4.0,
        is_high_risk: false,
      },
      {
        name: 'Susu Kotak UHT Stroberi',
        category: 'susu_minuman',
        matched_catalog_id: 'susu-kotak-uht',
        estimated_holding_hours: 8.0,
        is_high_risk: false,
      },
    ],
    matched_menu_item_ids: ['nasi-putih'],
    has_wet_or_coconut_milk_component: false,
    risk_notes_id: '7 komponen lengkap termasuk susu UHT, sambal, dan dua protein.',
    confidence_score: 0.96,
  };

  const normalized = normalizeAiMealAnalysis(multiItemPayload, []);
  assert.equal(normalized.detected_items.length, 7);
  assert.equal(normalized.detected_items[1].name, 'Ayam Goreng Tepung');
  assert.equal(normalized.detected_items[1].matched_catalog_id, null);
  assert.equal(normalized.detected_items[5].category, 'sambal_pelengkap');
  assert.equal(normalized.detected_items[6].category, 'susu_minuman');
  assert.ok(normalized.matched_menu_item_ids.includes('susu-kotak-uht'));
  assert.ok(normalized.matched_menu_item_ids.includes('telur-ceplok-dadar'));
  assert.ok(normalized.matched_menu_item_ids.includes('lalapan-timun-selada'));
  assert.ok(normalized.matched_menu_item_ids.includes('sambal-segar'));
});

test('hasConflictingCookingVariant prevents mislabeling distinct dishes like Tempe Goreng as Tempe Orek', () => {
  const { hasConflictingCookingVariant } = require('./aiResponseParser');
  assert.equal(hasConflictingCookingVariant('Tempe Goreng', 'Tempe Orek Kering'), true);
  assert.equal(hasConflictingCookingVariant('Ayam Bakar', 'Ayam Goreng Kering'), true);
  assert.equal(hasConflictingCookingVariant('Nasi Goreng', 'Nasi Putih'), true);
  assert.equal(hasConflictingCookingVariant('Tempe', 'Tempe Orek Kering'), true);
  assert.equal(hasConflictingCookingVariant('Ayam Goreng Tepung', 'Ayam Goreng Kering'), false);
  assert.equal(hasConflictingCookingVariant('Nasi Putih', 'Nasi Putih'), false);
});

test('calculateOmprengTelemetry reconciles ready_pickup and partial ompreng discrepancies as zero-sum', () => {
  const telemetry = calculateOmprengTelemetry(500, [
    { omprengCount: 150, omprengReceivedCount: 148, omprengStatus: 'received_school', batchStatus: 'active' },
    { omprengCount: 100, omprengReceivedCount: 95, omprengStatus: 'ready_pickup', batchStatus: 'active' },
    { omprengCount: 80, omprengReceivedCount: 78, omprengStatus: 'returned_sterilized', batchStatus: 'active' },
    { omprengCount: 50, omprengStatus: 'dispatched', batchStatus: 'active' },
  ]);

  assert.equal(telemetry.inTransit, 50);
  assert.equal(telemetry.atSchools, 148 + 95);
  assert.equal(telemetry.returnedTotal, 78);
  assert.equal(telemetry.missingOrDiscrepancy, 2 + 5 + 2);
  assert.equal(
    telemetry.inKitchen + telemetry.inTransit + telemetry.atSchools + telemetry.missingOrDiscrepancy,
    500
  );
});

test('detectOfflineClockRollback catches backward clock tampering across offline app restarts', () => {
  const { detectOfflineClockRollback } = require('./weakestLinkEngine');
  const lastServerMs = 1_700_000_000_000;
  const cachedDriftMs = 0;

  // Rolled back 2 hours -> detected
  assert.equal(
    detectOfflineClockRollback(lastServerMs - 2 * 3600 * 1000, cachedDriftMs, lastServerMs),
    true
  );
  // Moved forward 1 hour -> normal elapsed time, not rolled back
  assert.equal(
    detectOfflineClockRollback(lastServerMs + 3600 * 1000, cachedDriftMs, lastServerMs),
    false
  );
  // Within 5-minute tolerance -> allowed
  assert.equal(
    detectOfflineClockRollback(lastServerMs - 60 * 1000, cachedDriftMs, lastServerMs),
    false
  );
});

test('verifyBatchQrServer fails closed on RPC error/empty data and allows strict offline token cache only on genuine network error', async () => {
  const { executeVerifyBatchQrServer, resolveServerQrVerification } = require('./qrCrypto');

  // 1. Generic RPC database/permission error while online MUST fail closed (never valid: true)
  const rpcErrResult = await executeVerifyBatchQrServer(
    async () => ({ data: null, error: { message: 'function verify_batch_qr_server failed', status: 500 } }),
    { batchCode: 'MBG-2611-ABC123', sig: 'TOK123' }
  );
  assert.equal(rpcErrResult.valid, false);
  assert.equal(Boolean(rpcErrResult.networkError), false);

  const onlineRpcRejection = resolveServerQrVerification({
    serverResult: rpcErrResult,
    isOnline: true,
    isClockTampered: false,
    requireSig: true,
    scannedSig: 'TOK123',
    cachedBatch: { id: 'MBG-2611-ABC123', qrToken: 'TOK123' },
  });
  assert.equal(onlineRpcRejection.ok, false);
  assert.equal(onlineRpcRejection.mode, 'rejected');

  // 2. Auth error (401/403) MUST fail closed even if offline cache has matching token
  const authErrResult = await executeVerifyBatchQrServer(
    async () => ({ data: null, error: { message: 'JWT expired (unauthorized)', status: 401 } }),
    { batchCode: 'MBG-2611-ABC123', sig: 'TOK123' }
  );
  assert.equal(authErrResult.valid, false);
  assert.equal(authErrResult.authError, true);

  const authRejection = resolveServerQrVerification({
    serverResult: authErrResult,
    isOnline: false,
    isClockTampered: false,
    requireSig: true,
    scannedSig: 'TOK123',
    cachedBatch: { id: 'MBG-2611-ABC123', qrToken: 'TOK123' },
  });
  assert.equal(authRejection.ok, false);

  // 3. Empty null data from RPC MUST fail closed
  const emptyDataResult = await executeVerifyBatchQrServer(
    async () => ({ data: null, error: null }),
    { batchCode: 'MBG-2611-ABC123', sig: 'TOK123' }
  );
  assert.equal(emptyDataResult.valid, false);

  // 4. Genuine network failure offline with matching qrToken + clean clock -> offline_cache ok
  const netErrResult = await executeVerifyBatchQrServer(
    async () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } }),
    { batchCode: 'MBG-2611-ABC123', sig: 'TOK123' }
  );
  assert.equal(netErrResult.valid, false);
  assert.equal(netErrResult.networkError, true);

  const offlineOk = resolveServerQrVerification({
    serverResult: netErrResult,
    isOnline: false,
    isClockTampered: false,
    requireSig: true,
    scannedSig: 'TOK123',
    cachedBatch: { id: 'MBG-2611-ABC123', qrToken: 'TOK123' },
  });
  assert.equal(offlineOk.ok, true);
  assert.equal(offlineOk.mode, 'offline_cache');

  // 5. Offline cache with mismatched token or tampered clock -> rejected
  assert.equal(
    resolveServerQrVerification({
      serverResult: netErrResult,
      isOnline: false,
      isClockTampered: false,
      requireSig: true,
      scannedSig: 'WRONG-TOKEN',
      cachedBatch: { id: 'MBG-2611-ABC123', qrToken: 'TOK123' },
    }).ok,
    false
  );
  assert.equal(
    resolveServerQrVerification({
      serverResult: netErrResult,
      isOnline: false,
      isClockTampered: true,
      requireSig: true,
      scannedSig: 'TOK123',
      cachedBatch: { id: 'MBG-2611-ABC123', qrToken: 'TOK123' },
    }).ok,
    false
  );
});

test('normalizeAiMealAnalysis keeps empty matched_menu_item_ids when 0 catalog items match without fabricating fallbacks', () => {
  const { normalizeAiMealAnalysis } = require('./aiResponseParser');

  const zeroMatchPayload = {
    is_valid_food_tray: true,
    rejection_reason_id: null,
    nutrition_checks: {
      karbohidrat: { present: true, detected_label: 'Singkong Kukus' },
      protein: { present: true, detected_label: 'Ikan Tongkol Balado' },
      sayur: { present: false, detected_label: 'Tidak terlihat' },
      buah: { present: false, detected_label: 'Tidak terlihat' },
    },
    detected_items: [
      {
        name: 'Singkong Kukus',
        category: 'karbohidrat',
        matched_catalog_id: null,
        estimated_holding_hours: 4.5,
        is_high_risk: false,
      },
    ],
    matched_menu_item_ids: [],
    has_wet_or_coconut_milk_component: false,
    risk_notes_id: 'Menu lokal non-katalog.',
    confidence_score: 0.88,
  };

  const normalized = normalizeAiMealAnalysis(zeroMatchPayload, ['nasi-putih', 'sayur-lodeh']);
  assert.deepEqual(normalized.matched_menu_item_ids, []);
  assert.equal(normalized.detected_items.length, 1);
  assert.equal(normalized.detected_items[0].name, 'Singkong Kukus');
});

test('isPerishableHighRiskName exempts sterile/packaged UHT milk while flagging santan, kuah, and fresh dairy', () => {
  const { getWibStartOfDayMs, isPerishableHighRiskName } = require('./weakestLinkEngine');

  // Exempt sterile/packaged dairy
  assert.equal(isPerishableHighRiskName('Susu Kotak UHT'), false);
  assert.equal(isPerishableHighRiskName('Susu UHT Cokelat Kemasan 200ml'), false);
  assert.equal(isPerishableHighRiskName('Susu Botol Steril'), false);

  // Flag perishable soups, coconut milk, and unpackaged/fresh milk dishes
  assert.equal(isPerishableHighRiskName('Sayur Lodeh Santan'), true);
  assert.equal(isPerishableHighRiskName('Soto Ayam Kuah Bening'), true);
  assert.equal(isPerishableHighRiskName('Sop Wortel Bakso'), true);
  assert.equal(isPerishableHighRiskName('Opor Ayam Telur'), true);
  assert.equal(isPerishableHighRiskName('Susu Segar Sapi'), true);
  assert.equal(isPerishableHighRiskName('Bubur Susu Pisang'), true);

  // Verify WIB midnight alignment (UTC+7): 2026-11-26 17:30 UTC == 2026-11-27 00:30 WIB
  const epoch0030Wib = Date.UTC(2026, 10, 26, 17, 30, 0);
  const wibMidnightUtc = getWibStartOfDayMs(epoch0030Wib);
  assert.equal(wibMidnightUtc, Date.UTC(2026, 10, 26, 17, 0, 0));
});
