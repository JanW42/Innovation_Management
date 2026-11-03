import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryAll, queryOne, execSql, uuid } from '@/lib/db';
import { enqueue } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string; contractId: string }> }) {
  try {
    const { caseId, contractId } = await ctx.params;
    await requireCase(caseId, 'read');
    const db = await getDb();
    const contract = queryOne(db, 'SELECT * FROM contracts WHERE id = ? AND case_id = ?', [contractId, caseId]);
    if (!contract) throw apiError('Vertrag nicht gefunden', 404);
    const txs = queryAll(db, `SELECT t.*, a.label AS account_label FROM contract_transactions ct
      JOIN transactions t ON t.id = ct.transaction_id JOIN bank_accounts a ON a.id = t.bank_account_id
      WHERE ct.contract_id = ? ORDER BY t.booking_date DESC`, [contractId]);
    const cancellations = queryAll(db, 'SELECT * FROM cancellations WHERE contract_id = ? ORDER BY created_at DESC', [contractId]);
    return ok({ contract, transactions: txs, cancellations });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string; contractId: string }> }) {
  try {
    const { caseId, contractId } = await ctx.params;
    const { user } = await requireCase(caseId, 'write');
    const body = (await req.json()) as { action?: string };
    const db = await getDb();
    const contract = queryOne(db, 'SELECT * FROM contracts WHERE id = ? AND case_id = ?', [contractId, caseId]);
    if (!contract) throw apiError('Vertrag nicht gefunden', 404);
    const action = String(body.action ?? '');
    if (action === 'confirm') {
      execSql(db, `UPDATE contracts SET review_status = 'confirmed' WHERE id = ?`, [contractId]);
    } else if (action === 'reject') {
      execSql(db, `UPDATE contracts SET review_status = 'rejected' WHERE id = ?`, [contractId]);
    } else if (action === 'research') {
      await enqueue('research.run', caseId, { contractId });
    } else {
      throw apiError('Unbekannte Aktion', 400);
    }
    execSql(db, `INSERT INTO audit_events (id, case_id, actor_id, action, entity_type, entity_id, at)
      VALUES (?,?,?,?,?,?,?)`, [uuid(), caseId, String(user.id), `contract.${action}`, 'contract', contractId, new Date().toISOString()]);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ caseId: string; contractId: string }> }) {
  try {
    const { caseId, contractId } = await ctx.params;
    await requireCase(caseId, 'write');
    const body = (await req.json()) as Record<string, unknown>;
    const db = await getDb();
    const contract = queryOne(db, 'SELECT id FROM contracts WHERE id = ? AND case_id = ?', [contractId, caseId]);
    if (!contract) throw apiError('Vertrag nicht gefunden', 404);
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const key of ['provider_name', 'provider_domain', 'official_url', 'category', 'interval', 'recognition_reason']) {
      if (body[key] !== undefined) { fields.push(`${key} = ?`); values.push(String(body[key] ?? '')); }
    }
    if (body.expected_amount_minor !== undefined) { fields.push('expected_amount_minor = ?'); values.push(Number(body.expected_amount_minor)); }
    if (fields.length > 0) {
      values.push(contractId);
      execSql(db, `UPDATE contracts SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
