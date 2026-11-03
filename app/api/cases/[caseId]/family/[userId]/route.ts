import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryOne, execSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ caseId: string; userId: string }> }) {
  try {
    const { caseId, userId } = await ctx.params;
    const { user, membership } = await requireCase(caseId, 'write');
    if (membership.role !== 'owner') throw apiError('Nur die verantwortliche Person kann Rollen ändern', 403);
    if (String(user.id) === userId) throw apiError('Die eigene Rolle kann nicht geändert werden', 400);
    const body = (await req.json()) as { role?: string; can_approve?: boolean };
    const db = await getDb();
    const row = queryOne(db, 'SELECT * FROM case_members WHERE case_id = ? AND user_id = ?', [caseId, userId]);
    if (!row) throw apiError('Mitglied nicht gefunden', 404);
    execSql(db, `UPDATE case_members SET role = ?, can_approve = ? WHERE case_id = ? AND user_id = ?`,
      [String(body.role ?? row.role), body.can_approve ? 1 : Number(row.can_approve), caseId, userId]);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ caseId: string; userId: string }> }) {
  try {
    const { caseId, userId } = await ctx.params;
    const { user, membership } = await requireCase(caseId, 'write');
    if (membership.role !== 'owner') throw apiError('Nur die verantwortliche Person kann Mitglieder entfernen', 403);
    if (String(user.id) === userId) throw apiError('Sie können sich nicht selbst entfernen', 400);
    const db = await getDb();
    execSql(db, 'DELETE FROM case_members WHERE case_id = ? AND user_id = ?', [caseId, userId]);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
