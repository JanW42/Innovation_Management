/**
 * Zentrale Einstellungen für den Modell-Endpunkt der Hilfe.
 * Hinweis: Dieses Projekt hat kein Python-Backend – die geplante settings.py
 * entspricht dieser Datei.
 */

/** True = lokales Modell (llama.cpp via LLM_BASE_URL), False = OpenRouter. */
export const MODEL_ENDPOINT_LOCAL = false;

/** OpenRouter-Modell für die Hilfe (nur aktiv, wenn MODEL_ENDPOINT_LOCAL = false). */
export const OPENROUTER_CHAT_MODEL = 'openai/gpt-6-luna';

/** OpenRouter-API-Endpunkt (per Umgebungsvariable OPENROUTER_BASE_URL überschreibbar, z. B. für Tests). */
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';