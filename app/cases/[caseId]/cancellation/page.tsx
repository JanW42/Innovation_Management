'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatEuro, formatDateTime } from '@/lib/format';

interface PreviewItem { contract: { id: string; provider_name: string; expected_amount_minor: number; interval: string; official_url: string | null }; channel: string; note: string; }
interface Cancellation { id: string; provider_name: string; expected_amount_minor: number; status: string; channel: string; approved_at: string | null; sent_at: string | null; confirmation_note: string | null; }
interface Ev { cancellation_id: string; event: string; at: string; }

const STATUS: Record<string, string> = {
  draft: 'Entwurf', approved: 'Freigegeben', sending: 'Wird versendet', sent: 'Versendet',
  confirmation_received: 'Bestätigung erhalten', failed: 'Fehler', ended: 'Beendet'
};

export default function CancellationPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [requesterName, setRequesterName] = useState('');
  const [requesterAddress, setRequesterAddress] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!caseId) return;
    const data = await fetch(`/api/cases/${caseId}/cancellations`, { cache: 'no-store' }).then((r) => r.json());
    setCancellations(data.cancellations ?? []);
    setEvents(data.events ?? []);
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return;
    const stored = sessionStorage.getItem(`selected_contracts_${caseId}`);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      setSelectedIds(ids);
      fetch(`/api/cases/${caseId}/cancellation/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contract_ids: ids })
      }).then((r) => r.json()).then((d) => {
        if (d.error) setError(d.error);
        else setPreview(d.items ?? []);
      });
    }
    void load();
  }, [caseId]);

  useEffect(() => {
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function approve(e: React.FormEvent) {
    e.preventDefault();
    if (!caseId || !confirmed) return;
    setBusy(true); setError('');
    const res = await fetch(`/api/cases/${caseId}/cancellation/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_ids: selectedIds, requester_name: requesterName, requester_address: requesterAddress, confirmed })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Fehler'); setBusy(false); return; }
    sessionStorage.removeItem(`selected_contracts_${caseId}`);
    setPreview(null); setSelectedIds([]); setConfirmed(false); setBusy(false);
    void load();
  }

  async function confirmCancellation(id: string, note: string) {
    await fetch(`/api/cases/${caseId}/cancellations/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note })
    });
    void load();
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-neutral-200 pb-4">
        <h1 className="text-xl font-semibold">Kündigungen</h1>
        <p className="text-sm text-neutral-500">Verträge auswählen, Brief prüfen, freigeben und den Versand verfolgen.</p>
      </header>

      {error && <p className="border border-black p-3 text-sm">{error}</p>}

      {preview && preview.length > 0 && (
        <form onSubmit={approve} className="card space-y-4">
          <h2 className="font-semibold">Kündigungs-Vorschau</h2>
          <ul className="space-y-2">
            {preview.map((item) => (
              <li key={item.contract.id} className="border border-neutral-200 p-3">
                <p className="font-medium">{item.contract.provider_name} · {formatEuro(Number(item.contract.expected_amount_minor))}</p>
                <p className="mt-1 text-sm text-neutral-500">{item.note}</p>
                {item.channel === 'email' && (
                  <p className="mt-2 border-l-2 border-black pl-3 text-xs text-neutral-600">
                    Der Brief enthält Name und Sterbedatum der verstorbenen Person und bittet um schriftliche Bestätigung der Kündigung.
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Ihr Name</label><input className="input" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} required /></div>
            <div><label className="label">Ihre Adresse (für den Brief)</label><input className="input" value={requesterAddress} onChange={(e) => setRequesterAddress(e.target.value)} /></div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Ich habe die Verträge geprüft und gebe die Kündigungen ausdrücklich frei.
          </label>
          <button className="btn btn-primary" disabled={!confirmed || busy}>
            {busy ? 'Wird verarbeitet …' : `${preview.length} Kündigung(en) freigeben`}
          </button>
        </form>
      )}

      {!preview && (
        <div className="card py-8 text-center text-sm text-neutral-500">
          Noch keine Kündigungen vorbereitet. <Link className="underline" href={`/cases/${caseId}/contracts`}>Verträge auswählen →</Link>
        </div>
      )}

      {cancellations.length > 0 && (
        <section className="card overflow-x-auto p-0">
          <h2 className="border-b border-neutral-200 p-4 font-semibold">Verlauf</h2>
          <table className="table">
            <thead><tr><th>Anbieter</th><th>Kanal</th><th>Status</th><th>Freigegeben</th><th>Versendet</th><th></th></tr></thead>
            <tbody>
              {cancellations.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.provider_name}</td>
                  <td>{c.channel === 'portal' ? 'Portal-Aufgabe' : 'Brief/E-Mail'}</td>
                  <td><span className="inline-block border border-neutral-300 px-2 py-0.5 text-xs">{STATUS[c.status] ?? c.status}</span></td>
                  <td>{formatDateTime(c.approved_at)}</td>
                  <td>{formatDateTime(c.sent_at)}</td>
                  <td>
                    {c.status === 'sent' ? (
                      <ConfirmButton onConfirm={(note) => confirmCancellation(c.id, note)} />
                    ) : c.status === 'failed' ? (
                      <span className="text-xs text-black">Fehler – Details prüfen</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4">
            <p className="label">Ereignisse</p>
            <ul className="space-y-2 text-sm leading-relaxed text-neutral-600">
              {events.slice(-10).reverse().map((e, i) => (
                <li key={i}>
                  <span className="mr-2 text-neutral-400">{formatDateTime(e.at)}</span>
                  {describeEvent(e.event)}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function describeEvent(event: string): string {
  if (event === 'approved') return 'Die Kündündigung wurde freigegeben. Der Kündigungsbrief wurde vorbereitet.';
  if (event.startsWith('sent')) return 'Die Kündündigung wurde an den Anbieter versendet. Jetzt wird auf eine Bestätigung gewartet.';
  if (event.startsWith('failed')) return 'Der Versand ist leider nicht durchgegangen. Bitte prüfen Sie die Details und versuchen Sie es erneut.';
  if (event === 'confirmation_received') return 'Der Anbieter hat die Kündigung bestätigt. Der Vertrag ist damit beendet.';
  return event;
}

function ConfirmButton({ onConfirm }: { onConfirm: (note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  return open ? (
    <span className="flex items-center gap-1">
      <input className="input w-40 px-2 py-1 text-xs" placeholder="Hinweis (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn px-2 py-1 text-xs" onClick={() => { onConfirm(note); setOpen(false); }}>Bestätigung erhalten</button>
    </span>
  ) : (
    <button className="btn px-2 py-1 text-xs" onClick={() => setOpen(true)}>Bestätigung</button>
  );
}
