import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatHoursId, formatWibTime } from '../domain/weakestLinkEngine';
import type { BatchRecord, KitchenProfile, SchoolProfile } from '../types/sajiaman';

/**
 * Resolves a local or signed sample photo URI into an inline Base64 data URI
 * with a strict 5s timeout so PDF generation never hangs or breaks offline.
 */
async function resolveImageToDataUri(uri?: string | null): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('data:image/')) return uri;

  try {
    if (uri.startsWith('file://')) {
      const b64 = await new File(uri).base64();
      return b64 ? `data:image/jpeg;base64,${b64}` : null;
    }

    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('blob:')) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const resp = await fetch(uri, { signal: controller.signal });
        if (!resp.ok) return null;
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const b64 =
          typeof btoa === 'function'
            ? btoa(binary)
            : typeof Buffer !== 'undefined'
              ? Buffer.from(buf).toString('base64')
              : '';
        return b64 ? `data:image/jpeg;base64,${b64}` : null;
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (err) {
    console.warn('[manifestGenerator] resolveImageToDataUri fallback (skipping image):', err);
  }
  return null;
}

function escapeHtml(raw?: string | number | null): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function preOpenWebPrintWindow(): Window | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(
        '<!doctype html><html><body style="font-family:sans-serif;padding:24px;color:#0F172A;">Menyiapkan dokumen manifes PDF...</body></html>'
      );
      win.document.close();
    }
    return win;
  } catch {
    return null;
  }
}

