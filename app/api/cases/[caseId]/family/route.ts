import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryAll, queryOne, execSql, uuid } from '@/lib/db';
import { sha256 } from '@/lib/auth';
import type { Row } from '@/lib/db';
import type { Membership } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    const { user } = await requireCase(caseId, 'read');
    const db = await getDb();
    const members = queryAll(db, `SELECT cm.role, cm.can_approve, u.id, u.email, u.display_name
      FROM case_members cm JOIN users u ON u.id = cm.user_id WHERE cm.case_id = ? ORDER BY cm.role`, [caseId]);
    const invites = queryAll(db, `SELECT id, email, role, expires_at FROM invitations
      WHERE case_id = ? AND accepted_at IS NULL ORDER BY expires_at DESC`, [caseId]);
    return ok({
      members: members.map((m) => ({ ...m, is_self: String(m.id) === String(user.id) })),
      invitations: invites
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    const { user, membership } = await requireCase(caseId, 'write');
    if (membership.role !== 'owner') throw apiError('Nur die verantwortliche Person kann einladen', 403);
    const body = (await req.json()) as { email?: string; role?: string };
    const email = String(body.email ?? '').trim().toLowerCase();
    const role = String(body.role ?? 'editor');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw apiError('Ungültige E-Mail-Adresse', 400);
    if (!['owner', 'editor', 'viewer'].includes(role)) throw apiError('Unbekannte Rolle', 400);
    const db = await getDb();
    const token = uuid() + uuid().replaceAll('-', '');
    execSql(db, `INSERT INTO invitations (id, case_id, email, role, token_hash, expires_at, invited_by)
      VALUES (?,?,?,?,?,?,?)`,
      [uuid(), caseId, email, role, sha256(token), new Date(Date.now() + 7 * 86400_000).toISOString(), String(user.id)]);
    return ok({ ok: true, token, email }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
