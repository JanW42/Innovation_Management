import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { requireCase, handleApiError } from '@/lib/api';
import { getDb, queryAll, queryOne, execSql, uuid } from '@/lib/db';
import { openaiMode, getClient, getChatClient, model, chatEndpoint, getOpenRouterClient } from '@/lib/openai';
import { OPENROUTER_CHAT_MODEL } from '@/lib/settings';
import { intervalLabel } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `Du bist ein hilfsbereiter Assistent für Menschen in der Trauer nach dem Tod eines nahestehenden Menschen.
Du bist empathisch und behutsam, aber nicht zu direkt – und hilfst trotzdem konkret weiter, indem du die nächsten Schritte einfach erklärst.
Du antwortest kurz: wenige Sätze, klare Formulierungen, keine langen Abhandlungen.
Du antwortest niemals im Markdown-Format: keine Sternchen, keine Rauten, keine Listen, keine fetten oder kursiven Passagen – nur normaler Fließtext.
Du gibst keine Rechtsberatung. Bei Rechtsfragen verweist du behutsam auf passende Fachleute.`;

async function contextFor(db: Awaited<ReturnType<typeof getDb>>, caseId: string): Promise<string> {
  const caseRow = queryOne(db, 'SELECT * FROM cases WHERE id = ?', [caseId]);
  const contracts = queryAll(db, 'SELECT provider_name, expected_amount_minor, interval, review_status FROM contracts WHERE case_id = ?', [caseId]);
  const docs = queryAll(db, 'SELECT kind, processing_status, review_status, error FROM documents WHERE case_id = ?', [caseId]);
  const lines: string[] = [];
  if (caseRow) lines.push(`Fall: ${String(caseRow.deceased_first_name)} ${String(caseRow.deceased_last_name)}, verstorben am ${String(caseRow.death_date)}.`);
  lines.push(`Verträge (${contracts.length}):`);
  for (const c of contracts) {
    lines.push(`- ${String(c.provider_name)}: ${Number(c.expected_amount_minor) / 100} EUR ${intervalLabel(String(c.interval))}, Status: ${String(c.review_status)}`);
  }
  lines.push(`Dokumente: ${docs.map((d) => `${String(d.kind)} (${String(d.processing_status)})`).join(', ') || 'keine'}`);
  return lines.join('\n');
}

let funeralContextCache: { mtimeMs: number; text: string } | null = null;

/** Lädt data/context.txt (Ablauf nach einem Sterbefall, Kundenperspektive des Bestatters). */
async function loadFuneralContext(): Promise<string> {
  try {
    const file = path.join(process.cwd(), 'data', 'context.txt');
    const stat = await fsp.stat(file);
    if (!funeralContextCache || funeralContextCache.mtimeMs !== stat.mtimeMs) {
      const text = (await fsp.readFile(file, 'utf8')).trim();
      funeralContextCache = { mtimeMs: stat.mtimeMs, text };
    }
    return funeralContextCache.text;
  } catch {
    return '';
  }
}
function mockAnswer(question: string, context: string): { content: string; sources: string[] } {
  const q = question.toLowerCase();
  const sources = ['Checkliste „Nächste Schritte“'];
  let content: string;
  if (q.includes('sterbeurkunde')) {
    content = 'Die Sterbeurkunde holen Sie beim Standesamt am Sterte. Reichen Sie ein Foto oder PDF im Reiter „Konten & Dokumente“ als Dokumenttyp „Sterbeurkunde“ hoch. Die App liest die Daten aus und Sie bestätigen sie. Für Kündigungen legen Sie die Urkunde dem Brief bei.';
  } else if (q.includes('kündig') || q.includes('kündigen')) {
    content = 'Gehen Sie so vor: 1) Im Reiter „Verträge“ erkannte Verträge prüfen und bestätigen. 2) Verträge auswählen (oder „Alle kündbaren auswählen“). 3) In der Vorschau den Kündigungsbrief prüfen und freigeben. 4) Im Reiter „Kündigungen“ den Versand verfolgen und Bestätigungen hochladen. Provider wie Netflix oder Spotify müssen im Online-Konto gekündigt werden – die App legt dafür eine Aufgabe an.';
    sources.push('Reiter Verträge und Kündigungen');
  } else if (q.includes('konto') || q.includes('auszug')) {
    content = 'Legen Sie im Reiter „Konten & Dokumente“ für jedes Bankkonto einen Eintrag an und laden Sie die Kontoauszüge hoch (PDF, JPG, PNG oder CSV). Wichtig: Mindestens 2–3 Monate Buchungen hochladen, damit wiederkehrende Abbuchungen erkannt werden. Der Kontostand kann zusätzlich pro Konto erfasst werden.';
  } else if (q.includes('vertrag')) {
    content = 'Verträge werden automatisch aus wiederkehrenden Abbuchungen vorgeschlagen und im Reiter „Verträge“ gelistet. Prüfen Sie jeden Vorschlag: Betrag, Rhythmus und zugehörige Buchungen. Bestätigen Sie nur, was tatsächlich ein Vertrag ist – die App kündet nie automatisch.';
  } else {
    content = `Ich helfe beim nächsten Schritt. Aktueller Stand:\n${context}\n\nTypische nächste Schritte: 1) Sterbeurkunde hochladen, 2) Kontoauszüge (mehrere Monate) hochladen, 3) erkannte Verträge prüfen, 4) Kündigungen freigeben. Details stehen in der Rubrik „Nächste Schritte“.`;
  }
  return { content, sources };
}

