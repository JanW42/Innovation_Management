import { openaiMode, getClient, model, extractJson } from './openai';

interface ResearchResult {
  domain?: string;
  url?: string;
  note?: string;
}

const PROVIDER_HINTS: Record<string, { domain: string; url: string; note: string }> = {
  DAK: { domain: 'dak.de', url: 'https://www.dak.de', note: 'Offizielle DAK-Gesundheit-Website. Kündigungen i. d. R. per Brief/E-Mail an den Kundenservice.' },
  'AOK': { domain: 'aok.de', url: 'https://www.aok.de', note: 'Offizielle AOK-Website. Zuständige Regionalgesellschaft wählen.' },
  TK: { domain: 'tk.de', url: 'https://www.tk.de', note: 'Offizielle Techniker Krankenkasse-Website.' },
  BARMER: { domain: 'barmeg.de', url: 'https://www.barmeg.de', note: 'Offizielle BARMER-Website.' },
  TELEKOM: { domain: 'telekom.de', url: 'https://www.telekom.de', note: 'Offizielle Telekom-Website. Kündigungsadresse im Vertrag prüfen.' },
  VODAFONE: { domain: 'vodafone.de', url: 'https://www.vodafone.de', note: 'Offizielle Vodafone-Website.' },
  NETFLIX: { domain: 'netflix.com', url: 'https://www.netflix.com', note: 'Kündigung nur im Konto (Portal).' },
  SPOTIFY: { domain: 'spotify.com', url: 'https://www.spotify.com', note: 'Kündigung nur im Konto (Portal).' },
  AMAZON: { domain: 'amazon.de', url: 'https://www.amazon.de', note: 'Abonnements unter „Meine Inhalte und Geräte“ kündigen.' }
};

export interface ProviderResearch {
  domain: string;
  url: string;
  note: string;
  source: 'web-search' | 'hint';
}

export async function researchProvider(providerName: string): Promise<ProviderResearch | null> {
  const normalized = providerName.toUpperCase();
  for (const [key, hint] of Object.entries(PROVIDER_HINTS)) {
    if (normalized.includes(key)) return { ...hint, source: 'hint' };
  }
  if (openaiMode() !== 'live') return null; // lokal (llama.cpp): keine Websuche, nur vorab geprüfte Links
  try {
    const response = await getClient().responses.create({
      model: model('OPENAI_SEARCH_MODEL', 'gpt-5.5'),
      tools: [{ type: 'web_search' }],
      input: `Finde die offizielle Website des deutschen Unternehmens „${providerName}“. Antworte nur mit JSON: {"domain":"offizielle-domain.de","url":"https://...","note":"ein Satz zum offiziellen Kündigungs- oder Kontaktweg"}. Nutze ausschließlich die offizielle Anbieterseite, keine Portale Dritter.`
    });
    const parsed = extractJson<ResearchResult>(response.output_text ?? '');
    if (parsed?.url && parsed.url.startsWith('http')) {
      return { domain: parsed.domain ?? '', url: parsed.url, note: parsed.note ?? '', source: 'web-search' };
    }
    return null;
  } catch {
    return null;
  }
}

