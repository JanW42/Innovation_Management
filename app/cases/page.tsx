'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrossIcon, VineIcon } from '@/components/icons';
import { formatDate } from '@/lib/format';

interface CaseItem {
  id: string;
  deceased_first_name: string;
  deceased_last_name: string;
  death_date: string;
  role: string;
}

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseItem[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const res = await fetch('/api/cases');
    if (res.status === 401) { router.push('/login'); return; }
    const data = await res.json();
    setCases(data.cases ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/cases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deceased_first_name: firstName, deceased_last_name: lastName, death_date: deathDate })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
    router.push(`/cases/${data.id}`);
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header className="mb-8 flex items-end justify-between border-b border-neutral-200 pb-4">
        <div className="flex items-center gap-3">
          <CrossIcon className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-semibold">Fälle</h1>
            <p className="text-sm text-neutral-500">Personen, die Sie begleiten</p>
          </div>
        </div>
        <button className="btn" onClick={() => setShowCreate(!showCreate)}>Neuer Fall</button>
      </header>

      {showCreate && (
        <form onSubmit={createCase} className="card mb-6 grid gap-4 sm:grid-cols-3">
          <div><label className="label">Vorname</label><input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
          <div><label className="label">Nachname</label><input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
          <div><label className="label">Sterbedatum</label><input className="input" type="date" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} required /></div>
          {error && <p className="border border-black px-3 py-2 text-sm sm:col-span-3">{error}</p>}
          <div className="sm:col-span-3"><button className="btn btn-primary">Fall anlegen</button></div>
        </form>
      )}

      {cases === null ? (
        <p className="text-neutral-500">Lade …</p>
      ) : cases.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center text-neutral-500">
          <VineIcon className="h-5 w-32 text-neutral-300" />
          <p>Noch keine Fälle. Legen Sie den ersten Fall an, um zu beginnen.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <button onClick={() => router.push(`/cases/${c.id}`)} className="card flex w-full items-center justify-between text-left hover:border-black">
                <div>
                  <p className="font-medium">{c.deceased_first_name} {c.deceased_last_name}</p>
                  <p className="text-sm text-neutral-500">Verstorben am {formatDate(c.death_date)} · Rolle: {c.role}</p>
                </div>
                <span aria-hidden>→</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