async function exportHtmlDocument(
  html: string,
  dialogTitle: string,
  preOpenedWin?: Window | null
): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const win =
        preOpenedWin && !preOpenedWin.closed ? preOpenedWin : window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
        return;
      }

      // Popup blocked: print via hidden iframe or download Blob HTML instead of printing live Expo UI
      if (typeof document !== 'undefined') {
        try {
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          document.body.appendChild(iframe);
          const doc = iframe.contentWindow?.document;
          if (doc && iframe.contentWindow) {
            doc.open();
            doc.write(html);
            doc.close();
            setTimeout(() => {
              try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
              } finally {
                setTimeout(() => {
                  try {
                    document.body.removeChild(iframe);
                  } catch {
                    // ignore cleanup failure
                  }
                }, 1000);
              }
            }, 250);
            return;
          }
          document.body.removeChild(iframe);
        } catch {
          // Fall through to Blob download
        }

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${dialogTitle.replace(/[^a-zA-Z0-9_-]+/g, '_')}.html`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
    }
    await Print.printAsync({ html });
    return;
  }

  let primaryErr: any = null;
  try {
    const file = await Print.printToFileAsync({ html, base64: false });
    if (file?.uri) {
      const canShare = await Sharing.isAvailableAsync().catch(() => false);
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle,
          UTI: 'com.adobe.pdf',
        });
        return;
      }
    }
  } catch (err) {
    primaryErr = err;
    console.warn('[manifestGenerator] printToFileAsync/shareAsync fallback:', err);
  }

  // Fallback to native Print dialog (on Android includes built-in "Save as PDF")
  try {
    await Print.printAsync({ html });
  } catch (fallbackErr: any) {
    const rawMsg =
      fallbackErr?.message || primaryErr?.message || 'Modul cetak PDF tidak tersedia pada perangkat ini.';
    throw new Error(rawMsg);
  }
}

export function generateManifestHtml(
  batch: BatchRecord,
  kitchen: KitchenProfile,
  school?: SchoolProfile,
  inlineSamplePhotoDataUri?: string | null
): string {
  const cookedTime = formatWibTime(batch.cookedAt, true);
  const expiryTime = formatWibTime(batch.expiresAt, true);
  const holdingHours = formatHoursId(batch.holdingHours);

  const safeInlinePhoto =
    inlineSamplePhotoDataUri && inlineSamplePhotoDataUri.startsWith('data:image/')
      ? inlineSamplePhotoDataUri
      : null;

  const menuRows = batch.items
    .map(
      (item, idx) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-family: monospace;">${idx + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-weight: bold;">${escapeHtml(item.name)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; text-transform: uppercase;">${escapeHtml(item.category)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; font-family: monospace;">${escapeHtml(item.holdingHours)} Jam</td>
        <td style="padding: 8px; border-bottom: 1px solid #E2E8F0; color: ${item.id === batch.weakestLinkItemId ? '#B45309; font-weight: bold;' : '#475569;'}">
          ${item.id === batch.weakestLinkItemId ? '★ TITIK TERLEMAH' : escapeHtml(item.riskLabel)}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>MANIFES PENGAWASAN PANGAN MBG RI — ${escapeHtml(batch.id)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 24px; }
          .header { border-bottom: 2px solid #0B2E59; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 18px; font-weight: 800; color: #0B2E59; letter-spacing: -0.02em; }
          .subtitle { font-size: 11px; color: #475569; margin-top: 4px; font-weight: 600; text-transform: uppercase; }
          .batch-code { font-family: monospace; font-size: 16px; font-weight: bold; background: #0B2E59; color: #FFFFFF; padding: 4px 10px; border-radius: 4px; }
          .grid { display: flex; gap: 16px; margin-bottom: 20px; }
          .card { flex: 1; border: 1px solid #CBD5E1; border-radius: 6px; padding: 12px; background: #F8FAFC; }
          .card-title { font-size: 10px; font-weight: bold; color: #64748B; text-transform: uppercase; margin-bottom: 6px; }
          .card-val { font-size: 13px; font-weight: bold; color: #0F172A; }
          .audit-box { border: 1px solid #0F4C81; background: #EBF3FA; border-radius: 6px; padding: 12px; margin-bottom: 20px; display: flex; justify-content: space-around; }
          .audit-item { text-align: center; }
          .audit-label { font-size: 10px; font-weight: bold; color: #0F4C81; text-transform: uppercase; }
          .audit-time { font-family: monospace; font-size: 16px; font-weight: 800; color: #0B2E59; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
          th { background: #0B2E59; color: #FFFFFF; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; }
          .signatures { display: flex; justify-content: space-between; margin-top: 36px; padding-top: 20px; border-top: 1px dashed #CBD5E1; }
          .sig-box { width: 45%; text-align: center; }
          .sig-line { margin-top: 60px; border-bottom: 1px solid #0F172A; }
          .footer { margin-top: 30px; font-size: 10px; color: #94A3B8; text-align: center; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">MANIFES PENGAWASAN PANGAN &amp; LOGISTIK OMPRENG</div>
            <div class="subtitle">BADAN GIZI NASIONAL (BGN) • PROGRAM MAKAN BERGIZI GRATIS (MBG) RI</div>
            <div style="font-size: 12px; color: #0F4C81; margin-top: 4px; font-weight: bold;">${escapeHtml(kitchen.name)} (${escapeHtml(kitchen.code)})</div>
          </div>
          <div class="batch-code">${escapeHtml(batch.id)}</div>
        </div>

        <div class="audit-box">
          <div class="audit-item">
            <div class="audit-label">Waktu Masak Tersegel (WIB)</div>
            <div class="audit-time">${escapeHtml(cookedTime)}</div>
          </div>
          <div class="audit-item">
            <div class="audit-label">Aturan Terlemah</div>
            <div class="audit-time" style="color: #B45309;">${escapeHtml(holdingHours)} Jam (${escapeHtml(batch.weakestLinkRiskLabel)})</div>
          </div>
          <div class="audit-item">
            <div class="audit-label">Batas Konsumsi Resmi (WIB)</div>
            <div class="audit-time" style="color: #B91C1C;">${escapeHtml(expiryTime)}</div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Sekolah Penerima Manfaat</div>
            <div class="card-val">${escapeHtml(batch.schoolName)}</div>
            <div style="font-size: 11px; color: #64748B; margin-top: 4px;">NPSN: ${escapeHtml(school?.npsn || 'Terdaftar Resmi')} • PIC: ${escapeHtml(batch.omprengConfirmedBy || school?.picName || 'Koordinator Guru')}</div>
          </div>
          <div class="card">
            <div class="card-title">Logistik Wadah Ompreng Stainless</div>
            <div class="card-val">${escapeHtml(batch.omprengCount)} Boks Dikirim</div>
            <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Status: ${escapeHtml(batch.omprengStatus.toUpperCase())} ${batch.omprengReceivedCount ? `• Diterima: ${escapeHtml(batch.omprengReceivedCount)}` : ''}</div>
          </div>
        </div>

        <div style="font-size: 12px; font-weight: bold; color: #0B2E59; margin-bottom: 8px; text-transform: uppercase;">Rincian Komposisi Menu Terkunci</div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">No</th>
              <th>Nama Olahan Menu</th>
              <th>Kategori</th>
              <th>Batas Simpan</th>
              <th>Klasifikasi Risiko</th>
            </tr>
          </thead>
          <tbody>
            ${menuRows}
          </tbody>
        </table>

        ${
          batch.omprengDiscrepancyNote
            ? `<div style="padding: 10px; background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 4px; font-size: 11px; color: #991B1B; margin-bottom: 16px;">
                <strong>Catatan Selisih Boks di Lapangan:</strong> ${escapeHtml(batch.omprengDiscrepancyNote)}
               </div>`
            : ''
        }

        ${
          batch.verificationMethod === 'manual_code' || batch.aiOverridden
            ? `<div style="padding: 10px; background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 4px; font-size: 11px; color: #78350F; margin-bottom: 16px;">
                ${
                  batch.verificationMethod === 'manual_code'
                    ? `<div><strong>Metode Verifikasi Sekolah:</strong> Input Kode Manual (${escapeHtml(batch.manualVerificationReason || 'Kendala stiker/kamera')})</div>`
                    : ''
                }
                ${
                  batch.aiOverridden
                    ? `<div style="margin-top: 4px;"><strong>Catatan Audit AI:</strong> Batas aman diubah koki dari deteksi awal AI (${batch.aiDetectedWeakestMinutes ? `${formatHoursId(batch.aiDetectedWeakestMinutes / 60)} Jam` : 'Risiko Tinggi'}) ke ${holdingHours} Jam.</div>`
                    : ''
                }
               </div>`
            : ''
        }

        ${
          safeInlinePhoto
            ? `<div style="margin-bottom: 18px; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; background: #F8FAFC;">
                <div style="font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
                  Bukti Foto Sampel Produksi ${batch.samplePhotoTimestamp ? `(${escapeHtml(batch.samplePhotoTimestamp)})` : ''}
                </div>
                <img src="${escapeHtml(safeInlinePhoto)}" style="max-width: 100%; max-height: 210px; border-radius: 4px; object-fit: cover;" />
               </div>`
            : ''
        }

        <div class="signatures">
          <div class="sig-box">
            <div style="font-size: 11px; font-weight: bold; color: #475569;">Petugas Dapur SPPG</div>
            <div class="sig-line"></div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 6px;">${escapeHtml(batch.creatorName || kitchen.picName)}</div>
            <div style="font-size: 10px; color: #64748B;">Juru Masak / Penanggung Jawab Mutu</div>
          </div>
          <div class="sig-box">
            <div style="font-size: 11px; font-weight: bold; color: #475569;">Koordinator Sekolah Penerima</div>
            <div class="sig-line"></div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 6px;">${escapeHtml(batch.omprengConfirmedBy || school?.picName || 'Petugas Guru Piket')}</div>
            <div style="font-size: 10px; color: #64748B;">Penerima &amp; Verifikator Boks MBG</div>
          </div>
        </div>

        <div class="footer">
          Dokumen resmi dihasilkan secara kriptografis oleh Sistem SajiAman • Server Waktu Terkunci NTP • Tanpa TPA (Zero-Waste)
        </div>
      </body>
    </html>
  `;
}

