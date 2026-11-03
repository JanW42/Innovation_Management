import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string; documentId: string }> }) {
  try {
    const { caseId, documentId } = await ctx.params;
    await requireCase(caseId, 'read');
    const db = await getDb();
    const doc = queryOne(db, `SELECT d.id, d.kind, d.mime_type, d.size_bytes, d.processing_status, d.review_status,
      d.error, d.created_at, a.label AS account_label, a.id AS account_id, e.extracted_json
      FROM documents d LEFT JOIN bank_accounts a ON a.id = d.bank_account_id
      LEFT JOIN extractions e ON e.document_id = d.id WHERE d.id = ? AND d.case_id = ?`, [documentId, caseId]);
    if (!doc) throw apiError('Dokument nicht gefunden', 404);
    return ok({ document: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
