import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryOne, execSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ caseId: string; taskId: string }> }) {
  try {
    const { caseId, taskId } = await ctx.params;
    await requireCase(caseId, 'write');
    const body = (await req.json()) as { status?: string };
    const db = await getDb();
    const row = queryOne(db, 'SELECT id FROM tasks WHERE id = ? AND case_id = ?', [taskId, caseId]);
    if (!row) throw apiError('Aufgabe nicht gefunden', 404);
    const status = String(body.status ?? 'open');
    if (!['open', 'done'].includes(status)) throw apiError('Unbekannter Status', 400);
    execSql(db, `UPDATE tasks SET status = ?, done_at = ? WHERE id = ?`,
      [status, status === 'done' ? new Date().toISOString() : null, taskId]);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
