import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryAll, execSql, uuid, nowIso } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'read');
    const db = await getDb();
    const accounts = queryAll(db, `
      SELECT a.*, (SELECT COUNT(*) FROM documents d WHERE d.bank_account_id = a.id) AS document_count
      FROM bank_accounts a WHERE a.case_id = ? ORDER BY a.created_at`, [caseId]);
    return ok({ accounts });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'write');
    const body = (await req.json()) as Record<string, unknown>;
    const label = String(body.label ?? '').trim();
    if (!label) throw apiError('Bitte einen Kontonamen angeben', 400);
    const db = await getDb();
    const id = uuid();
    execSql(db, `INSERT INTO bank_accounts (id, case_id, label, bank_name, iban_masked, currency, created_at)
      VALUES (?,?,?,?,?,?,?)`,
      [id, caseId, label, body.bank_name ? String(body.bank_name) : null,
        body.iban_masked ? String(body.iban_masked) : null, 'EUR', nowIso()]);
    return ok({ id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
