'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function FuneralPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [form, setForm] = useState({ company: '', contact_name: '', phone: '', email: '', address: '', notes: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/funeral`, { cache: 'no-store' }).then((r) => r.json()).then((d) => {
      if (d.contact) {
        setForm({
          company: d.contact.company ?? '', contact_name: d.contact.contact_name ?? '', phone: d.contact.phone ?? '',
          email: d.contact.email ?? '', address: d.contact.address ?? '', notes: d.contact.notes ?? ''
        });
      }
    });
  }, [caseId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/cases/${caseId}/funeral`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-neutral-200 pb-4">
        <h1 className="text-xl font-semibold">Betreuender Bestatter</h1>
        <p className="text-sm text-neutral-500">Kontaktdaten für den Fall griffbereit ablegen.</p>
      </header>
      <form onSubmit={save} className="card grid max-w-2xl gap-4 sm:grid-cols-2">
        <div><label className="label">Unternehmen</label><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
        <div><label className="label">Ansprechpartner</label><input className="input" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
        <div><label className="label">Telefon</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="label">E-Mail</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">Adresse</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">Notizen / Termine</label><textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="sm:col-span-2">
          <button className="btn btn-primary">Speichern</button>
          {saved && <span className="ml-3 text-sm">Gespeichert.</span>}
        </div>
      </form>
    </div>
  );
}
