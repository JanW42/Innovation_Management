import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { openaiMode, isLocalLLM, getChatClient, model, extractJson } from './openai';

export interface ParsedTx {
  booking_date: string;
  value_date?: string;
  counterparty: string;
  purpose?: string;
  amount_minor: number;
  creditor_id?: string;
  mandate_ref?: string;
}

export interface ParsedStatement {
  transactions: ParsedTx[];
  period_start?: string;
  period_end?: string;
  source: 'csv' | 'pdf-text' | 'vision';
}

export function parseAmountEuro(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

function parseGermanDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const month = Number(m[2]);
  const day = Number(m[1]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseCsvStatement(text: string): ParsedStatement {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const hasHeader = /buchung|wert|betrag|empfaenger|verwendung/i.test(lines[0] ?? '');
  const rows = (hasHeader ? lines.slice(1) : lines).map((line) => {
    const delim = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
    return line.split(delim).map((c) => c.trim());
  });
  const transactions: ParsedTx[] = [];
  for (const cols of rows) {
    if (cols.length < 2) continue;
    let amountIdx = -1;
    let amount: number | null = null;
    for (let i = cols.length - 1; i >= 0; i--) {
      const v = parseAmountEuro(cols[i]);
      if (v != null && v !== 0) { amountIdx = i; amount = v; break; }
    }
    if (amount == null) continue;
    const dateIdxs: number[] = [];
    let booking: string | null = null;
    let value: string | null = null;
    for (let i = 0; i < cols.length; i++) {
      const d = parseGermanDate(cols[i]);
      if (d) {
        dateIdxs.push(i);
        if (!booking) booking = d;
        else if (!value) value = d;
      }
    }
    if (!booking) continue;
    const restCols = cols.filter((_, i) => i !== amountIdx && !dateIdxs.includes(i)).map((c) => c.trim()).filter(Boolean);
    const [counterparty, ...purposeParts] = restCols;
    if (!counterparty) continue;
    transactions.push({
      booking_date: booking,
      value_date: value && value !== booking ? value : undefined,
      counterparty,
      purpose: purposeParts.join(' ') || undefined,
      amount_minor: amount
    });
  }
  const dates = transactions.map((t) => t.booking_date).sort();
  return {
    transactions,
    period_start: dates[0],
    period_end: dates[dates.length - 1],
    source: 'csv'
  };
}

export async function extractPdfText(buffer: Uint8Array): Promise<string> {
  const doc = await getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
  }
  await doc.destroy();
  return text;
}

export function parseStatementText(text: string): ParsedTx[] {
  const out: ParsedTx[] = [];
  const lineRe = /(\d{2}\.\d{2}\.\d{2,4})\s+(.+?)\s{2,}(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(lineRe);
    if (!m) continue;
    const date = parseGermanDate(m[1]);
    const amount = parseAmountEuro(m[3]);
    if (!date || amount == null || amount === 0) continue;
    const middle = m[2].trim();
    if (!middle || middle.length < 2) continue;
    const parts = middle.split(/\s{2,}/);
    const counterparty = parts[0];
    out.push({
      booking_date: date,
      counterparty,
      purpose: parts.slice(1).join(' ').trim() || undefined,
      amount_minor: amount
    });
  }
  return out;
}

interface VisionResult {
  transactions?: Array<Record<string, unknown>>;
  period_start?: string;
  period_end?: string;
}

export async function visionExtractStatement(
  fileName: string,
  mimeType: string,
  buffer: Uint8Array
): Promise<ParsedStatement | null> {
  if (openaiMode() === 'mock') return null;
  // llama.cpp akzeptiert keine PDF-Datei-Inputs; nur Bilder (JPG/PNG)
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
    if (isLocalLLM()) return null;
  }
  const dataUrl = `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
  const prompt = 'Dies ist ein deutscher Kontoauszug. Extrahiere alle Buchungen. Antworte nur mit JSON: {"transactions":[{"booking_date":"YYYY-MM-DD","value_date":"YYYY-MM-DD","counterparty":"Name","purpose":"Zweck","amount_eur":0.0,"creditor_id":"DE74... oder null","mandate_ref":"null oder Referenz"}],"period_start":"YYYY-MM-DD","period_end":"YYYY-MM-DD"}. Abbuchungen negativ, Gutschriften positiv. Währung EUR.';
  const response = await getChatClient().chat.completions.create({
    model: model('OPENAI_EXTRACTION_MODEL', 'local'),
    max_tokens: 4096,
    ...( { chat_template_kwargs: { enable_thinking: false } } as Record<string, unknown>),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ]
  });
  const text = response.choices[0]?.message?.content ?? '';
  const parsed = extractJson<VisionResult>(text);
  if (!parsed?.transactions) return null;
  const transactions: ParsedTx[] = [];
  for (const t of parsed.transactions) {
    const amountEur = Number(t.amount_eur);
    if (!t.booking_date || Number.isNaN(amountEur)) continue;
    transactions.push({
      booking_date: String(t.booking_date),
      value_date: t.value_date ? String(t.value_date) : undefined,
      counterparty: String(t.counterparty ?? 'Unbekannt'),
      purpose: t.purpose ? String(t.purpose) : undefined,
      amount_minor: Math.round(amountEur * 100),
      creditor_id: t.creditor_id ? String(t.creditor_id) : undefined,
      mandate_ref: t.mandate_ref ? String(t.mandate_ref) : undefined
    });
  }
  return { transactions, period_start: parsed.period_start, period_end: parsed.period_end, source: 'vision' };
}

export interface DeathCertificateFields {
  first_name?: string;
  last_name?: string;
  birth_date?: string;
  death_date?: string;
  death_place?: string;
}

export async function visionExtractDeathCertificate(
  fileName: string,
  mimeType: string,
  buffer: Uint8Array
): Promise<DeathCertificateFields | null> {
  if (openaiMode() === 'mock') return null;
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
    if (isLocalLLM()) return null;
  }
  const dataUrl = `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`;
  const response = await getChatClient().chat.completions.create({
    model: model('OPENAI_EXTRACTION_MODEL', 'local'),
    max_tokens: 4096,
    ...( { chat_template_kwargs: { enable_thinking: false } } as Record<string, unknown>),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Dies ist eine deutsche Sterbeurkunde. Extrahiere die Felder. Antworte nur mit JSON: {"first_name":"","last_name":"","birth_date":"YYYY-MM-DD","death_date":"YYYY-MM-DD","death_place":""}. Fehlende Felder leer lassen.'
          },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ]
  });
  const text = response.choices[0]?.message?.content ?? '';
  return extractJson<DeathCertificateFields>(text);
}
