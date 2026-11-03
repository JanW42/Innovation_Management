import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryAll, execSql, uuid } from '@/lib/db';

export const dynamic = 'force-dynamic';



export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'read');
    const db = await getDb();
    const rows = queryAll(db, `
      SELECT c.*, (SELECT COUNT(*) FROM contract_transactions ct WHERE ct.contract_id = c.id) AS tx_count
      FROM contracts c WHERE c.case_id = ? ORDER BY c.recognition_score DESC, c.created_at DESC`, [caseId]);
    return ok({ contracts: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'write');
    const body = (await req.json()) as Record<string, unknown>;
    const providerName = String(body.provider_name ?? '').trim();
    const amount = Number(body.expected_amount_minor);
    if (!providerName || Number.isNaN(amount) || amount <= 0) throw apiError('Anbieter und Betrag sind erforderlich', 400);
    const db = await getDb();
    const id = uuid();
    execSql(db, `INSERT INTO contracts (id, case_id, provider_name, expected_amount_minor, interval, recognition_score,
      recognition_reason, review_status, official_url, created_at)
      VALUES (?,?,?,?,?,?,?,'confirmed',?,?)`,
      [id, caseId, providerName, Math.round(amount), String(body.interval ?? 'monthly'), 1,
        'Manuell erfasst', body.official_url ? String(body.official_url) : null, new Date().toISOString()]);
    return ok({ id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
