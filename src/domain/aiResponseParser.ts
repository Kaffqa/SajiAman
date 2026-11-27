/**
 * SajiAman AI Response Parser & Prompt Builder
 * Pure TypeScript — zero React Native runtime dependencies (unit-testable in Node).
 */

import type { MenuCategory } from '../types/sajiaman';

export interface NutritionComponentCheck {
  present: boolean;
  detected_label: string;
}

export interface DetectedFoodItem {
  name: string;
  category: MenuCategory;
  matched_catalog_id?: string | null;
  estimated_holding_hours: number;
  is_high_risk: boolean;
}

export interface MealAiCoreResult {
  is_valid_food_tray: boolean;
  rejection_reason_id: string | null;
  nutrition_checks: {
    karbohidrat: NutritionComponentCheck;
    protein: NutritionComponentCheck;
    sayur: NutritionComponentCheck;
    buah: NutritionComponentCheck;
  };
  detected_items: DetectedFoodItem[];
  matched_menu_item_ids: string[];
  has_wet_or_coconut_milk_component: boolean;
  risk_notes_id: string;
  confidence_score: number;
}

export interface CatalogPromptItem {
  id: string;
  name: string;
  category: string;
  holding_time_minutes: number;
}

/**
 * Extracts a clean JSON object from raw LLM text that may contain
 * <think>...</think> reasoning blocks or markdown code fences.
 */
export function extractJsonObjectFromAiText(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty AI text response');
  }
  const withoutThink = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const withoutFence = withoutThink
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf('{');
    const lastBrace = withoutFence.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('AI response does not contain valid JSON object');
  }
}

/**
 * Builds the comprehensive multi-item MBG food tray inspection prompt
 * shared across Gemini and Groq Vision models.
 */