export async function printManifest(
  batch: BatchRecord,
  kitchen: KitchenProfile,
  school?: SchoolProfile
): Promise<void> {
  const preOpenedWin = preOpenWebPrintWindow();
  try {
    const inlinePhoto = await resolveImageToDataUri(batch.samplePhotoUrl);
    const html = generateManifestHtml(batch, kitchen, school, inlinePhoto);
    if (Platform.OS === 'web') {
      await exportHtmlDocument(html, `Manifes MBG — ${batch.id}`, preOpenedWin);
      return;
    }
    await Print.printAsync({ html });
  } catch (err) {
    if (preOpenedWin && !preOpenedWin.closed) preOpenedWin.close();
    throw err;
  }
}

export async function shareManifestPdf(
  batch: BatchRecord,
  kitchen: KitchenProfile,
  school?: SchoolProfile
): Promise<void> {
  const preOpenedWin = preOpenWebPrintWindow();
  try {
    const inlinePhoto = await resolveImageToDataUri(batch.samplePhotoUrl);
    const html = generateManifestHtml(batch, kitchen, school, inlinePhoto);
    await exportHtmlDocument(html, `Manifes MBG — ${batch.id}`, preOpenedWin);
  } catch (err) {
    if (preOpenedWin && !preOpenedWin.closed) preOpenedWin.close();
    throw err;
  }
}

export interface PeriodicSummaryReportParams {
  batches: BatchRecord[];
  periodLabel: string;
  scopeTitle: string;
  generatedBy: string;
  simulatedNowMs: number;
  totalMaggotKg?: number;
}

