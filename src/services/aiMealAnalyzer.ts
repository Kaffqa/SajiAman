/**
 * SajiAman AI Meal Analyzer Service
 * Integrates Expo Image Manipulator client compression with Dual-AI Vision
 * (Supabase Edge Function -> Gemini Hydrogen/3.8 -> Groq Qwen 3.8 27B fallback).
 */

import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { ENV } from '../config/env';
import { MENU_CATALOG } from '../data/mockRepository';
import {
  buildMealInspectionPrompt,
  extractJsonObjectFromAiText,
  normalizeAiMealAnalysis,
  type CatalogPromptItem,
  type DetectedFoodItem,
  type MealAiCoreResult,
  type NutritionComponentCheck,
} from '../domain/aiResponseParser';
import { supabase } from '../lib/supabase';
import type { MenuItem } from '../types/sajiaman';

export type { DetectedFoodItem, NutritionComponentCheck };

export type AiVerificationSource =
  | 'edge_ai'
  | 'edge_gemini'
  | 'edge_groq'
  | 'gemini_direct'
  | 'groq_direct'
  | 'ai_unavailable'
  | 'fallback_rule';

export interface MealAiVerificationResult extends MealAiCoreResult {
  compressedUri: string;
  source: AiVerificationSource;
  providerUsed?: 'gemini' | 'groq' | 'fallback_rule';
  modelUsed?: string;
  fallbackTriggered?: boolean;
  errorMessage?: string;
}

const DIRECT_TIMEOUT_MS = 18000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DIRECT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Direct Gemini REST API caller (Hydrogen -> 3.8 Flash -> 3.5 Flash) for local QA before Edge deploy.
 */
async function callGeminiVisionDirect(
  base64: string,
  menuCatalogPayload: CatalogPromptItem[],
  apiKey: string,
  modelName: string = 'gemini-4-hydrogen'
): Promise<{ parsed: any; model: string } | null> {
  const systemPrompt = buildMealInspectionPrompt(menuCatalogPayload);
  const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const candidateModels = [
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    modelName,
    'gemini-2.0-flash',
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const resp = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
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
        const json = await resp.json();
        const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return { parsed: extractJsonObjectFromAiText(rawText), model };
        }
      }
    } catch (err) {
      console.warn(`[aiMealAnalyzer] Direct Gemini (${model}) notice:`, err);
    }
  }
  return null;
}

/**
 * Direct Groq OpenAI-compatible Vision caller (qwen/qwen3.8-27b) for local QA & fallback.
 */
async function callGroqVisionDirect(
  base64: string,
  menuCatalogPayload: CatalogPromptItem[],
  apiKey: string,
  modelName: string = 'qwen/qwen3.8-27b'
): Promise<{ parsed: any; model: string } | null> {
  const systemPrompt = buildMealInspectionPrompt(menuCatalogPayload);
  const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
  const dataUrl = `data:image/jpeg;base64,${cleanBase64}`;
  const candidateModels = [
    modelName,
    'qwen/qwen3.8-27b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
  ].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);

  for (const model of candidateModels) {
    const buildBody = (withReasoningEffort: boolean) => ({
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
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildBody(true)),
      });

      if (!resp.ok && resp.status === 400) {
        const bodyText = await resp.text();
        if (bodyText.toLowerCase().includes('reasoning_effort')) {
          resp = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(buildBody(false)),
          });
        } else {
          console.warn(`[aiMealAnalyzer] Direct Groq (${model}) 400:`, bodyText.slice(0, 180));
          continue;
        }
      }

      if (resp.ok) {
        const json = await resp.json();
        const rawText = json?.choices?.[0]?.message?.content;
        if (rawText) {
          return { parsed: extractJsonObjectFromAiText(rawText), model };
        }
      } else {
        const errBody = await resp.text();
        console.warn(`[aiMealAnalyzer] Direct Groq (${model}) HTTP ${resp.status}:`, errBody.slice(0, 180));
      }
    } catch (err) {
      console.warn(`[aiMealAnalyzer] Direct Groq (${model}) notice:`, err);
    }
  }
  return null;
}

