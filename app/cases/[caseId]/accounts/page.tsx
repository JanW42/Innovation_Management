'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatEuro, formatDate, formatDateTime } from '@/lib/format';

interface Account {
  id: string; label: string; bank_name: string | null; iban_masked: string | null;
  balance_minor: number | null; balance_as_of: string | null; document_count: number;
}
interface Doc {
  id: string; kind: string; mime_type: string; processing_status: string; review_status: string;
  error: string | null; created_at: string; account_label: string | null; account_id: string | null;
  extracted_json: string | null;
}

const STATUS_TEXT: Record<string, string> = {
  queued: 'Wird vorbereitet', processing: 'Wird ausgewertet', ready_for_review: 'Prüfung erforderlich',
  completed: 'Fertig', failed: 'Fehler'
};

export default function AccountsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newBank, setNewBank] = useState('');
  const [newIban, setNewIban] = useState('');
  const [balance, setBalance] = useState<Record<string, string>>({});
  const [balanceDate, setBalanceDate] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<'bank_statement' | 'death_certificate'>('bank_statement');
  const [targetAccount, setTargetAccount] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!caseId) return;
    const a = await fetch(`/api/cases/${caseId}/accounts`).then((r) => r.json());
    setAccounts(a.accounts ?? []);
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!caseId) return;
    const timer = setInterval(() => {
      fetch(`/api/cases/${caseId}/documents`, { method: 'GET', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => {
        if (d?.documents) { setDocs(d.documents); if (selectedDoc) setSelectedDoc((prev) => (prev && (d.documents as Doc[]).find((x) => x.id === prev.id)) ?? null); }
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [caseId]);

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/cases/${caseId}/accounts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel, bank_name: newBank, iban_masked: newIban })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
    setNewLabel(''); setNewBank(''); setNewIban('');
    void load();
  }

  async function saveBalance(id: string) {
    const raw = (balance[id] ?? '').replace(',', '.');
    const minor = raw ? Math.round(Number(raw) * 100) : null;
    await fetch(`/api/cases/${caseId}/accounts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance_minor: minor, balance_as_of: balanceDate[id] || null })
    });
    void load();
  }

  async function upload(file: File) {
    if (!caseId) return;
    if (kind === 'bank_statement' && !targetAccount) { setError('Bitte Konto auswählen'); return; }
    setUploading(true); setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (targetAccount) form.append('bank_account_id', targetAccount);
    const res = await fetch(`/api/cases/${caseId}/documents`, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Upload fehlgeschlagen'); setUploading(false); return; }
    if (fileRef.current) fileRef.current.value = '';
    setUploading(false);
    void load();
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-neutral-200 pb-4">
        <h1 className="text-xl font-semibold">Konten & Dokumente</h1>
        <p className="text-sm text-neutral-500">Konten anlegen, Kontostand erfassen und Auszüge hochladen.</p>
      </header>

      {error && <p className="border border-black p-3 text-sm">{error}</p>}

      <section className="card">
        <h2 className="mb-3 font-semibold">Neues Konto</h2>
        <form onSubmit={createAccount} className="grid gap-3 sm:grid-cols-4">
          <input className="input" placeholder="z. B. Girokonto" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} required />
          <input className="input" placeholder="Bank" value={newBank} onChange={(e) => setNewBank(e.target.value)} />
          <input className="input" placeholder="IBAN (z. B. DE12 … 7890)" value={newIban} onChange={(e) => setNewIban(e.target.value)} />
          <button className="btn btn-primary">Konto anlegen</button>
        </form>
      </section>

      {accounts.length === 0 ? (
        <div className="card py-10 text-center text-sm text-neutral-500">
          Noch keine Konte. Laden Sie danach die Kontoauszüge (PDF, JPG, PNG oder CSV) hoch – mindestens zwei bis drei Monate, damit wiederkehrende Abbuchungen erkannt werden.
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((a) => (
            <div key={a.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{a.label}</p>
                  <p className="text-sm text-neutral-500">{[a.bank_name, a.iban_masked].filter(Boolean).join(' ') || 'Keine Bankdaten angegeben'}</p>
                  <p className="mt-1 text-sm">
                    {a.balance_minor != null
                      ? <>Kontostand: <strong>{formatEuro(a.balance_minor)}</strong> <span className="text-neutral-500">(zum {formatDate(a.balance_as_of)})</span></>
                      : <span className="text-neutral-500">Kontostand nicht erfasst</span>}
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="label">Stand (EUR)</label>
                    <input className="input w-32" value={balance[a.id] ?? ''} onChange={(e) => setBalance({ ...balance, [a.id]: e.target.value })} placeholder="0,00" />
                  </div>
                  <div>
                    <label className="label">Stichtag</label>
                    <input className="input w-40" type="date" value={balanceDate[a.id] ?? ''} onChange={(e) => setBalanceDate({ ...balanceDate, [a.id]: e.target.value })} />
                  </div>
                  <button className="btn" onClick={() => saveBalance(a.id)}>Speichern</button>
                </div>
              </div>
              <div className="mt-4 border-t border-neutral-100 pt-3">
                <p className="mb-2 text-sm text-neutral-500">{a.document_count} Dokument(e)</p>
                <ul className="space-y-1">
                  {docs.filter((d) => d.account_id === a.id).map((d) => (
                    <li key={d.id}>
                      <button className="flex w-full items-center justify-between px-2 py-1 text-sm hover:bg-neutral-50" onClick={() => setSelectedDoc(d)}>
                        <span>{d.mime_type} {formatDateTime(d.created_at)}</span>
                        <span>{STATUS_TEXT[d.processing_status] ?? d.processing_status}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">Dokument hochladen</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Art</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as never)}>
              <option value="bank_statement">Kontoauszug</option>
              <option value="death_certificate">Sterbeurkunde</option>
            </select>
          </div>
          {kind === 'bank_statement' && (
            <div>
              <label className="label">Konto</label>
              <select className="input" value={targetAccount} onChange={(e) => setTargetAccount(e.target.value)}>
                <option value="">Bitte wählen</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Datei</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.csv"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
        </div>
        {uploading && <p className="mt-2 text-sm text-neutral-500">Wird hochgeladen …</p>}
        <p className="mt-2 text-xs text-neutral-400">PDF, JPG, PNG oder CSV. CSV-Format: Buchungstag;Wertstag;Empfänger;Verwendungszweck;Betrag (z. B. 01.05.2026;01.05.2026;DAK;Beitrag;-12,34).</p>
      </section>

      {selectedDoc && <DocDetail doc={selectedDoc} onClose={() => setSelectedDoc(null)} />}
    </div>
  );
}

function DocDetail({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const extraction = doc.extracted_json ? (JSON.parse(doc.extracted_json) as Record<string, any>) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="card max-h-[80vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Dokument</h3>
          <button className="btn" onClick={onClose}>Schließen</button>
        </div>
        <p className="text-sm text-neutral-500">Status: {doc.processing_status}{doc.error ? ` – ${doc.error}` : ''}</p>
        {extraction && (
          <div className="mt-3 space-y-1 text-sm">
            {extraction.source && <p>Quelle: {String(extraction.source)}</p>}
            {extraction.transactions_inserted != null && (
              <p>Importierte Buchungen: {String(extraction.transactions_inserted)} von {String(extraction.transactions_total)}</p>
            )}
            {extraction.note && <p className="border border-neutral-200 p-2 text-neutral-600">{String(extraction.note)}</p>}
            {extraction.first_name && <p>Name: {String(extraction.first_name)} {String(extraction.last_name ?? '')}</p>}
            {extraction.death_date && <p>Sterbedatum: {String(extraction.death_date)}</p>}
            {extraction.death_place && <p>Sterte: {String(extraction.death_place)}</p>}
            {extraction.birth_date && <p>Geburtsdatum: {String(extraction.birth_date)}</p>}
            <p className="text-xs text-neutral-400">Bitte prüfen Sie die erkannten Daten. Sie werden für die Kündigungen verwendet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

