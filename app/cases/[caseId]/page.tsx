'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CrossIcon } from '@/components/icons';
import { formatEuro, formatDate } from '@/lib/format';

interface ContractRow { id: string; provider_name: string; expected_amount_minor: number; interval: string; review_status: string; }
interface TaskRow { id: string; title: string; section: string; status: string; }
interface Funeral { company?: string; contact_name?: string; phone?: string; email?: string; }

const INTERVALS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12, irregular: 12, unknown: 1 };

export default function OverviewPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!caseId) return;
    Promise.all([
      fetch(`/api/cases/${caseId}`).then((r) => r.json()),
      fetch(`/api/cases/${caseId}/contracts`).then((r) => r.json()),
      fetch(`/api/cases/${caseId}/tasks`).then((r) => r.json()),
      fetch(`/api/cases/${caseId}/funeral`).then((r) => r.json()),
      fetch(`/api/cases/${caseId}/cancellations`).then((r) => r.json())
    ]).then(([c, contracts, tasks, funeral, cancellations]) => {
      if (c.error) setError(String(c.error));
      setData({ ...c, ...contracts, ...tasks, ...funeral, ...cancellations });
    });
  }, [caseId]);

  if (error) return <p className="border border-black p-4">{error}</p>;
  if (!data) return <p className="text-neutral-500">Lade …</p>;

  const contracts = (data.contracts ?? []) as ContractRow[];
  const tasks = (data.tasks ?? []) as TaskRow[];
  const funeral = (data.contact ?? {}) as Funeral;
  const monthly = contracts
    .filter((c) => !['rejected', 'ended'].includes(c.review_status))
    .reduce((sum, c) => sum + Math.round(Number(c.expected_amount_minor) / (INTERVALS[c.interval] ?? 1)), 0);
  const openTasks = tasks.filter((t) => t.status === 'open').slice(0, 3);
  const sent = ((data.cancellations ?? []) as Array<{ status: string }>).filter((c) => ['sent', 'confirmation_received'].includes(c.status)).length;

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3 border-b border-neutral-200 pb-4">
        <CrossIcon className="h-6 w-6" />
        <div>
          <h1 className="text-xl font-semibold">{String(data.case?.deceased_first_name)} {String(data.case?.deceased_last_name)}</h1>
          <p className="text-sm text-neutral-500">Verstorben am {formatDate(String(data.case?.death_date))}</p>
          <p className="mt-2 max-w-2xl text-sm italic leading-relaxed text-neutral-500">
            Wir kümmern uns um den Papierkram, damit Sie in Ruhe trauern können und sich auf die wichtigen Dinge konzentrieren. Wir lassen Sie nicht allein.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="label">Geschätzte Vertragskosten</p>
          <p className="text-2xl font-semibold">{formatEuro(monthly)} <span className="text-sm font-normal text-neutral-500">/ Monat</span></p>
        </div>
        <div className="card">
          <p className="label">Verträge</p>
          <p className="text-2xl font-semibold">{contracts.length}</p>
          <p className="text-sm text-neutral-500">
            {contracts.filter((c) => c.review_status === 'suggested').length} zu prüfen · {sent} Kündigungen im Gang
          </p>
        </div>
        <div className="card">
          <p className="label">Bestatter</p>
          {funeral.company ? (
            <div className="text-sm">
              <p className="font-medium">{funeral.company}</p>
              <p className="text-neutral-500">{funeral.contact_name ?? ''}</p>
              <p className="text-neutral-500">{funeral.phone ?? ''}</p>
            </div>
          ) : (
            <Link href={`/cases/${caseId}/funeral`} className="text-sm underline">Kontakte erfassen →</Link>
          )}
        </div>
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Nächste Schritte</h2>
          <Link href={`/cases/${caseId}/tasks`} className="text-sm underline">Alle anzeigen</Link>
        </div>
        {openTasks.length === 0 ? (
          <p className="text-sm text-neutral-500">Alle Aufgaben erledigt.</p>
        ) : (
          <ul className="space-y-2">
            {openTasks.map((t) => (
              <li key={t.id} className="text-sm">
                <span className="mr-2 text-neutral-400">[{t.section}]</span>{t.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Schnellzugriff</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`/cases/${caseId}/accounts`} className="btn">Kontoauszug hochladen</Link>
          <Link href={`/cases/${caseId}/contracts`} className="btn">Verträge prüfen</Link>
          <Link href={`/cases/${caseId}/cancellation`} className="btn">Kündigungen verfolgen</Link>
        </div>
      </section>
    </div>
  );
}



