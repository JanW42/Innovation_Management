import { requireCase, ok, handleApiError } from '@/lib/api';
import { getDb, queryOne, queryAll, execSql, uuid } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'read');
    const db = await getDb();
    const row = queryOne(db, 'SELECT * FROM funeral_contacts WHERE case_id = ?', [caseId]);
    return ok({ contact: row });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'write');
    const body = (await req.json()) as Record<string, unknown>;
    const db = await getDb();
    const existing = queryOne(db, 'SELECT id FROM funeral_contacts WHERE case_id = ?', [caseId]);
    const values = [
      body.company ? String(body.company) : null,
      body.contact_name ? String(body.contact_name) : null,
      body.phone ? String(body.phone) : null,
      body.email ? String(body.email) : null,
      body.address ? String(body.address) : null,
      body.notes ? String(body.notes) : null
    ];
    if (existing) {
      execSql(db, `UPDATE funeral_contacts SET company=?, contact_name=?, phone=?, email=?, address=?, notes=? WHERE case_id=?`,
        [...values, caseId]);
    } else {
      execSql(db, `INSERT INTO funeral_contacts (id, case_id, company, contact_name, phone, email, address, notes)
        VALUES (?,?,?,?,?,?,?,?)`, [uuid(), caseId, ...values]);
    }
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