export function buildMealInspectionPrompt(menuCatalogPayload: CatalogPromptItem[]): string {
  const catalogPromptList = (menuCatalogPayload || [])
    .slice(0, 40)
    .map(
      (m) =>
        `- ID: "${m.id}", Nama: "${m.name}", Kategori: "${m.category}", Daya Tahan: ${m.holding_time_minutes} menit`
    )
    .join('\n');

  return `Anda adalah Sistem Verifikasi Mutu & Keamanan Pangan Resmi Program Makan Bergizi Gratis (MBG) Republik Indonesia (SPPG).
Tugas Anda adalah memeriksa foto nampan ompreng stainless steel bersekat (food tray) MBG dan mendata SELURUH isi makanan, minuman, lalapan, dan pelengkap/sambal yang terlihat di setiap sekat secara AKURAT berdasarkan bentuk visual nyata.

ATURAN UTAMA — PENGAMATAN VISUAL MURNI TERLEBIH DAHULU:
- JANGAN menebak nama makanan dari daftar katalog! Daftar katalog di bagian bawah HANYA referensi ID opsional, BUKAN pilihan ganda.
- Mayoritas menu harian dapur (seperti Ayam Suwir Kecap, Ayam Teriyaki Wijen, Semur Ayam, Tempe Goreng, Tumis Buncis Wortel, Perkedel, Orek Telur, dsb.) TIDAK ada di katalog — itu normal dan WAJIB memakai nama visual aslinya dengan "matched_catalog_id": null.
- BEDAKAN VISUAL LAUK COKELAT SECARA TELITI:
  * Jika terlihat serat suwiran daging/unggas memanjang (apalagi dengan taburan wijen atau saus kecap/teriyaki), namai "Ayam Suwir Kecap" / "Ayam Teriyaki" / "Daging Suwir" — JANGAN menyebutnya "Tempe Orek"!
  * Hanya namai "Tempe Orek" atau "Tempe Goreng" bila jelas terlihat tekstur pori kacang kedelai berbentuk dadu/potongan/irisan tempe.

Instruksi Analisis Menyeluruh:
1. Validasi Nampan MBG:
   - Apakah foto menampilkan nampan/boks makanan siap saji?
   - Jika foto BUKAN makanan (selfie, meja kosong, dokumen, kendaraan, buram tanpa makanan), set "is_valid_food_tray": false dan isi "rejection_reason_id".
   - Jika YA, set "is_valid_food_tray": true dan "rejection_reason_id": null.

2. Identifikasi SELURUH Komponen di Nampan ("detected_items"):
   - Periksa setiap sekat/wadah di nampan secara teliti (termasuk multi-protein seperti ayam + telur, lalapan mentah seperti timun/selada/tomat, tumisan seperti buncis + wortel, sambal/saus, kerupuk, maupun susu kotak UHT / minuman kemasan).
   - Untuk SETIAP item yang terlihat, buat 1 objek dalam array "detected_items":
     * "name": nama hidangan sebenarnya yang tampak di foto dalam Bahasa Indonesia (contoh: "Nasi Putih", "Ayam Suwir Teriyaki", "Tumis Buncis Wortel", "Jeruk", "Susu Kotak UHT").
     * "category": WAJIB pilih satu dari: "karbohidrat" | "protein" | "sayur" | "buah" | "susu_minuman" | "sambal_pelengkap".
     * "matched_catalog_id": isi ID dari Referensi Katalog di bawah HANYA JIKA nama hidangan dan cara masaknya benar-benar identik. WAJIB isi null jika berbeda! JANGAN memaksakan cocok hanya karena warna atau bahan mirip (mis. "Ayam Suwir Kecap" -> null, "Tempe Goreng" -> null, "Tumis Buncis Wortel" boleh "tumis-buncis" hanya jika memang tumis buncis, "Susu Kotak UHT" -> "susu-kotak-uht").
     * "estimated_holding_hours": estimasi daya tahan suhu ruang dalam jam (3.5 berkuah santan/sambal basah, 4.0 tumis/suwir basah/berbumbu kecap, 4.5 nasi/lalapan/telur, 5.0 lauk kering, 6.0 buah utuh/susu kotak UHT tersegel).
     * "is_high_risk": true jika <= 3.5 jam, else false.

3. Ringkasan 4 Pilar Gizi Utama ("nutrition_checks"):
   - karbohidrat: nasi/kentang/roti/mi.
   - protein: ayam/daging/ikan/telur/tempe/tahu sesuai pengamatan visual asli.
   - sayur: sayur masak ATAU lalapan segar (selada, timun, tomat, kol, buncis, wortel).
   - buah: buah utuh/potong (pisang, jeruk, semangka, apel).
   - Jika suatu komponen tidak terlihat, set present: false dan detected_label: "Tidak terlihat".

4. Pencocokan ID Katalog ("matched_menu_item_ids"):
   - Hanya masukkan ID katalog dari item yang matched_catalog_id-nya tidak null.

5. Deteksi Komponen Cepat Basi ("has_wet_or_coconut_milk_component" & "risk_notes_id"):
   - Set true jika ada komponen santan/kuah basah/sambal basah/buah potong (<= 3,5 jam), dan jelaskan pemicunya pada "risk_notes_id".

6. Skor Keyakinan ("confidence_score"): angka 0.0 - 1.0.

Referensi Katalog Menu SPPG (Opsional — hanya untuk pencocokan ID yang identik, BUKAN pilihan terbatas):
${catalogPromptList || 'Katalog opsional kosong: gunakan matched_catalog_id null untuk semua item.'}

Format output HARUS JSON valid murni persis sesuai struktur ini:
{
  "is_valid_food_tray": true,
  "rejection_reason_id": null,
  "nutrition_checks": {
    "karbohidrat": { "present": true, "detected_label": "Nasi Putih" },
    "protein": { "present": true, "detected_label": "Ayam Goreng & Telur Ceplok" },
    "sayur": { "present": true, "detected_label": "Lalapan Selada & Timun" },
    "buah": { "present": true, "detected_label": "Jeruk" }
  },
  "detected_items": [
    { "name": "Nasi Putih", "category": "karbohidrat", "matched_catalog_id": "nasi-putih", "estimated_holding_hours": 4.5, "is_high_risk": false },
    { "name": "Ayam Suwir Teriyaki", "category": "protein", "matched_catalog_id": null, "estimated_holding_hours": 4.0, "is_high_risk": false },
    { "name": "Lalapan Selada & Timun", "category": "sayur", "matched_catalog_id": "lalapan-timun-selada", "estimated_holding_hours": 4.5, "is_high_risk": false },
    { "name": "Jeruk", "category": "buah", "matched_catalog_id": "jeruk-medan", "estimated_holding_hours": 6.0, "is_high_risk": false },
    { "name": "Susu Kotak UHT", "category": "susu_minuman", "matched_catalog_id": "susu-kotak-uht", "estimated_holding_hours": 6.0, "is_high_risk": false }
  ],
  "matched_menu_item_ids": ["nasi-putih", "lalapan-timun-selada", "jeruk-medan", "susu-kotak-uht"],
  "has_wet_or_coconut_milk_component": false,
  "risk_notes_id": "Menu standar higienis dengan batas aman 4,0 jam (olahan kecap/tumis).",
  "confidence_score": 0.94
}`;
}

const VALID_CATEGORIES = new Set<MenuCategory>([
  'karbohidrat',
  'protein',
  'sayur',
  'buah',
  'susu_minuman',
  'sambal_pelengkap',
]);

function normalizeCategory(raw: any): MenuCategory {
  const clean = String(raw || '').trim().toLowerCase() as MenuCategory;
  return VALID_CATEGORIES.has(clean) ? clean : 'sambal_pelengkap';
}

/**
 * Normalizes raw provider JSON into a strict MealAiCoreResult without inventing false positives.
 */
