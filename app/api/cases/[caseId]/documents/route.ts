import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { getDb, execSql, uuid, queryAll } from '@/lib/db';
import { enqueue } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'text/csv': 'csv'
};

export async function GET(_req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'read');
    const db = await getDb();
    const rows = queryAll(db, `SELECT d.id, d.kind, d.mime_type, d.size_bytes, d.processing_status, d.review_status,
      d.error, d.created_at, a.label AS account_label, a.id AS account_id, e.extracted_json
      FROM documents d LEFT JOIN bank_accounts a ON a.id = d.bank_account_id
      LEFT JOIN extractions e ON e.document_id = d.id WHERE d.case_id = ? ORDER BY d.created_at DESC`, [caseId]);
    return ok({ documents: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'write');
    const form = await req.formData();
    const file = form.get('file');
    const kind = String(form.get('kind') ?? '');
    const accountId = form.get('bank_account_id') ? String(form.get('bank_account_id')) : null;
    if (!(file instanceof File)) throw apiError('Keine Datei übermittelt', 400);
    if (!['bank_statement', 'death_certificate', 'authority_proof', 'other'].includes(kind)) {
      throw apiError('Unbekannter Dokumenttyp', 400);
    }
    const mime = file.type;
    if (!ALLOWED[mime]) throw apiError('Nur PDF, JPG, PNG oder CSV erlaubt', 400);
    if (file.size > MAX_BYTES) throw apiError('Datei ist größer als 25 MB', 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');

    const db = await getDb();
    const docId = uuid();
    const dir = path.join(process.cwd(), 'data', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const filePath = path.join(dir, `${docId}-${safeName}`);
    fs.writeFileSync(filePath, bytes);
    const relPath = path.join('data', 'uploads', path.basename(filePath));

    execSql(db, `INSERT INTO documents (id, case_id, bank_account_id, kind, file_path, mime_type, size_bytes, sha256, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      [docId, caseId, accountId, kind, relPath, mime, file.size, hash, new Date().toISOString()]);
    const jobType = kind === 'death_certificate' || kind === 'authority_proof' ? 'document.process' : 'document.process';
    await enqueue(jobType, caseId, { documentId: docId });
    return ok({ documentId: docId }, { status: 202 });
  } catch (err) {
    return handleApiError(err);
  }
}

