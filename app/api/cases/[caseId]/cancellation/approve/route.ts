import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryOne, execSql, uuid } from '@/lib/db';
import { enqueue } from '@/lib/jobs';
import { previewCancellation, buildLetterFor } from '@/lib/cancellation';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    const { user, membership } = await requireCase(caseId, 'write');
    const body = (await req.json()) as {
      contract_ids?: string[];
      requester_name?: string;
      requester_address?: string;
      confirmed?: boolean;
    };
    if (!Array.isArray(body.contract_ids) || body.contract_ids.length === 0) throw apiError('Keine Verträge ausgewählt', 400);
    if (!body.confirmed) throw apiError('Bitte die Bestätigung anhaken', 400);
    if (!membership.canApprove) throw apiError('Ihr Konto ist nicht berechtigt, Kündigungen freizugeben', 403);
    const preview = await previewCancellation(caseId, body.contract_ids.map(String));
    const db = await getDb();
    const caseRow = queryOne(db, 'SELECT * FROM cases WHERE id = ?', [caseId])!;
    const requesterName = String(body.requester_name ?? user.display_name);
    const requesterAddress = String(body.requester_address ?? '');
    const created = [];
    for (const item of preview.items) {
      const contract = item.contract;
      const letterText = item.channel === 'email' ? buildLetterFor(contract, caseRow, requesterName, requesterAddress) : null;
      const id = uuid();
      const at = new Date().toISOString();
      execSql(db, `INSERT INTO cancellations (id, case_id, contract_id, status, channel, recipient, letter_text,
        approved_by, approved_at, created_at) VALUES (?,?,?,'approved',?,?,?,?,?,?)`,
        [id, caseId, String(contract.id), item.channel,
          item.channel === 'email' ? String(contract.provider_name) : null, letterText,
          String(user.id), at, at]);
      execSql(db, `INSERT INTO cancellation_events (id, cancellation_id, event, at) VALUES (?,?,?,?)`, [uuid(), id, 'approved', at]);
      if (item.channel === 'portal') {
        execSql(db, `INSERT INTO tasks (id, case_id, section, title, description, source) VALUES (?,?,?,?,?,?)`,
          [uuid(), caseId, 'Verträge', `Kündigung im Portal: ${String(contract.provider_name)}`, item.note,
            String(contract.official_url ?? 'https://')]);
      } else {
        await enqueue('cancellation.send', caseId, { cancellationId: id });
      }
      created.push({ cancellationId: id, provider: String(contract.provider_name), channel: item.channel });
    }
    execSql(db, `INSERT INTO audit_events (id, case_id, actor_id, action, entity_type, entity_id, at)
      VALUES (?,?,?,?,?,?,?)`, [uuid(), caseId, String(user.id), 'cancellation.approve', 'batch',
      created.map((c) => c.cancellationId).join(','), new Date().toISOString()]);
    return ok({ created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}