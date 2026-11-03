import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryOne, execSql, uuid } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    const { user } = await requireCase(caseId, 'read');
    const db = await getDb();
    const caseRow = queryOne(db, 'SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!caseRow) throw apiError('Fall nicht gefunden', 404);
    return ok({ case: { ...caseRow, is_owner: String(user.id) === String(caseRow.created_by) } });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'write');
    const body = (await req.json()) as Record<string, unknown>;
    const db = await getDb();
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const key of ['deceased_first_name', 'deceased_last_name', 'death_date']) {
      if (body[key] !== undefined) { fields.push(`${key} = ?`); values.push(String(body[key] ?? '')); }
    }
    if (fields.length > 0) {
      values.push(caseId);
      execSql(db, `UPDATE cases SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
