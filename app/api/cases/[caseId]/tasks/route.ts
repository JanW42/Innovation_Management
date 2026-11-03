import { requireCase, ok, handleApiError } from '@/lib/api';
import { getDb, queryAll } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'read');
    const db = await getDb();
    const rows = queryAll(db, 'SELECT * FROM tasks WHERE case_id = ? ORDER BY section, title', [caseId]);
    return ok({ tasks: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
