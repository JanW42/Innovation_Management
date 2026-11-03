import OpenAI from 'openai';
import { MODEL_ENDPOINT_LOCAL, OPENROUTER_BASE_URL } from './settings';

let client: OpenAI | null = null;
let localClient: OpenAI | null = null;
let openrouterClient: OpenAI | null = null;

/** Lokal laufendes Modell (llama.cpp, OpenAI-kompatible API) */
export function isLocalLLM(): boolean {
  return Boolean(process.env.LLM_BASE_URL);
}

/** Hilfe-Endpunkt: 'local' (llama.cpp) oder 'openrouter', laut lib/settings.ts. */
export function chatEndpoint(): 'local' | 'openrouter' {
  return MODEL_ENDPOINT_LOCAL ? 'local' : 'openrouter';
}

/** OpenRouter-Client (OpenAI-kompatible API). */
export function getOpenRouterClient(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OpenRouter ist nicht konfiguriert (OPENROUTER_API_KEY fehlt)');
  if (!openrouterClient) {
    openrouterClient = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || OPENROUTER_BASE_URL,
      apiKey: process.env.OPENROUTER_API_KEY
    });
  }
  return openrouterClient;
}

export function openaiMode(): 'local' | 'live' | 'mock' {
  const m = process.env.OPENAI_MODE;
  if (m === 'mock') return 'mock';
  if (isLocalLLM()) return 'local';
  if (m === 'live') return 'live';
  return process.env.OPENAI_API_KEY ? 'live' : 'mock';
}

/** Chat-fähiger Client: lokal (llama.cpp) oder OpenAI. */
export function getChatClient(): OpenAI {
  if (isLocalLLM()) {
    if (!localClient) {
      localClient = new OpenAI({
        baseURL: process.env.LLM_BASE_URL,
        apiKey: process.env.LLM_API_KEY || 'local'
      });
    }
    return localClient;
  }
  return getClient();
}

export function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI ist nicht konfiguriert (OPENAI_API_KEY fehlt)');
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/** Modellname: lokal i. d. R. egal (llama.cpp nimmt das geladene Modell), sonst OpenAI-Modell. */
export function model(env: string, fallback: string): string {
  const name = process.env[env];
  if (name) return name;
  return isLocalLLM() ? 'local' : fallback;
}

export function extractJson<T>(text: string): T | null {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}