import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface NutritionItem {
  present: boolean;
  detected_label: string;
}

interface DetectedFoodItem {
  name: string;
  category:
    | 'karbohidrat'
    | 'protein'
    | 'sayur'
    | 'buah'
    | 'susu_minuman'
    | 'sambal_pelengkap';
  matched_catalog_id: string | null;
  estimated_holding_hours: number;
  is_high_risk: boolean;
}

const VALID_CATEGORIES = new Set([
  'karbohidrat',
  'protein',
  'sayur',
  'buah',
  'susu_minuman',
  'sambal_pelengkap',
]);

function normalizeEdgeCategory(raw: unknown): DetectedFoodItem['category'] {
  const s = String(raw ?? '').trim().toLowerCase();
  if (VALID_CATEGORIES.has(s)) return s as DetectedFoodItem['category'];
  if (s.includes('susu') || s.includes('minum') || s.includes('milk')) return 'susu_minuman';
  if (s.includes('sambal') || s.includes('saos') || s.includes('kerupuk') || s.includes('pelengkap'))
    return 'sambal_pelengkap';
  if (s.includes('karbo') || s.includes('nasi') || s.includes('kentang')) return 'karbohidrat';
  if (s.includes('protein') || s.includes('ayam') || s.includes('telur') || s.includes('ikan'))
    return 'protein';
  if (s.includes('buah') || s.includes('jeruk') || s.includes('pisang')) return 'buah';
  return 'sayur';
}

interface AnalysisResponse {
  is_valid_food_tray: boolean;
  rejection_reason_id: string | null;
  nutrition_checks: {
    karbohidrat: NutritionItem;
    protein: NutritionItem;
    sayur: NutritionItem;
    buah: NutritionItem;
  };
  detected_items: DetectedFoodItem[];
  matched_menu_item_ids: string[];
  has_wet_or_coconut_milk_component: boolean;
  risk_notes_id: string;
  confidence_score: number;
  provider_used: 'gemini' | 'groq';
  model_used: string;
  fallback_triggered: boolean;
}

const REQUEST_TIMEOUT_MS = 18000;

function extractJsonObject(rawText: string): any {
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
    throw new Error('AI response is not valid JSON');
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryGeminiVision(
  geminiApiKey: string,
  candidateModels: string[],
  systemPrompt: string,
  mimeType: string,
  cleanBase64: string
): Promise<{ parsed: any; model: string; errors: string[] }> {
  const errors: string[] = [];

  for (const model of candidateModels) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
      const resp = await fetchWithTimeout(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (resp.ok) {
        const geminiData = await resp.json();
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return { parsed: extractJsonObject(rawText), model, errors };
        }
        errors.push(`Gemini(${model}) empty content`);
      } else {
        const errBody = await resp.text();
        errors.push(`Gemini(${model}) HTTP ${resp.status}: ${errBody.slice(0, 180)}`);
      }
    } catch (err: any) {
      errors.push(`Gemini(${model}): ${err?.message || String(err)}`);
    }
  }

  return { parsed: null, model: '', errors };
}