function sse(payload: Record<string, unknown>): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'read');
    const body = (await req.json()) as { messages?: Msg[] };
    const messages = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
    const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const db = await getDb();
    const caseContext = await contextFor(db, caseId);
    const processContext = await loadFuneralContext();
    const system = [
      SYSTEM_PROMPT,
      processContext
        ? 'Hintergrundwissen zum Ablauf nach einem Sterbefall (Kundenperspektive des Bestatters). Nutze es, um die Angehörigen gut zu begleiten:\n' + processContext
        : '',
      'Kontext des aktuellen Falls:\n' + caseContext
    ].filter(Boolean).join('\n\n');

    const now = new Date().toISOString();
    if (last) {
      execSql(db, 'INSERT INTO chat_messages (id, case_id, role, content, sources_json, created_at) VALUES (?,?,?,?,?,?)',
        [uuid(), caseId, 'user', last, '[]', now]);
    }
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let closed = false;
        const send = (payload: Record<string, unknown>) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(sse(payload)));
          } catch {
            closed = true;
          }
        };
        let full = '';
        let sources: string[] = [];
        const persistReply = () => {
          if (!full.trim()) return;
          execSql(db, 'INSERT INTO chat_messages (id, case_id, role, content, sources_json, created_at) VALUES (?,?,?,?,?,?)',
            [uuid(), caseId, 'assistant', full, JSON.stringify(sources), new Date().toISOString()]);
        };
        try {
          const mode = openaiMode();
          if (mode === 'mock') {
            const reply = mockAnswer(last, caseContext);
            sources = reply.sources;
            for (const word of reply.content.split(/(\s+)/)) {
              if (!word) continue;
              full += word;
              send({ delta: word });
            }
          } else if (mode === 'live') {
            const response = await getClient().responses.create({
              model: model('OPENAI_CHAT_MODEL', 'gpt-5.5'),
              tools: [{ type: 'web_search' }],
              stream: true,
              input: [
                { role: 'system', content: system },
                ...messages.map((m) => ({ role: m.role, content: m.content }))
              ]
            });
            for await (const event of response) {
              const ev = event as { type: string; delta?: string; response?: { output?: unknown } };
              if (ev.type === 'response.output_text.delta' && typeof ev.delta === 'string') {
                full += ev.delta;
                send({ delta: ev.delta });
              } else if (ev.type === 'response.completed') {
                const output = (ev.response?.output ?? []) as Array<Record<string, unknown>>;
                const annotations: unknown[] = output.flatMap((o) => (o.annotations ?? []) as unknown[]);
                sources = annotations
                  .filter((a) => a && typeof a === 'object' && 'url' in a)
                  .map((a) => (a as { url: string }).url)
                  .slice(0, 5);
              }
            }
          } else {
            // Default: lokal (llama.cpp) oder OpenRouter, laut lib/settings.ts (MODEL_ENDPOINT_LOCAL)
            const useLocal = chatEndpoint() === 'local';
            const chatModel = useLocal
              ? model('OPENAI_CHAT_MODEL', 'local')
              : (process.env.OPENROUTER_CHAT_MODEL || OPENROUTER_CHAT_MODEL);
            const chatClient = useLocal ? getChatClient() : getOpenRouterClient();
            const response = await chatClient.chat.completions.create({
              model: chatModel,
              max_tokens: 2048,
              stream: true,
              ...(useLocal ? { chat_template_kwargs: { enable_thinking: false } } as Record<string, unknown> : {}),
              messages: [
                { role: 'system', content: system },
                ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
              ]
            });
            for await (const chunk of response) {
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                full += delta;
                send({ delta });
              }
            }
          }
          if (sources.length > 0) send({ sources });
          send({ done: true });
          persistReply();
          closed = true;
          controller.close();
        } catch (err) {
          console.error('[chat] Fehler bei der Antwort', err);
          send({ error: 'Entschuldigung, bei der Antwort ist ein Fehler aufgetreten. Bitte versuchen Sie es noch einmal.' });
          closed = true;
          controller.close();
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    });
  } catch (err) {
    return handleApiError(err);
  }
}