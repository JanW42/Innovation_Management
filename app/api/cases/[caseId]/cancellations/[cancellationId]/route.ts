import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryOne, execSql, uuid } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string; cancellationId: string }> }) {
  try {
    const { caseId, cancellationId } = await ctx.params;
    const { user } = await requireCase(caseId, 'write');
    const body = (await req.json()) as { note?: string };
    const db = await getDb();
    const row = queryOne(db, 'SELECT * FROM cancellations WHERE id = ? AND case_id = ?', [cancellationId, caseId]);
    if (!row) throw apiError('Kündigung nicht gefunden', 404);
    const at = new Date().toISOString();
    execSql(db, `UPDATE cancellations SET status = 'confirmation_received', confirmation_note = ? WHERE id = ?`,
      [body.note ? String(body.note) : null, cancellationId]);
    execSql(db, `UPDATE contracts SET review_status = 'ended' WHERE id = ?`, [String(row.contract_id)]);
    execSql(db, `INSERT INTO cancellation_events (id, cancellation_id, event, at) VALUES (?,?,?,?)`,
      [uuid(), cancellationId, 'confirmation_received', at]);
    execSql(db, `INSERT INTO audit_events (id, case_id, actor_id, action, entity_type, entity_id, at)
      VALUES (?,?,?,?,?,?,?)`, [uuid(), caseId, String(user.id), 'cancellation.confirm', 'cancellation', cancellationId, at]);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
