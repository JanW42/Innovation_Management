'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatEuro } from '@/lib/format';

interface Contract {
  id: string; provider_name: string; provider_domain: string | null; official_url: string | null;
  expected_amount_minor: number; interval: string; recognition_score: number;
  recognition_reason: string | null; review_status: string; tx_count: number;
}

const INTERVALS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12, irregular: 12, unknown: 1 };
const STATUS: Record<string, string> = {
  suggested: 'Erkannt', confirmed: 'Geprüft', rejected: 'Abgelehnt', ended: 'Beendet'
};

export default function ContractsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [mName, setMName] = useState(''); const [mAmount, setMAmount] = useState('');
  const [mInterval, setMInterval] = useState('monthly');

  const load = useCallback(async () => {
    if (!caseId) return;
    const data = await fetch(`/api/cases/${caseId}/contracts`, { cache: 'no-store' }).then((r) => r.json());
    setContracts(data.contracts ?? []);
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const cancelable = contracts.filter((c) => ['suggested', 'confirmed'].includes(c.review_status));
  const monthly = contracts.filter((c) => !['rejected', 'ended'].includes(c.review_status))
    .reduce((s, c) => s + Math.round(Number(c.expected_amount_minor) / (INTERVALS[c.interval] ?? 1)), 0);

  async function act(id: string, action: string) {
    const res = await fetch(`/api/cases/${caseId}/contracts/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? 'Fehler');
    void load();
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/cases/${caseId}/contracts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_name: mName, expected_amount_minor: Math.round(Number(mAmount.replace(',', '.')) * 100), interval: mInterval })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
    setShowManual(false); setMName(''); setMAmount('');
    void load();
  }

  function startCancellation() {
    if (selected.size === 0) return;
    sessionStorage.setItem(`selected_contracts_${caseId}`, JSON.stringify([...selected]));
    window.location.href = `/cases/${caseId}/cancellation`;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold">Verträge</h1>
          <p className="text-sm text-neutral-500">Geschätzte monatliche Kosten: <strong>{formatEuro(monthly)}</strong></p>
        </div>
        <button className="btn" onClick={() => setShowManual(!showManual)}>Vertrag manuell anlegen</button>
      </header>

      {error && <p className="border border-black p-3 text-sm">{error}</p>}

      {showManual && (
        <form onSubmit={addManual} className="card grid gap-3 sm:grid-cols-4">
          <input className="input" placeholder="Anbieter" value={mName} onChange={(e) => setMName(e.target.value)} required />
          <input className="input" placeholder="Betrag (EUR)" value={mAmount} onChange={(e) => setMAmount(e.target.value)} required />
          <select className="input" value={mInterval} onChange={(e) => setMInterval(e.target.value)}>
            <option value="monthly">monatlich</option><option value="quarterly">vierteljährlich</option>
            <option value="semiannual">halbjährlich</option><option value="annual">jährlich</option>
          </select>
          <button className="btn btn-primary">Anlegen</button>
        </form>
      )}

      {cancelable.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={[...selected].length === cancelable.length && cancelable.length > 0}
                onChange={(e) => setSelected(e.target.checked ? new Set(cancelable.map((c) => c.id)) : new Set())} />
              Alle kündbaren auswählen ({cancelable.length})
            </label>
            <span className="text-sm text-neutral-500">{selected.size} ausgewählt</span>
          </div>
          <button className="btn btn-primary" disabled={selected.size === 0} onClick={startCancellation}>
            Kündigungen vorbereiten
          </button>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th></th><th>Anbieter</th><th>Abbuchung</th><th>Rhythmus</th><th>Monatlich</th><th>Status</th><th>Offizielle Seite</th><th></th></tr></thead>
          <tbody>
            {contracts.map((c) => {
              const canCancel = ['suggested', 'confirmed'].includes(c.review_status);
              return (
                <tr key={c.id}>
                  <td>{canCancel ? (
                    <input type="checkbox" checked={selected.has(c.id)}
                      onChange={(e) => { const next = new Set(selected); if (e.target.checked) next.add(c.id); else next.delete(c.id); setSelected(next); }} />
                  ) : null}</td>
                  <td>
                    <Link href={`/cases/${caseId}/contracts/${c.id}`} className="font-medium underline decoration-neutral-300 hover:decoration-black">
                      {c.provider_name}
                    </Link>
                    <p className="mt-1 max-w-xs text-xs text-neutral-500">{c.recognition_reason}</p>
                  </td>
                  <td>{formatEuro(Number(c.expected_amount_minor))}</td>
                  <td>{({ monthly: 'monatlich', quarterly: 'vierteljährlich', semiannual: 'halbjährlich', annual: 'jährlich', irregular: 'unregelmäßig', unknown: 'unbekannt' })[c.interval] ?? c.interval}</td>
                  <td>{formatEuro(Math.round(Number(c.expected_amount_minor) / (INTERVALS[c.interval] ?? 1)))}</td>
                  <td>
                    <span className={`inline-block border px-2 py-0.5 text-xs ${c.review_status === 'suggested' ? 'border-black' : 'border-neutral-300 text-neutral-500'}`}>
                      {STATUS[c.review_status] ?? c.review_status}
                    </span>
                  </td>
                  <td>{c.official_url ? <a href={String(c.official_url)} target="_blank" rel="noreferrer" className="text-sm underline">{c.provider_domain ?? 'Link'}</a> : <span className="text-xs text-neutral-400">–</span>}</td>
                  <td>
                    <div className="flex flex-col items-end gap-1 text-xs">
                      {c.review_status === 'suggested' && (<>
                        <button className="underline" onClick={() => act(c.id, 'confirm')}>Bestätigen</button>
                        <button className="underline text-neutral-500" onClick={() => act(c.id, 'reject')}>Ablehnen</button>
                      </>)}
                      {!c.official_url && c.review_status !== 'ended' && (
                        <button className="underline" onClick={() => act(c.id, 'research')}>Seite suchen</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {contracts.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">Noch keine Verträge erkannt. Laden Sie im Reiter „Konten & Dokumente“ Kontoauszüge hoch – die App erkennt wiederkehrende Abbuchungen automatisch.</p>
        )}
      </div>
    </div>
  );
}
