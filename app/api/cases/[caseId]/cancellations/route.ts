import { requireCase, ok, handleApiError } from '@/lib/api';
import { getDb, queryAll } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'read');
    const db = await getDb();
    const rows = queryAll(db, `SELECT c.*, ct.provider_name, ct.expected_amount_minor, ct.interval
      FROM cancellations c JOIN contracts ct ON ct.id = c.contract_id
      WHERE c.case_id = ? ORDER BY c.created_at DESC`, [caseId]);
    const events = queryAll(db, `SELECT e.cancellation_id, e.event, e.at FROM cancellation_events e
      WHERE e.cancellation_id IN (SELECT id FROM cancellations WHERE case_id = ?) ORDER BY e.at`, [caseId]);
    return ok({ cancellations: rows, events });
  } catch (err) {
    return handleApiError(err);
  }
}
