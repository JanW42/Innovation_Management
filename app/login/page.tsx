'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrossIcon, VineIcon } from '@/components/icons';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register' | 'invite'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let res: Response;
      if (mode === 'invite') {
        res = await fetch('/api/invitations/accept', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email, password, display_name: displayName })
        });
      } else if (mode === 'register') {
        await fetch('/api/auth/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, display_name: displayName })
        });
        res = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
      } else {
        res = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler');
      if (mode === 'invite' && data.caseId) router.push(`/cases/${data.caseId}`);
      else router.push('/cases');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-neutral-800">
          <CrossIcon className="h-8 w-8" />
          <h1 className="text-2xl font-semibold tracking-tight">Stillstand</h1>
          <p className="text-sm text-neutral-500">Ruhige Begleitung bei Verträgen und Nachlass</p>
          <VineIcon className="h-4 w-28 text-neutral-400" />
        </div>
        <form onSubmit={submit} className="card space-y-4">
          <div className="flex border border-neutral-200 text-sm">
            {([['login', 'Anmelden'], ['register', 'Neues Konto'], ['invite', 'Einladung']] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => { setMode(key); setError(''); }}
                className={`flex-1 py-2 ${mode === key ? 'bg-black text-white' : 'hover:bg-neutral-50'}`}>
                {label}
              </button>
            ))}
          </div>
          <div>
            <label className="label">E-Mail</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {(mode === 'register' || mode === 'invite') && (
            <div>
              <label className="label">Name</label>
              <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">Passwort</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'login' ? 0 : 8} />
          </div>
          {mode === 'invite' && (
            <div>
              <label className="label">Einladungs-Code</label>
              <input className="input font-mono text-xs" value={token} onChange={(e) => setToken(e.target.value)} required />
              <p className="mt-1 text-xs text-neutral-500">Den Code erhalten Sie von der Person, die Sie eingeladen hat.</p>
            </div>
          )}
          {error && <p className="border border-black px-3 py-2 text-sm">{error}</p>}
          <button className="btn btn-primary w-full justify-center" disabled={busy}>
            {busy ? 'Wird verarbeitet …' : mode === 'invite' ? 'Einladung annehmen' : mode === 'register' ? 'Konto anlegen' : 'Anmelden'}
          </button>
        </form>
      </div>
    </main>
  );
}
