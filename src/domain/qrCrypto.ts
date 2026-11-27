/**
 * SajiAman QR Format Checksum & Server-Token Payload Parser
 * Pure TypeScript — Zero React Native runtime dependencies.
 * Uses fast client-side FNV-1a format checksum for instant pre-RPC screening,
 * paired with authoritative server-generated UUID qr_token (tok) verified in PostgreSQL.
 */

const SECRET_SALT = 'SAJIAMAN_MBG_GOV_ID_2026';

/**
 * Generates a deterministic 8-character FNV-1a format checksum for instant client screening.
 * (Authoritative anti-counterfeit authentication relies on the server UUID `qr_token` verified in PostgreSQL.)
 */
export function computeQrSignature(
  batchCode: string,
  kitchenCode: string = 'SPPG-SMG-01',
  cookedAtEpochSec: number = 0
): string {
  const input = `${batchCode.toUpperCase()}#${kitchenCode.toUpperCase()}#${cookedAtEpochSec}#${SECRET_SALT}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x27d4eb2f;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ (ch << 1), 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (hex1.slice(0, 4) + hex2.slice(4, 8)).toUpperCase();
}

export interface VerifiedQrPayload {
  isValid: boolean;
  batchCode: string;
  isSignedJson: boolean;
  kitchenCode?: string;
  schoolId?: string;
  cookedAtEpochSec?: number;
  qrToken?: string;
  reason?: string;
}

/**
 * Normalizes manually entered batch codes ONLY (e.g. from damaged/wet sticker recovery).
 * Strips leading '#', trims whitespace, and validates standard MBG/SAJI format.
 */
export function normalizeScannedBatchCode(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // Structured JSON pasted manually
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.b) return String(parsed.b).trim().toUpperCase();
      if (parsed.batchId) return String(parsed.batchId).trim().toUpperCase();
      if (parsed.id) return String(parsed.id).trim().toUpperCase();
    } catch {
      // Ignore parse error and fallback to regex
    }
  }

  // Deep-link path if pasted
  const urlMatch = trimmed.match(/^sajiaman:\/\/(?:batch|scan)\/([A-Za-z0-9-]+)$/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].toUpperCase();
  }

  // Direct SajiAman batch code format only (MBG-XXXX-XXXX or SAJI-XXXX)
  const directMatch = trimmed.match(/^#?((?:MBG|SAJI)-[A-Za-z0-9-]+)$/i);
  if (directMatch && directMatch[1]) {
    return directMatch[1].toUpperCase();
  }

  return '';
}

/**
 * Parses and strictly verifies scanned camera QR payloads.
 * Rejects random QR codes (URLs, plain text, retail barcodes, unsigned JSON, or missing schema/sig).
 */
export function parseAndVerifyBatchQrPayload(raw: string): VerifiedQrPayload {
  if (!raw || typeof raw !== 'string') {
    return {
      isValid: false,
      batchCode: '',
      isSignedJson: false,
      reason: 'QR kosong atau tidak dapat dibaca kamera.',
    };
  }

  const trimmed = raw.trim();

  // Camera scan MUST be structured signed JSON with schema 'sajiaman.v1'
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return {
      isValid: false,
      batchCode: '',
      isSignedJson: false,
      reason: 'Bukan QR segel resmi SajiAman. Gunakan Input Manual jika stiker rusak.',
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    const schema = String(parsed.schema || '').trim();
    const batchCode = String(parsed.b || '').trim().toUpperCase();
    const kitchenCode = String(parsed.k || '').trim().toUpperCase();
    const schoolId = String(parsed.s || '').trim();
    const cookedAtSec = Number(parsed.t || 0);
    const signature = String(parsed.sig || '').trim().toUpperCase();
    const qrToken = parsed.tok ? String(parsed.tok).trim().toUpperCase() : undefined;

    if (schema !== 'sajiaman.v1') {
      return {
        isValid: false,
        batchCode: '',
        isSignedJson: false,
        reason: 'Format skema QR tidak dikenali oleh sistem SajiAman.',
      };
    }

    if (!batchCode || !/^(MBG|SAJI)-[A-Z0-9-]+$/i.test(batchCode)) {
      return {
        isValid: false,
        batchCode: '',
        isSignedJson: true,
        reason: 'Struktur kode QR tidak memiliki kode batch MBG yang sah.',
      };
    }

    if (!kitchenCode || !schoolId || !Number.isFinite(cookedAtSec) || cookedAtSec <= 0) {
      return {
        isValid: false,
        batchCode,
        isSignedJson: true,
        reason: 'Metadata dapur SPPG / sekolah tujuan pada QR tidak lengkap.',
      };
    }

    // Mandatory cryptographic signature check (never skip when empty)
    if (!signature) {
      return {
        isValid: false,
        batchCode,
        isSignedJson: true,
        reason: 'Tanda tangan digital segel QR tidak valid / tidak ditemukan.',
      };
    }

    const expectedSig = computeQrSignature(batchCode, kitchenCode, cookedAtSec);
    if (signature !== expectedSig) {
      return {
        isValid: false,
        batchCode,
        isSignedJson: true,
        reason: 'Tanda tangan digital segel QR tidak valid / terindikasi manipulasi fisik.',
      };
    }

    return {
      isValid: true,
      batchCode,
      isSignedJson: true,
      kitchenCode,
      schoolId,
      cookedAtEpochSec: cookedAtSec,
      qrToken,
    };
  } catch {
    return {
      isValid: false,
      batchCode: '',
      isSignedJson: true,
      reason: 'Format data JSON pada stiker QR rusak atau bukan QR SajiAman.',
    };
  }
}

/**
 * Encodes complete tamper-evident batch audit payload into structured QR JSON.
 */
export function buildBatchQrPayload(params: {
  batchCode: string;
  kitchenCode?: string;
  schoolId?: string;
  cookedAtMs?: number;
  qrToken?: string;
}): string {
  const batchCode = params.batchCode.toUpperCase();
  const kitchenCode = (params.kitchenCode || 'SPPG-SMG-01').toUpperCase();
  const schoolId = params.schoolId || 'sdn-01-pendrikan';
  const cookedAtEpochSec = Math.floor((params.cookedAtMs || Date.now()) / 1000);
  const sig = computeQrSignature(batchCode, kitchenCode, cookedAtEpochSec);

  return JSON.stringify({
    schema: 'sajiaman.v1',
    b: batchCode,
    k: kitchenCode,
    s: schoolId,
    t: cookedAtEpochSec,
    sig,
    ...(params.qrToken ? { tok: params.qrToken.toUpperCase() } : {}),
  });
}

export interface QrServerCheckResult {
  valid: boolean;
  reason?: string;
  networkError?: boolean;
  authError?: boolean;
  batchCode?: string;
  batchStatus?: string;
}

export type VerifyBatchRpcCaller = (
  fnName: string,
  args: Record<string, any>
) => Promise<{ data: any; error: any }>;

function classifyQrRpcError(msg?: string, status?: number) {
  const lower = String(msg || '').toLowerCase();
  const authError =
    status === 401 ||
    status === 403 ||
    /(jwt|unauthorized|forbidden|permission denied|akses ditolak|not authenticated|dinonaktifkan)/.test(
      lower
    );
  const networkError =
    !authError &&
    /(failed to fetch|network request failed|networkerror|fetcherror|timed out|timeout|econnrefused|offline|socket hang up)/.test(
      lower
    );
  return { authError, networkError };
}

/**
 * Pure fail-closed server QR verification runner (shared by Supabase repository and unit tests).
 * Never returns `{ valid: true }` on RPC error or empty data.
 */
export async function executeVerifyBatchQrServer(
  rpc: VerifyBatchRpcCaller,
  params: {
    batchCode: string;
    sig?: string | null;
    requireSig?: boolean;
    verificationMethod?: 'qr_scan' | 'manual_code';
    manualReason?: string;
  }
): Promise<QrServerCheckResult> {
  const cleanCode = params.batchCode.trim().toUpperCase();
  const cleanSig = params.sig ? params.sig.trim().toUpperCase() : null;
  const requireSig = params.requireSig ?? true;

  try {
    const { data, error } = await rpc('verify_batch_qr_server', {
      p_batch_code: cleanCode,
      p_sig: cleanSig,
      p_require_sig: requireSig,
      p_verification_method: params.verificationMethod || null,
      p_manual_reason: params.manualReason || null,
    });

    if (error) {
      const errMsg = String(error.message || '');
      if (errMsg.includes('schema cache') || errMsg.includes('p_verification_method')) {
        const { data: legacyData, error: legacyErr } = await rpc('verify_batch_qr_server', {
          p_batch_code: cleanCode,
          p_sig: cleanSig,
          p_require_sig: requireSig,
        });
        if (!legacyErr && legacyData) {
          return {
            valid: Boolean(legacyData.valid),
            reason: legacyData.reason || undefined,
            batchCode: legacyData.batch_code || undefined,
            batchStatus: legacyData.batch_status || undefined,
          };
        }
        const flags = classifyQrRpcError(legacyErr?.message, Number(legacyErr?.status));
        return {
          valid: false,
          ...flags,
          reason: legacyErr?.message || 'Verifikasi server QR gagal (skema RPC tidak cocok).',
        };
      }

      const flags = classifyQrRpcError(error.message, Number(error.status));
      return {
        valid: false,
        ...flags,
        reason: error.message || 'Gagal memverifikasi QR pada server.',
      };
    }

    if (!data) {
      return {
        valid: false,
        reason: 'Server tidak mengembalikan respons verifikasi segel QR.',
      };
    }

    return {
      valid: Boolean(data.valid),
      reason: data.reason || undefined,
      batchCode: data.batch_code || undefined,
      batchStatus: data.batch_status || undefined,
    };
  } catch (err: any) {
    const flags = classifyQrRpcError(err?.message || String(err), Number(err?.status));
    return {
      valid: false,
      authError: flags.authError,
      networkError: flags.networkError || !flags.authError,
      reason: err?.message || 'Koneksi ke server verifikasi QR terganggu.',
    };
  }
}

export interface OfflineQrFallbackEvaluation {
  ok: boolean;
  mode: 'server' | 'offline_cache' | 'rejected';
  reason?: string;
}

/**
 * Fail-closed QR server verification evaluator:
 * - Always fails closed on auth (401/403), RPC errors, or `!data` when online.
 * - Permits cached batch fallback ONLY on genuine offline/network failure
 *   with strict matching `qrToken` and non-tampered local clock.
 */
export function resolveServerQrVerification(params: {
  serverResult: QrServerCheckResult;
  isOnline: boolean;
  isClockTampered: boolean;
  requireSig: boolean;
  scannedSig?: string | null;
  cachedBatch?: { id: string; qrToken?: string } | null;
}): OfflineQrFallbackEvaluation {
  const { serverResult, isOnline, isClockTampered, requireSig, scannedSig, cachedBatch } = params;

  if (serverResult.valid) {
    return { ok: true, mode: 'server' };
  }

  if (serverResult.authError) {
    return {
      ok: false,
      mode: 'rejected',
      reason:
        serverResult.reason ||
        'Sesi login atau otorisasi sekolah tidak valid. Silakan masuk ulang sebelum memindai.',
    };
  }

  const canConsiderOfflineCache = Boolean(serverResult.networkError || !isOnline);
  if (!canConsiderOfflineCache) {
    return {
      ok: false,
      mode: 'rejected',
      reason:
        serverResult.reason ||
        'Verifikasi segel QR dengan server gagal. Pastikan QR berasal dari Dapur SPPG resmi.',
    };
  }

  if (!cachedBatch) {
    return {
      ok: false,
      mode: 'rejected',
      reason:
        'Perangkat offline dan data batch belum tersinkron di cache lokal. Hubungkan ke internet untuk memverifikasi.',
    };
  }

  if (isClockTampered) {
    return {
      ok: false,
      mode: 'rejected',
      reason:
        'Jam perangkat terindikasi dimundurkan saat offline. Hubungkan ke internet untuk verifikasi waktu server.',
    };
  }

  if (requireSig) {
    const cachedTok = cachedBatch.qrToken?.trim().toUpperCase() || '';
    const incomingTok = scannedSig?.trim().toUpperCase() || '';
    if (!cachedTok || !incomingTok || cachedTok !== incomingTok) {
      return {
        ok: false,
        mode: 'rejected',
        reason:
          'Token segel QR offline tidak cocok dengan catatan batch terenkripsi lokal.',
      };
    }
  }

  return { ok: true, mode: 'offline_cache' };
}
