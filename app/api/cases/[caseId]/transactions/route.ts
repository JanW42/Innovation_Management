import { requireCase, ok, handleApiError } from '@/lib/api';
import { getDb, queryAll } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'read');
    const db = await getDb();
    const rows = queryAll(db, `SELECT t.*, a.label AS account_label FROM transactions t
      JOIN bank_accounts a ON a.id = t.bank_account_id WHERE t.case_id = ? ORDER BY t.booking_date DESC LIMIT 500`, [caseId]);
    return ok({ transactions: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
