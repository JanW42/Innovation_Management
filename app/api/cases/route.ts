import { requireUser, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryAll, queryOne, execSql, uuid, nowIso } from '@/lib/db';
import { seedChecklist } from '@/lib/checklist';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const db = await getDb();
    const rows = queryAll(db, `
      SELECT k.id, k.deceased_first_name, k.deceased_last_name, k.death_date, cm.role
      FROM cases k JOIN case_members cm ON cm.case_id = k.id AND cm.user_id = ?
      WHERE k.lifecycle_status = 'active' ORDER BY k.created_at DESC`, [String(user.id)]);
    return ok({ cases: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as { deceased_first_name?: string; deceased_last_name?: string; death_date?: string };
    const firstName = String(body.deceased_first_name ?? '').trim();
    const lastName = String(body.deceased_last_name ?? '').trim();
    const deathDate = String(body.death_date ?? '').trim();
    if (!firstName || !lastName || !/^\d{4}-\d{2}-\d{2}$/.test(deathDate)) {
      throw apiError('Bitte Name und Sterbedatum (TT.MM.JJJJ) angeben', 400);
    }
    const db = await getDb();
    const id = uuid();
    const at = nowIso();
    execSql(db, `INSERT INTO cases (id, deceased_first_name, deceased_last_name, death_date, created_by, created_at)
      VALUES (?,?,?,?,?,?)`, [id, firstName, lastName, deathDate, String(user.id), at]);
    execSql(db, 'INSERT INTO case_members (case_id, user_id, role, can_approve) VALUES (?,?,?,1)', [id, String(user.id), 'owner']);
    await seedChecklist(id);
    return ok({ id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
