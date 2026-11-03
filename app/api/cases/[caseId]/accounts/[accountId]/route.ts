import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryOne, execSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ caseId: string; accountId: string }> }) {
  try {
    const { caseId, accountId } = await ctx.params;
    await requireCase(caseId, 'write');
    const body = (await req.json()) as Record<string, unknown>;
    const db = await getDb();
    const account = queryOne(db, 'SELECT * FROM bank_accounts WHERE id = ? AND case_id = ?', [accountId, caseId]);
    if (!account) throw apiError('Konto nicht gefunden', 404);
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const key of ['label', 'bank_name', 'iban_masked']) {
      if (body[key] !== undefined) { fields.push(`${key} = ?`); values.push(String(body[key] ?? '')); }
    }
    if (body.balance_minor !== undefined) {
      fields.push('balance_minor = ?, balance_as_of = ?');
      values.push(body.balance_minor === null ? null : Number(body.balance_minor),
        body.balance_as_of ? String(body.balance_as_of) : null);
    }
    if (fields.length > 0) {
      values.push(accountId);
      execSql(db, `UPDATE bank_accounts SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
