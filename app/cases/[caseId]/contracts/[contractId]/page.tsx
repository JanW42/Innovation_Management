'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatEuro, formatDate } from '@/lib/format';

interface Tx { id: string; booking_date: string; amount_minor: number; purpose: string | null; account_label: string; }
interface Contract {
  id: string; provider_name: string; provider_domain: string | null; official_url: string | null;
  url_retrieved_at: string | null; expected_amount_minor: number; interval: string;
  recognition_score: number; recognition_reason: string | null; review_status: string;
}

export default function ContractDetailPage() {
  const { caseId, contractId } = useParams<{ caseId: string; contractId: string }>();
  const [data, setData] = useState<{ contract: Contract; transactions: Tx[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/cases/${caseId}/contracts/${contractId}`, { cache: 'no-store' }).then((r) => r.json()).then((d) => {
      if (d.error) setError(d.error); else setData(d);
    });
  }, [caseId, contractId]);

  function selectForCancellation() {
    if (!data) return;
    sessionStorage.setItem(`selected_contracts_${caseId}`, JSON.stringify([data.contract.id]));
    window.location.href = `/cases/${caseId}/cancellation`;
  }

  if (error) return <p className="border border-black p-4">{error}</p>;
  if (!data) return <p className="text-neutral-500">Lade …</p>;
  const c = data.contract;

  return (
    <div className="space-y-6">
      <header className="border-b border-neutral-200 pb-4">
        <Link href={`/cases/${caseId}/contracts`} className="text-sm text-neutral-500 underline">← Alle Verträge</Link>
        <h1 className="mt-2 text-xl font-semibold">{c.provider_name}</h1>
        <p className="text-sm text-neutral-500">
          {formatEuro(Number(c.expected_amount_minor))} · {({ monthly: 'monatlich', quarterly: 'vierteljährlich', semiannual: 'halbjährlich', annual: 'jährlich', irregular: 'unregelmäßig', unknown: 'unbekannt' })[c.interval]}
          {' · Status: '}{{ suggested: 'Erkannt', confirmed: 'Geprüft', rejected: 'Abgelehnt', ended: 'Beendet' }[c.review_status]}
        </p>
      </header>

      <div className="card">
        <p className="label">Erkennung</p>
        <p className="text-sm">{c.recognition_reason ?? '–'}</p>
        <p className="mt-1 text-xs text-neutral-400">Sicherheit: {Math.round(c.recognition_score * 100)} %</p>
        {c.official_url && (
          <p className="mt-2 text-sm">
            Offizielle Seite: <a href={String(c.official_url)} target="_blank" rel="noreferrer" className="underline">{String(c.official_url)}</a>
            {c.url_retrieved_at && <span className="text-xs text-neutral-400"> (abgerufen am {formatDate(String(c.url_retrieved_at))})</span>}
            <span className="text-xs text-neutral-400"> – vor Verwendung prüfen</span>
          </p>
        )}
      </div>

      {['suggested', 'confirmed'].includes(c.review_status) && (
        <button className="btn btn-primary" onClick={selectForCancellation}>Diesen Vertrag kündigen</button>
      )}

      <section className="card overflow-x-auto p-0">
        <h2 className="border-b border-neutral-200 p-4 font-semibold">Zugehörige Buchungen</h2>
        <table className="table">
          <thead><tr><th>Datum</th><th>Konto</th><th>Zweck</th><th>Betrag</th></tr></thead>
          <tbody>
            {data.transactions.map((t) => (
              <tr key={t.id}>
                <td>{formatDate(t.booking_date)}</td>
                <td>{t.account_label}</td>
                <td>{t.purpose ?? '–'}</td>
                <td>{formatEuro(Number(t.amount_minor))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
