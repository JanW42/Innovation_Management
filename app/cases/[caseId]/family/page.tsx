'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Member { id: string; email: string; display_name: string; role: string; can_approve: number; is_self: boolean; }
interface Invite { id: string; email: string; role: string; }

export default function FamilyPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [newToken, setNewToken] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!caseId) return;
    const data = await fetch(`/api/cases/${caseId}/family`, { cache: 'no-store' }).then((r) => r.json());
    setMembers(data.members ?? []);
    setInvites(data.invitations ?? []);
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/cases/${caseId}/family`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Fehler'); return; }
    setNewToken(data.token ?? '');
    setInviteEmail('');
    void load();
  }

  async function setRole(id: string, role: string, canApprove: boolean) {
    await fetch(`/api/cases/${caseId}/family/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, can_approve: canApprove })
    });
    void load();
  }

  async function remove(id: string) {
    await fetch(`/api/cases/${caseId}/family/${id}`, { method: 'DELETE' });
    void load();
  }

  const ROLE_TEXT: Record<string, string> = { owner: 'Verantwortlich', editor: 'Bearbeitet', viewer: 'Nur ansehen' };

  return (
    <div className="space-y-6">
      <header className="border-b border-neutral-200 pb-4">
        <h1 className="text-xl font-semibold">Familie</h1>
        <p className="text-sm text-neutral-500">Familienmitglieder einladen und Zugriffsrechte vergeben.</p>
      </header>

      {error && <p className="border border-black p-3 text-sm">{error}</p>}

      <section className="card">
        <h2 className="mb-3 font-semibold">Einladen</h2>
        <form onSubmit={invite} className="grid gap-3 sm:grid-cols-3">
          <input className="input" type="email" placeholder="E-Mail" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
          <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            <option value="editor">Bearbeitet</option>
            <option value="viewer">Nur ansehen</option>
          </select>
          <button className="btn btn-primary">Einladung erstellen</button>
        </form>
        {newToken && (
          <div className="mt-4 border border-black p-3 text-sm">
            <p>Code für {''}Übermittlung an das Familienmitglied (im MVP wird keine E-Mail versandt):</p>
            <p className="mt-1 break-all font-mono text-xs">{newToken}</p>
          </div>
        )}
        {invites.length > 0 && (
          <ul className="mt-3 text-sm text-neutral-500">
            {invites.map((i) => <li key={i.id}>Offene Einladung: {i.email} ({ROLE_TEXT[i.role] ?? i.role})</li>)}
          </ul>
        )}
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Kündigungsfreigabe</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.display_name}{m.is_self ? ' (Sie)' : ''}</td>
                <td>{m.email}</td>
                <td>
                  {m.is_self ? ROLE_TEXT[m.role] : (
                    <select className="input w-40 px-2 py-1 text-sm" value={m.role} onChange={(e) => setRole(m.id, e.target.value, Boolean(m.can_approve))}>
                      <option value="owner">Verantwortlich</option><option value="editor">Bearbeitet</option><option value="viewer">Nur ansehen</option>
                    </select>
                  )}
                </td>
                <td>
                  {!m.is_self && (
                    <input type="checkbox" checked={Boolean(m.can_approve)} onChange={(e) => setRole(m.id, m.role, e.target.checked)} />
                  )}
                </td>
                <td>{!m.is_self && <button className="text-xs underline text-neutral-500" onClick={() => remove(m.id)}>Entfernen</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