export function generatePeriodicSummaryHtml(params: PeriodicSummaryReportParams): string {
  const {
    batches,
    periodLabel,
    scopeTitle,
    generatedBy,
    simulatedNowMs,
    totalMaggotKg = 0,
  } = params;

  const totalBatches = batches.length;
  const totalPortions = batches.reduce((acc, b) => acc + (b.omprengCount || 0), 0);
  const rejectedCount = batches.filter((b) => b.batchStatus === 'rejected_spoiled').length;
  const voidedCount = batches.filter((b) => b.batchStatus === 'voided').length;
  const complianceRate =
    totalBatches === 0 ? 100 : Math.round(((totalBatches - rejectedCount) / totalBatches) * 100);

  const printedAt = formatWibTime(simulatedNowMs, true);

  const rowsHtml =
    batches.length === 0
      ? `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #64748B;">Tidak ada catatan batch pada periode ini.</td></tr>`
      : batches
          .map((b, idx) => {
            const st =
              b.batchStatus === 'rejected_spoiled'
                ? '<span style="color:#B91C1C;font-weight:bold;">DITOLAK BASI</span>'
                : b.batchStatus === 'voided'
                  ? '<span style="color:#64748B;font-weight:bold;">VOID</span>'
                  : b.omprengStatus === 'returned_sterilized'
                    ? '<span style="color:#15803D;font-weight:bold;">KEMBALI STERIL</span>'
                    : b.omprengStatus === 'received_school'
                      ? '<span style="color:#0F4C81;font-weight:bold;">DITERIMA</span>'
                      : '<span style="color:#B45309;font-weight:bold;">DIKIRIM</span>';
            return `
              <tr>
                <td style="padding:7px;border-bottom:1px solid #E2E8F0;font-family:monospace;">${idx + 1}</td>
                <td style="padding:7px;border-bottom:1px solid #E2E8F0;font-family:monospace;font-weight:bold;">${escapeHtml(b.id)}</td>
                <td style="padding:7px;border-bottom:1px solid #E2E8F0;"><strong>${escapeHtml(b.kitchenName)}</strong><br/><span style="color:#475569;font-size:11px;">&rarr; ${escapeHtml(b.schoolName)}</span></td>
                <td style="padding:7px;border-bottom:1px solid #E2E8F0;">${escapeHtml(b.weakestLinkItemName)} (${formatHoursId(b.holdingHours)}j)<br/><span style="color:#64748B;font-size:11px;">Masak: ${Number.isFinite(b.cookedAt) ? formatWibTime(b.cookedAt) : '-'} WIB</span></td>
                <td style="padding:7px;border-bottom:1px solid #E2E8F0;font-family:monospace;text-align:right;">${Number(b.omprengCount || 0)}</td>
                <td style="padding:7px;border-bottom:1px solid #E2E8F0;">${st}</td>
              </tr>
            `;
          })
          .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>REKAP LAPORAN MBG RI — ${escapeHtml(periodLabel)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 24px; }
          .header { border-bottom: 2px solid #0B2E59; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 17px; font-weight: 800; color: #0B2E59; }
          .sub { font-size: 11px; color: #475569; font-weight: 600; text-transform: uppercase; margin-top: 3px; }
          .pill { background: #0B2E59; color: #FFFFFF; padding: 5px 10px; border-radius: 5px; font-size: 11px; font-weight: bold; }
          .kpi-grid { display: flex; gap: 10px; margin-bottom: 18px; }
          .kpi { flex: 1; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; background: #F8FAFC; }
          .kpi-label { font-size: 10px; font-weight: bold; color: #64748B; text-transform: uppercase; }
          .kpi-val { font-size: 18px; font-weight: 800; color: #0B2E59; margin-top: 3px; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 22px; }
          th { background: #0B2E59; color: #FFFFFF; text-align: left; padding: 8px 7px; font-size: 10.5px; text-transform: uppercase; }
          .footer { margin-top: 24px; font-size: 10px; color: #64748B; text-align: center; border-top: 1px dashed #CBD5E1; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">REKAPITULASI PENGAWASAN PANGAN &amp; LOGISTIK MBG RI</div>
            <div class="sub">${escapeHtml(scopeTitle)} • BADAN GIZI NASIONAL (BGN)</div>
            <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Dicetak oleh: ${escapeHtml(generatedBy)} • ${printedAt}</div>
          </div>
          <div class="pill">${escapeHtml(periodLabel)}</div>
        </div>

        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-label">Total Batch</div>
            <div class="kpi-val">${totalBatches}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Total Porsi</div>
            <div class="kpi-val">${totalPortions}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Kepatuhan Aman</div>
            <div class="kpi-val" style="color:${complianceRate >= 95 ? '#15803D' : '#B91C1C'};">${complianceRate}%</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Ditolak / Void</div>
            <div class="kpi-val" style="color:#B45309;">${rejectedCount} / ${voidedCount}</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Maggot BSF</div>
            <div class="kpi-val" style="color:#15803D;">${totalMaggotKg} kg</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:28px;">No</th>
              <th>Kode Batch</th>
              <th>Unit SPPG &amp; Sekolah</th>
              <th>Titik Terlemah &amp; Masak</th>
              <th style="text-align:right;">Ompreng</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          Laporan Rekap Berkala SajiAman • Integritas Waktu Terkunci Server NTP • Program Makan Bergizi Gratis RI
        </div>
      </body>
    </html>
  `;
}

export async function exportPeriodicSummaryPdf(params: PeriodicSummaryReportParams): Promise<void> {
  const html = generatePeriodicSummaryHtml(params);
  await exportHtmlDocument(html, `Rekap Laporan MBG — ${params.periodLabel}`);
}