async function tryGroqVision(
  groqApiKey: string,
  candidateModels: string[],
  systemPrompt: string,
  mimeType: string,
  cleanBase64: string
): Promise<{ parsed: any; model: string; errors: string[] }> {
  const errors: string[] = [];
  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${cleanBase64}`;

  for (const model of candidateModels) {
    const requestPayload = (withReasoningEffort: boolean) => ({
      model,
      temperature: 0.1,
      max_tokens: 900,
      ...(withReasoningEffort ? { reasoning_effort: 'none' } : {}),
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    try {
      let resp = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify(requestPayload(true)),
      });

      if (!resp.ok && resp.status === 400) {
        const bodyText = await resp.text();
        if (bodyText.toLowerCase().includes('reasoning_effort')) {
          resp = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify(requestPayload(false)),
          });
        } else {
          errors.push(`Groq(${model}) HTTP 400: ${bodyText.slice(0, 180)}`);
          continue;
        }
      }

      if (resp.ok) {
        const groqData = await resp.json();
        const rawText = groqData?.choices?.[0]?.message?.content;
        if (rawText) {
          return { parsed: extractJsonObject(rawText), model, errors };
        }
        errors.push(`Groq(${model}) empty content`);
      } else {
        const errBody = await resp.text();
        errors.push(`Groq(${model}) HTTP ${resp.status}: ${errBody.slice(0, 180)}`);
      }
    } catch (err: any) {
      errors.push(`Groq(${model}): ${err?.message || String(err)}`);
    }
  }

  return { parsed: null, model: '', errors };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Method guard
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Strict JWT Auth Guard (Requires verified logged-in user session)
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!authHeader || !supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing verified Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired user session' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Payload size guard (< 4MB)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 4 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Payload too large: Max image size is 4MB' }),
        {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Bad Request: imageBase64 is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { imageBase64, mimeType = 'image/jpeg', menuCatalog = [] } = body;

    // 4. Dual-AI Provider Configuration (Gemini Hydrogen -> 3.8/3.x -> Groq Qwen3.8 Vision)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
    const groqApiKey = Deno.env.get('GROQ_API_KEY') ?? '';
    if (!geminiApiKey && !groqApiKey) {
      return new Response(
        JSON.stringify({
          error: 'Configuration Error: Neither GEMINI_API_KEY nor GROQ_API_KEY is configured',
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const primaryGeminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
    const geminiCandidates = [
      'gemini-2.5-flash',
      'gemini-3-flash-preview',
      'gemini-2.5-flash-lite',
      'gemini-flash-latest',
      primaryGeminiModel,
    ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

    const primaryGroqModel = Deno.env.get('GROQ_MODEL') || 'qwen/qwen3.8-27b';
    const groqCandidates = [
      primaryGroqModel,
      'qwen/qwen3.8-27b',
      'meta-llama/llama-4-scout-17b-16e-instruct',
    ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

    const rawOrder = Deno.env.get('AI_PROVIDER_ORDER') || 'gemini,groq';
    const parsedOrder = rawOrder
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter((p): p is 'gemini' | 'groq' => p === 'gemini' || p === 'groq');
    const providerOrder: Array<'gemini' | 'groq'> =
      parsedOrder.length > 0 ? parsedOrder.filter((v, i, a) => a.indexOf(v) === i) : ['gemini', 'groq'];

    const catalogPromptList = (Array.isArray(menuCatalog) ? menuCatalog : [])
      .slice(0, 30)
      .map(
        (m: any) =>
          `- ID: "${m.id}", Nama: "${m.name}", Kategori: "${m.category}", Daya Tahan: ${m.holding_time_minutes} menit`
      )
      .join('\n');

    const systemPrompt = `Anda adalah Sistem Verifikasi Mutu & Keamanan Pangan Resmi Program Makan Bergizi Gratis (MBG) Republik Indonesia (SPPG).
Tugas Anda adalah memeriksa foto nampan ompreng stainless steel bersekat (food tray) MBG dan mendata SELURUH isi makanan, minuman, lalapan, dan pelengkap/sambal yang terlihat di setiap sekat secara AKURAT berdasarkan bentuk visual nyata.

ATURAN UTAMA — PENGAMATAN VISUAL MURNI TERLEBIH DAHULU:
- JANGAN menebak nama makanan dari daftar katalog di bawah! Katalog di bagian bawah HANYA referensi ID opsional, BUKAN pilihan ganda.
- Mayoritas menu harian dapur (seperti Ayam Suwir Kecap, Ayam Teriyaki Wijen, Semur Ayam, Tempe Goreng, Tumis Buncis Wortel, Perkedel, dsb.) TIDAK ada di katalog — itu normal dan WAJIB memakai nama visual aslinya dengan "matched_catalog_id": null.
- BEDAKAN VISUAL LAUK COKELAT SECARA TELITI:
  * Jika terlihat serat suwiran daging/ayam memanjang (apalagi dengan taburan wijen atau bumbu kecap/teriyaki), namai "Ayam Suwir Kecap" / "Ayam Teriyaki" / "Daging Suwir" — JANGAN menyebutnya "Tempe Orek"!
  * Hanya namai "Tempe Orek" atau "Tempe Goreng" bila jelas terlihat tekstur pori kacang kedelai berbentuk dadu/potongan/irisan tempe.

Instruksi Analisis Menyeluruh:
1. Validasi Nampan MBG:
   - Apakah foto menampilkan nampan bersekat berisi makanan siap saji?
   - Jika foto BUKAN makanan (contoh: selfie, meja kosong, kertas dokumen, kendaraan, foto buram tanpa makanan), set "is_valid_food_tray": false dan "rejection_reason_id": "Foto bukan nampan bersekat makanan MBG yang valid".
   - Jika YA, set "is_valid_food_tray": true dan "rejection_reason_id": null.

2. Identifikasi SELURUH Komponen di Nampan ("detected_items"):
   - Periksa setiap sekat (termasuk multi-protein seperti ayam + telur, lalapan timun/selada/tomat, tumisan, sambal/saus, kerupuk, maupun susu kotak UHT / minuman kemasan).
   - Untuk SETIAP item yang terlihat, buat 1 objek dalam array "detected_items": { "name", "category" ("karbohidrat"|"protein"|"sayur"|"buah"|"susu_minuman"|"sambal_pelengkap"), "matched_catalog_id" (atau null), "estimated_holding_hours", "is_high_risk" }.
   - ATURAN KETAT matched_catalog_id: isi ID katalog HANYA JIKA jenis hidangan dan cara masaknya benar-benar identik (mis. "Nasi Putih" -> "nasi-putih", "Susu Kotak UHT" -> "susu-kotak-uht"). WAJIB isi null jika beda cara masak/olahan atau tidak ada di katalog! JANGAN memaksakan mencocokkan "Ayam Suwir Teriyaki" atau "Tempe Goreng" ke "tempe-orek".

3. Ringkasan 4 Pilar Gizi Utama ("nutrition_checks"):
   - karbohidrat, protein, sayur (termasuk lalapan timun/selada & tumisan!), buah. Jika tidak terlihat, present: false dan detected_label: "Tidak terlihat".

4. Pencocokan ID Katalog ("matched_menu_item_ids"), "has_wet_or_coconut_milk_component", "risk_notes_id", "confidence_score". Hanya sertakan ID katalog yang matched_catalog_id-nya tidak null.

Referensi Katalog Menu SPPG (Opsional — hanya untuk pencocokan ID yang identik, BUKAN pilihan terbatas):
${catalogPromptList || 'Katalog opsional kosong: gunakan matched_catalog_id null untuk semua item.'}

Format output HARUS JSON valid murni persis sesuai struktur ini:
{
  "is_valid_food_tray": true,
  "rejection_reason_id": null,
  "nutrition_checks": {
    "karbohidrat": { "present": true, "detected_label": "Nasi Putih" },
    "protein": { "present": true, "detected_label": "Ayam Suwir Teriyaki" },
    "sayur": { "present": true, "detected_label": "Tumis Buncis Wortel" },
    "buah": { "present": true, "detected_label": "Jeruk" }
  },
  "detected_items": [
    { "name": "Nasi Putih", "category": "karbohidrat", "matched_catalog_id": "nasi-putih", "estimated_holding_hours": 4.5, "is_high_risk": false },
    { "name": "Ayam Suwir Teriyaki", "category": "protein", "matched_catalog_id": null, "estimated_holding_hours": 4.0, "is_high_risk": false }
  ],
  "matched_menu_item_ids": ["nasi-putih"],
  "has_wet_or_coconut_milk_component": false,
  "risk_notes_id": "Menu standar higienis dengan batas aman 4,0 jam.",
  "confidence_score": 0.95
}`;

    // Clean base64 string
    const cleanBase64 = String(imageBase64).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const allErrors: string[] = [];
    let aiResponseJson: any = null;
    let providerUsed: 'gemini' | 'groq' = 'gemini';
    let modelUsed = '';
    let fallbackTriggered = false;

    for (let idx = 0; idx < providerOrder.length; idx++) {
      const provider = providerOrder[idx];
      if (provider === 'gemini' && geminiApiKey) {
        const res = await tryGeminiVision(
          geminiApiKey,
          geminiCandidates,
          systemPrompt,
          mimeType,
          cleanBase64
        );
        allErrors.push(...res.errors);
        if (res.parsed) {
          aiResponseJson = res.parsed;
          providerUsed = 'gemini';
          modelUsed = res.model;
          fallbackTriggered = idx > 0 || res.errors.length > 0;
          break;
        }
      } else if (provider === 'groq' && groqApiKey) {
        const res = await tryGroqVision(
          groqApiKey,
          groqCandidates,
          systemPrompt,
          mimeType,
          cleanBase64
        );
        allErrors.push(...res.errors);
        if (res.parsed) {
          aiResponseJson = res.parsed;
          providerUsed = 'groq';
          modelUsed = res.model;
          fallbackTriggered = idx > 0 || res.errors.length > 0;
          break;
        }
      }
    }

    if (!aiResponseJson) {
      return new Response(
        JSON.stringify({
          error: 'All upstream AI vision providers (Gemini & Groq) failed',
          details: allErrors.join(' | '),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Ensure response adheres strictly to AnalysisResponse structure
    const normalizedDetectedItems: DetectedFoodItem[] = Array.isArray(aiResponseJson.detected_items)
      ? aiResponseJson.detected_items
          .map((item: any) => {
            const name = String(item?.name ?? '').trim();
            if (!name) return null;
            const hrs = Number(item?.estimated_holding_hours);
            const safeHours =
              Number.isFinite(hrs) && hrs >= 1 && hrs <= 12 ? Math.round(hrs * 2) / 2 : 4.5;
            return {
              name,
              category: normalizeEdgeCategory(item?.category),
              matched_catalog_id:
                typeof item?.matched_catalog_id === 'string' &&
                item.matched_catalog_id.trim().length > 0
                  ? item.matched_catalog_id.trim()
                  : null,
              estimated_holding_hours: safeHours,
              is_high_risk: safeHours <= 3.5,
            } as DetectedFoodItem;
          })
          .filter((item: DetectedFoodItem | null): item is DetectedFoodItem => item !== null)
      : [];

    const mergedMatchedIds = Array.from(
      new Set([
        ...(Array.isArray(aiResponseJson.matched_menu_item_ids)
          ? aiResponseJson.matched_menu_item_ids.filter(
              (id: unknown): id is string => typeof id === 'string' && id.trim().length > 0
            )
          : []),
        ...normalizedDetectedItems
          .map((d) => d.matched_catalog_id)
          .filter((id): id is string => Boolean(id)),
      ])
    );

    const structuredResult: AnalysisResponse = {
      is_valid_food_tray: Boolean(aiResponseJson.is_valid_food_tray),
      rejection_reason_id: aiResponseJson.rejection_reason_id || null,
      nutrition_checks: {
        karbohidrat: {
          present: Boolean(aiResponseJson.nutrition_checks?.karbohidrat?.present),
          detected_label:
            aiResponseJson.nutrition_checks?.karbohidrat?.detected_label ||
            (aiResponseJson.nutrition_checks?.karbohidrat?.present ? 'Karbohidrat' : 'Tidak terlihat'),
        },
        protein: {
          present: Boolean(aiResponseJson.nutrition_checks?.protein?.present),
          detected_label:
            aiResponseJson.nutrition_checks?.protein?.detected_label ||
            (aiResponseJson.nutrition_checks?.protein?.present ? 'Protein' : 'Tidak terlihat'),
        },
        sayur: {
          present: Boolean(aiResponseJson.nutrition_checks?.sayur?.present),
          detected_label:
            aiResponseJson.nutrition_checks?.sayur?.detected_label ||
            (aiResponseJson.nutrition_checks?.sayur?.present ? 'Sayur' : 'Tidak terlihat'),
        },
        buah: {
          present: Boolean(aiResponseJson.nutrition_checks?.buah?.present),
          detected_label:
            aiResponseJson.nutrition_checks?.buah?.detected_label ||
            (aiResponseJson.nutrition_checks?.buah?.present ? 'Buah' : 'Tidak terlihat'),
        },
      },
      detected_items: normalizedDetectedItems,
      matched_menu_item_ids: mergedMatchedIds,
      has_wet_or_coconut_milk_component: Boolean(
        aiResponseJson.has_wet_or_coconut_milk_component
      ),
      risk_notes_id:
        aiResponseJson.risk_notes_id ||
        (aiResponseJson.has_wet_or_coconut_milk_component
          ? 'Terdeteksi komponen bersantan/berkuah yang mengunci batas aman menjadi 3,5 jam.'
          : 'Menu standar higienis dengan batas aman 4,5 jam.'),
      confidence_score:
        typeof aiResponseJson.confidence_score === 'number'
          ? aiResponseJson.confidence_score
          : 0.9,
      provider_used: providerUsed,
      model_used: modelUsed,
      fallback_triggered: fallbackTriggered,
    };

    return new Response(JSON.stringify(structuredResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error in Edge Function',
        message: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