async function compressWebDataUrl(
  dataUrl: string,
  maxWidth: number,
  quality: number
): Promise<{ uri: string; base64: string } | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({
          uri: compressedDataUrl,
          base64: compressedDataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''),
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Compresses an image to max width 1280px with JPEG quality 0.80,
 * returning both the compressed file URI and base64 string.
 */
export async function compressImageForAi(imageUri: string): Promise<{ uri: string; base64: string }> {
  try {
    if (
      imageUri.startsWith('http://') ||
      imageUri.startsWith('https://') ||
      imageUri.startsWith('data:') ||
      (Platform.OS === 'web' && (imageUri.startsWith('/') || imageUri.startsWith('blob:')))
    ) {
      if (imageUri.startsWith('data:')) {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
          try {
            const resized = await compressWebDataUrl(imageUri, 1280, 0.8);
            if (resized) return resized;
          } catch {
            // Fall through to raw data URL
          }
        }
        return {
          uri: imageUri,
          base64: imageUri.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''),
        };
      }
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} saat membaca gambar`);
      }
      const blob = await response.blob();
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (Platform.OS === 'web' && typeof document !== 'undefined' && rawDataUrl) {
        try {
          const resized = await compressWebDataUrl(rawDataUrl, 1280, 0.8);
          if (resized) return resized;
        } catch {
          // Fall through to raw data URL
        }
      }
      return {
        uri: imageUri,
        base64: rawDataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''),
      };
    }

    // Native / Local file URI
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1280 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    let base64 = manipResult.base64;
    if (!base64 && manipResult.uri) {
      base64 = await new File(manipResult.uri).base64();
    }

    return {
      uri: manipResult.uri,
      base64: base64 || '',
    };
  } catch (err) {
    console.warn('[aiMealAnalyzer] Compression fallback notice:', err);
    try {
      if (!imageUri.startsWith('http') && Platform.OS !== 'web') {
        const directBase64 = await new File(imageUri).base64();
        return { uri: imageUri, base64: directBase64 };
      }
    } catch {
      // ignore
    }
    return { uri: imageUri, base64: '' };
  }
}

/**
 * Verifies the tray sample via Supabase Edge Function (Dual-AI Gemini + Groq Vision)
 * and falls back cleanly to local DEV Gemini/Groq APIs before reporting unavailability.
 * Never fabricates an AI-verified badge when all providers fail.
 */
export async function verifyMealSampleWithGemini(
  imageUri: string,
  preferredVariant: 'lodeh' | 'soto' = 'lodeh',
  options?: { activeCatalog?: MenuItem[] }
): Promise<MealAiVerificationResult> {
  const { uri: compressedUri, base64 } = await compressImageForAi(imageUri);

  const catalogSource =
    options?.activeCatalog && options.activeCatalog.length > 0
      ? options.activeCatalog
      : MENU_CATALOG;

  const menuCatalogPayload: CatalogPromptItem[] = catalogSource.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    holding_time_minutes: Math.round(m.holdingHours * 60),
  }));

  const defaultVariantIds =
    preferredVariant === 'lodeh'
      ? ['nasi-putih', 'ayam-goreng', 'sayur-lodeh', 'pisang-ambon']
      : ['nasi-putih', 'tempe-orek', 'sop-wortel-bakso', 'jeruk-medan'];

  if (base64) {
    // 1. Primary path: Supabase Edge Function (server-side Gemini -> Groq fallback) with 20s guard
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const invokePromise = supabase.functions.invoke('analyze-meal-sample', {
        body: {
          imageBase64: base64,
          mimeType: 'image/jpeg',
          menuCatalog: menuCatalogPayload,
        },
      });
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) => {
        timeoutId = setTimeout(
          () => resolve({ data: null, error: new Error('Edge Function timeout') }),
          20000
        );
      });
      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);

      if (!error && data && data.nutrition_checks) {
        const normalized = normalizeAiMealAnalysis(data, defaultVariantIds);
        const provider = data.provider_used === 'groq' ? 'groq' : 'gemini';
        return {
          ...normalized,
          compressedUri,
          source: provider === 'groq' ? 'edge_groq' : 'edge_gemini',
          providerUsed: provider,
          modelUsed: typeof data.model_used === 'string' ? data.model_used : undefined,
          fallbackTriggered: Boolean(data.fallback_triggered),
        };
      } else if (error) {
        console.warn('[aiMealAnalyzer] Edge function error, checking DEV dual-AI fallback:', error.message);
      }
    } catch (edgeErr) {
      console.warn('[aiMealAnalyzer] Edge function unreachable, checking DEV dual-AI fallback:', edgeErr);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    // 2. Local DEV Dual-AI fallback (strictly __DEV__ only — production APK only calls Edge Function)
    const allowDirectClientFallback = typeof __DEV__ !== 'undefined' && __DEV__;
    if (allowDirectClientFallback) {
      for (let i = 0; i < ENV.aiProviderOrder.length; i++) {
        const provider = ENV.aiProviderOrder[i];
        if (provider === 'gemini' && ENV.geminiApiKey) {
          const res = await callGeminiVisionDirect(
            base64,
            menuCatalogPayload,
            ENV.geminiApiKey,
            ENV.geminiModel
          );
          if (res?.parsed?.nutrition_checks) {
            return {
              ...normalizeAiMealAnalysis(res.parsed, defaultVariantIds),
              compressedUri,
              source: 'gemini_direct',
              providerUsed: 'gemini',
              modelUsed: res.model,
              fallbackTriggered: i > 0,
            };
          }
        } else if (provider === 'groq' && ENV.groqApiKey) {
          const res = await callGroqVisionDirect(
            base64,
            menuCatalogPayload,
            ENV.groqApiKey,
            ENV.groqModel
          );
          if (res?.parsed?.nutrition_checks) {
            return {
              ...normalizeAiMealAnalysis(res.parsed, defaultVariantIds),
              compressedUri,
              source: 'groq_direct',
              providerUsed: 'groq',
              modelUsed: res.model,
              fallbackTriggered: i > 0,
            };
          }
        }
      }
    }
  }

  // 3. Explicit unavailable error (never fake a Verified badge on error)
  return {
    is_valid_food_tray: false,
    rejection_reason_id: null,
    nutrition_checks: {
      karbohidrat: { present: false, detected_label: '-' },
      protein: { present: false, detected_label: '-' },
      sayur: { present: false, detected_label: '-' },
      buah: { present: false, detected_label: '-' },
    },
    detected_items: [],
    matched_menu_item_ids: [],
    has_wet_or_coconut_milk_component: false,
    risk_notes_id: '',
    confidence_score: 0,
    compressedUri,
    source: 'ai_unavailable',
    errorMessage: !base64
      ? 'Gagal membaca data gambar dari kamera. Silakan ambil ulang foto atau lanjut input manual.'
      : 'Layanan AI Gemini & Groq belum merespons (offline/kuota habis). Coba analisis ulang atau lanjutkan dengan Input Manual.',
  };
}
