'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { CrossIcon } from '@/components/icons';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  streaming?: boolean;
}

const SUGGESTIONS = ['Was ist als Nächstes zu tun?', 'Wie lade ich Kontoauszüge hoch?', 'Wie kündige ich die Verträge?', 'Was brauche ich von der Sterbeurkunde?'];

export default function ChatPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Guten Tag. Ich begleite Sie behutsam durch die nächsten Schritte. Was möchten Sie wissen?' }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  function updateAssistant(index: number, update: (msg: Msg) => Msg) {
    setMessages((prev) => {
      const copy = [...prev];
      copy[index] = update(copy[index] ?? { role: 'assistant', content: '' });
      return copy;
    });
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    const assistantIndex = next.length;
    setMessages([...next, { role: 'assistant', content: '', streaming: true }]);
    setInput('');
    setBusy(true);
    let content = '';
    let sources: string[] = [];
    try {
      const res = await fetch(`/api/cases/${caseId}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next })
      });
      if (!res.ok || !res.body) {
        let message = 'Bei der Antwort ist ein Fehler aufgetreten.';
        try {
          const data = await res.json();
          if (data.error) message = String(data.error);
        } catch { /* Antwort war kein JSON */ }
        updateAssistant(assistantIndex, () => ({ role: 'assistant', content: `Entschuldigung: ${message}` }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            let payload: { delta?: string; sources?: string[]; error?: string };
            try {
              payload = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (typeof payload.delta === 'string') content += payload.delta;
            if (Array.isArray(payload.sources)) sources = payload.sources;
            if (typeof payload.error === 'string' && !content) content = payload.error;
          }
        }
        updateAssistant(assistantIndex, (msg) => ({
          ...msg,
          content: content || msg.content,
          sources: sources.length > 0 ? sources : msg.sources,
          streaming: true
        }));
      }
      updateAssistant(assistantIndex, (msg) => ({
        ...msg,
        content: content || 'Entschuldigung, ich habe keine Antwort erhalten. Bitte versuchen Sie es noch einmal.',
        sources: sources.length > 0 ? sources : msg.sources,
        streaming: false
      }));
    } catch {
      updateAssistant(assistantIndex, () => ({ role: 'assistant', content: 'Verbindungsfehler. Bitte versuchen Sie es erneut.' }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <header className="mb-4 flex items-center gap-3 border-b border-neutral-200 pb-4">
        <CrossIcon className="h-5 w-5" />
        <div>
          <h1 className="text-xl font-semibold">Hilfe</h1>
          <p className="text-sm text-neutral-500">Fragen Sie mich zu Ihren nächsten Schritten. Ich antworte behutsam und in Ruhe.</p>
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto pr-2">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-xl ${m.role === 'user' ? 'ml-auto' : ''}`}>
            <div className={`border p-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-black text-white' : 'border-neutral-200 bg-white'}`}>
              {m.content ? m.content : (
                <span className="flex items-center gap-1 py-1" aria-label="Antwort wird geladen">
                  <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
                </span>
              )}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 border-t border-neutral-200 pt-2">
                  {m.sources.map((s, j) => (
                    <a key={j} href={s} target="_blank" rel="noreferrer" className="text-xs underline">{s.replace('https://', '')}</a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {messages.length < 2 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => <button key={s} className="btn px-3 py-1 text-xs" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-neutral-200 pt-4">
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ihre Frage …" />
        <button className="btn btn-primary" disabled={busy || !input.trim()}>Senden</button>
      </form>
      <p className="mt-2 text-xs text-neutral-400">Antworten sind Entscheidungshilfe, keine Rechtsberatung.</p>
    </div>
  );
}