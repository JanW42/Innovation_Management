import { cookies } from 'next/headers';
import { getDb, queryOne, execSql } from '@/lib/db';
import { registerUser, login, sha256, sessionCookieName } from '@/lib/auth';
import { ok, handleApiError, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; email?: string; password?: string; display_name?: string };
    const token = String(body.token ?? '');
    const db = await getDb();
    const invite = queryOne(db, 'SELECT * FROM invitations WHERE token_hash = ? AND accepted_at IS NULL', [sha256(token)]);
    if (!invite) throw apiError('Einladung ungültig oder bereits verwendet', 400);
    if (new Date(String(invite.expires_at)).getTime() < Date.now()) throw apiError('Einladung ist abgelaufen', 400);
    const email = String(body.email ?? '').trim().toLowerCase();
    if (email !== String(invite.email)) throw apiError('Die E-Mail-Adresse passt nicht zur Einladung', 400);
    let user;
    const existing = queryOne(db, 'SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      user = await login(email, String(body.password ?? ''));
    } else {
      user = await registerUser(email, String(body.password ?? ''), String(body.display_name ?? email));
    }
    execSql(db, 'INSERT OR IGNORE INTO case_members (case_id, user_id, role, can_approve) VALUES (?,?,?,0)',
      [String(invite.case_id), String(user.id), String(invite.role)]);
    execSql(db, 'UPDATE invitations SET accepted_at = ? WHERE id = ?', [new Date().toISOString(), String(invite.id)]);
    const tok = await login(email, String(body.password ?? ''));
    const store = await cookies();
    store.set(sessionCookieName(), String(tok.token), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 86400 });
    return ok({ caseId: String(invite.case_id), user: { id: user.id, email } });
  } catch (err) {
    return handleApiError(err);
  }
}