export function normalizeAiMealAnalysis(
  raw: any,
  fallbackMatchedIds: string[] = []
): MealAiCoreResult {
  const validTray = Boolean(raw?.is_valid_food_tray);
  const rawMatched = Array.isArray(raw?.matched_menu_item_ids)
    ? raw.matched_menu_item_ids.map((id: any) => String(id).trim()).filter(Boolean)
    : [];

  const rawDetected = Array.isArray(raw?.detected_items) ? raw.detected_items : [];
  const detectedItems: DetectedFoodItem[] = [];
  const seenNames = new Set<string>();

  for (const entry of rawDetected) {
    const name = String(entry?.name || '').trim();
    if (!name) continue;
    const dedupKey = name.toLowerCase();
    if (seenNames.has(dedupKey)) continue;
    seenNames.add(dedupKey);

    const parsedHours = Number(entry?.estimated_holding_hours);
    const holdingHours =
      Number.isFinite(parsedHours) && parsedHours >= 1 && parsedHours <= 12
        ? Math.round(parsedHours * 2) / 2
        : 4.5;

    const matchedCatId = entry?.matched_catalog_id ? String(entry.matched_catalog_id).trim() : null;
    if (matchedCatId && !rawMatched.includes(matchedCatId)) {
      rawMatched.push(matchedCatId);
    }

    detectedItems.push({
      name,
      category: normalizeCategory(entry?.category),
      matched_catalog_id: matchedCatId,
      estimated_holding_hours: holdingHours,
      is_high_risk: Boolean(entry?.is_high_risk) || holdingHours <= 3.5,
    });
  }

  return {
    is_valid_food_tray: validTray,
    rejection_reason_id: raw?.rejection_reason_id ? String(raw.rejection_reason_id) : null,
    nutrition_checks: {
      karbohidrat: {
        present: Boolean(raw?.nutrition_checks?.karbohidrat?.present),
        detected_label:
          String(raw?.nutrition_checks?.karbohidrat?.detected_label || '').trim() ||
          'Tidak terlihat',
      },
      protein: {
        present: Boolean(raw?.nutrition_checks?.protein?.present),
        detected_label:
          String(raw?.nutrition_checks?.protein?.detected_label || '').trim() || 'Tidak terlihat',
      },
      sayur: {
        present: Boolean(raw?.nutrition_checks?.sayur?.present),
        detected_label:
          String(raw?.nutrition_checks?.sayur?.detected_label || '').trim() || 'Tidak terlihat',
      },
      buah: {
        present: Boolean(raw?.nutrition_checks?.buah?.present),
        detected_label:
          String(raw?.nutrition_checks?.buah?.detected_label || '').trim() || 'Tidak terlihat',
      },
    },
    detected_items: detectedItems,
    matched_menu_item_ids: rawMatched,
    has_wet_or_coconut_milk_component: Boolean(raw?.has_wet_or_coconut_milk_component),
    risk_notes_id:
      String(raw?.risk_notes_id || '').trim() ||
      (raw?.has_wet_or_coconut_milk_component
        ? 'Terdeteksi komponen bersantan/berkuah yang mengunci batas aman menjadi 3,5 jam.'
        : 'Menu standar higienis dengan batas aman 4,5 jam.'),
    confidence_score:
      typeof raw?.confidence_score === 'number' && !Number.isNaN(raw.confidence_score)
        ? Math.min(1, Math.max(0, raw.confidence_score))
        : validTray
          ? 0.92
          : 0,
  };
}

const COOKING_MODIFIERS = [
  'goreng',
  'orek',
  'mendoan',
  'bacem',
  'bakar',
  'panggang',
  'rebus',
  'kukus',
  'santan',
  'gulai',
  'lodeh',
  'opor',
  'balado',
  'kecap',
  'soto',
  'sop',
  'uduk',
  'kuning',
  'putih',
  'capcay',
];

/**
 * Returns true if the AI-detected dish name and a candidate catalog item represent
 * different cooking preparations of a similar base ingredient (e.g. "Tempe Goreng" vs "Tempe Orek Kering").
 */
export function hasConflictingCookingVariant(
  detectedName: string,
  catalogName: string
): boolean {
  const toWords = (text: string) =>
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

  const detWords = new Set(toWords(detectedName));
  const catWords = new Set(toWords(catalogName));

  const detMods = COOKING_MODIFIERS.filter((m) => detWords.has(m));
  const catMods = COOKING_MODIFIERS.filter((m) => catWords.has(m));

  // If both mention cooking/style modifiers and none of the primary modifiers match, treat as distinct dish
  if (detMods.length > 0 && catMods.length > 0) {
    const sharedMod = detMods.some((m) => catMods.includes(m));
    if (!sharedMod) return true;
  }

  // Distinct style mismatch where catalog specifies a strong style absent from detected dish (e.g. detected "Tempe" vs "Tempe Orek")
  const strictCatalogStyles = ['orek', 'bacem', 'mendoan', 'balado', 'santan', 'gulai', 'lodeh', 'opor', 'uduk', 'kuning', 'soto', 'sop'];
  for (const style of strictCatalogStyles) {
    if (catWords.has(style) && !detWords.has(style)) return true;
    if (detWords.has(style) && !catWords.has(style)) return true;
  }

  return false;
}
