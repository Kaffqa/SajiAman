/**
 * SajiAman Environment Configuration & Production Hygiene Guard
 * Validates public runtime variables without exposing any server secrets.
 */

export type AiProviderName = 'gemini' | 'groq';

export interface AppEnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  dataSource: 'supabase' | 'mock';
  isConfigured: boolean;
  geminiApiKey: string;
  geminiModel: string;
  groqApiKey: string;
  groqModel: string;
  aiProviderOrder: AiProviderName[];
}

function parseAiProviderOrder(raw?: string): AiProviderName[] {
  if (!raw) return ['gemini', 'groq'];
  const parsed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is AiProviderName => s === 'gemini' || s === 'groq');
  const unique = parsed.filter((v, i, a) => a.indexOf(v) === i);
  return unique.length > 0 ? unique : ['gemini', 'groq'];
}

export function validateEnvironment(): AppEnvConfig {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  const configuredDataSource = process.env.EXPO_PUBLIC_DATA_SOURCE;
  const geminiApiKey =
    process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  const geminiModel = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-4-hydrogen';
  const groqApiKey =
    process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY || '';
  const groqModel = process.env.EXPO_PUBLIC_GROQ_MODEL || 'qwen/qwen3.8-27b';
  const aiProviderOrder = parseAiProviderOrder(process.env.EXPO_PUBLIC_AI_PROVIDER_ORDER);

  const isConfigured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder')
  );

  const dataSource: 'supabase' | 'mock' =
    isConfigured && configuredDataSource !== 'mock' ? 'supabase' : 'mock';

  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

  if (!isConfigured && isDev) {
    console.warn(
      '[SajiAman Env] Running in offline mock mode. Set EXPO_PUBLIC_SUPABASE_URL & EXPO_PUBLIC_SUPABASE_ANON_KEY to connect to live Supabase backend.'
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    dataSource,
    isConfigured,
    geminiApiKey,
    geminiModel,
    groqApiKey,
    groqModel,
    aiProviderOrder,
  };
}

export const ENV = validateEnvironment();
