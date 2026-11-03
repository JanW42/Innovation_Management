import fs from 'fs';
import path from 'path';
import { getDb, queryAll, queryOne, execSql, uuid, nowIso, save, type Row } from './db';
import { parseCsvStatement, extractPdfText, parseStatementText, visionExtractStatement, visionExtractDeathCertificate, type ParsedStatement } from './extract';
import { detectContracts, normalizeName } from './contracts';
import { researchProvider } from './research';

const INTERVAL_LABELS: Record<string, string> = {
  monthly: 'monatlich', quarterly: 'vierteljährlich', semiannual: 'halbjährlich',
  annual: 'jährlich', irregular: 'unregelmäßig', unknown: 'unbekannt'
};

export function intervalLabel(interval: string): string {
  return INTERVAL_LABELS[interval] ?? 'unbekannt';
}

async function setDocStatus(docId: string, processingStatus: string, error: string | null = null) {
  const db = await getDbNow();
  execSql(db, 'UPDATE documents SET processing_status = ?, error = ? WHERE id = ?', [processingStatus, error, docId]);
}

let dbNow: Awaited<ReturnType<typeof getDb>> | null = null;
async function getDbNow() {
  if (!dbNow) dbNow = await getDb();
  return dbNow;
}

function txFingerprint(accountId: string, date: string, amount: number, counterparty: string): string {
  return `${accountId}|${date}|${amount}|${normalizeName(counterparty)}`.toLowerCase();
}

async function importStatement(caseId: string, accountId: string, documentId: string, parsed: ParsedStatement) {
  const db = await getDbNow();
  const importId = uuid();
  execSql(db, `INSERT INTO statement_imports (id, case_id, bank_account_id, document_id, period_start, period_end)
    VALUES (?,?,?,?,?,?)`, [importId, caseId, accountId, documentId, parsed.period_start ?? null, parsed.period_end ?? null]);
  let inserted = 0;
  for (const tx of parsed.transactions) {
    const fp = txFingerprint(accountId, tx.booking_date, tx.amount_minor, tx.counterparty);
    const existing = queryOne(db, 'SELECT id FROM transactions WHERE fingerprint = ?', [fp]);
    if (existing) continue;
    const id = uuid();
    execSql(db, `INSERT INTO transactions (id, case_id, bank_account_id, import_id, booking_date, value_date,
      amount_minor, counterparty, purpose, creditor_id, mandate_ref, fingerprint)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, caseId, accountId, importId, tx.booking_date, tx.value_date ?? null, tx.amount_minor,
        tx.counterparty, tx.purpose ?? null, tx.creditor_id ?? null, tx.mandate_ref ?? null, fp]);
    inserted++;
  }
  const extraction = { source: parsed.source, period_start: parsed.period_start, period_end: parsed.period_end, transactions_inserted: inserted, transactions_total: parsed.transactions.length };
  execSql(db, `INSERT INTO extractions (id, case_id, document_id, schema_version, extracted_json, created_at)
    VALUES (?,?,?,?,?,?)`, [uuid(), caseId, documentId, 'v1', JSON.stringify(extraction), nowIso()]);
  await reanalyzeContracts(caseId);
  return inserted;
}

async function reanalyzeContracts(caseId: string) {
  const db = await getDbNow();
  const txs = queryAll(db, `SELECT t.id, t.booking_date, t.amount_minor, t.counterparty, t.purpose,
    t.creditor_id, t.mandate_ref, t.bank_account_id FROM transactions t WHERE t.case_id = ?`, [caseId]);
  const suggestions = detectContracts(txs as never);
  for (const s of suggestions) {
    const existing = queryOne(db, 'SELECT id FROM contracts WHERE case_id = ? AND provider_name = ?',
      [caseId, s.providerName]);
    if (existing) continue;
    const id = uuid();
    execSql(db, `INSERT INTO contracts (id, case_id, provider_name, expected_amount_minor, interval,
      recognition_score, recognition_reason, review_status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, caseId, s.providerName, s.expectedAmountMinor, s.interval, s.score, s.reason, 'suggested', nowIso()]);
    for (const txId of s.transactionIds) {
      execSql(db, 'INSERT OR IGNORE INTO contract_transactions (contract_id, transaction_id) VALUES (?,?)', [id, txId]);
    }
  }
}

async function processDocument(jobPayload: Record<string, unknown>) {
  const documentId = String(jobPayload.documentId);
  const db = await getDbNow();
  const doc = queryOne(db, 'SELECT * FROM documents WHERE id = ?', [documentId]);
  if (!doc) return;
  const filePath = String(doc.file_path);
  const buffer = fs.readFileSync(filePath);
  const mime = String(doc.mime_type);
  const fileName = path.basename(filePath);

  if (String(doc.kind) === 'death_certificate') {
    let fields: unknown = null;
    let note: string | null = null;
    try {
      if (mime === 'application/pdf') {
        const text = await extractPdfText(new Uint8Array(buffer));
        if (text.trim().length > 50) {
          fields = { source: 'pdf-text', raw_text_preview: text.slice(0, 2000), note: 'Text erkannt – bitte Felder prüfen und ergänzen.' };
        }
      }
      if (!fields) {
        const vision = await visionExtractDeathCertificate(fileName, mime, new Uint8Array(buffer));
        if (vision) fields = { source: 'vision', ...vision };
      }
    } catch (err) {
      note = `Auswertung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (!fields && !note) note = 'Keine Automatik möglich (OpenAI nicht konfiguriert). Bitte Daten manuell im Formular prüfen/erfassen.';
    const extraction = fields ?? { source: 'manual', note };
    execSql(db, `INSERT INTO extractions (id, case_id, document_id, schema_version, extracted_json, created_at)
      VALUES (?,?,?,?,?,?)`, [uuid(), String(doc.case_id), documentId, 'v1', JSON.stringify(extraction), nowIso()]);
    execSql(db, `UPDATE documents SET processing_status = 'ready_for_review', review_status = 'pending', error = ? WHERE id = ?`, [note, documentId]);
    return;
  }

  // Kontoauszug
  try {
    let parsed: ParsedStatement | null = null;
    if (mime === 'text/csv' || fileName.toLowerCase().endsWith('.csv')) {
      parsed = parseCsvStatement(buffer.toString('utf-8'));
    } else if (mime === 'application/pdf') {
      const text = await extractPdfText(new Uint8Array(buffer));
      const fromText = parseStatementText(text);
      if (fromText.length > 0) {
        parsed = { transactions: fromText, source: 'pdf-text' };
        const dates = fromText.map((t) => t.booking_date).sort();
        parsed.period_start = dates[0];
        parsed.period_end = dates[dates.length - 1];
      } else {
        parsed = await visionExtractStatement(fileName, mime, new Uint8Array(buffer));
      }
    } else {
      parsed = await visionExtractStatement(fileName, mime, new Uint8Array(buffer));
    }
    if (!parsed || parsed.transactions.length === 0) {
      await setDocStatus(documentId, 'failed', 'Keine Buchungen erkannt. CSV-Format verwenden oder OpenAI (Bild-/PDF-Verarbeitung) konfigurieren.');
      return;
    }
    const accountId = String(doc.bank_account_id);
    const inserted = await importStatement(String(doc.case_id), accountId, documentId, parsed);
    execSql(db, `UPDATE documents SET processing_status = 'ready_for_review', review_status = 'pending', error = ? WHERE id = ?`,
      [inserted === 0 ? 'Alle Buchungen waren bereits importiert' : null, documentId]);
  } catch (err) {
    await setDocStatus(documentId, 'failed', err instanceof Error ? err.message : String(err));
  }
}

async function runResearch(jobPayload: Record<string, unknown>) {
  const contractId = String(jobPayload.contractId);
  const db = await getDbNow();
  const contract = queryOne(db, 'SELECT * FROM contracts WHERE id = ?', [contractId]);
  if (!contract) return;
  const result = await researchProvider(String(contract.provider_name));
  if (result) {
    execSql(db, `UPDATE contracts SET provider_domain = ?, official_url = ?, url_retrieved_at = ?, url_verified = 0,
      recognition_reason = recognition_reason || ? WHERE id = ?`,
      [result.domain, result.url, nowIso(),
        result.source === 'web-search' ? ` Offizielle Seite via Websuche: ${result.url}` : ` Offizielle Seite (vorab geprüft): ${result.url}`,
        contractId]);
  } else {
    execSql(db, `UPDATE contracts SET recognition_reason = recognition_reason || ? WHERE id = ?`,
      [' Websuche ergab kein verifizierbares Ergebnis – bitte manuell prüfen.', contractId]);
  }
}

async function sendCancellationJob(jobPayload: Record<string, unknown>) {
  const cancellationId = String(jobPayload.cancellationId);
  const db = await getDbNow();
  const row = queryOne(db, `SELECT c.*, k.deceased_first_name, k.deceased_last_name, k.death_date,
      ct.provider_name FROM cancellations c
      JOIN cases k ON k.id = c.case_id JOIN contracts ct ON ct.id = c.contract_id WHERE c.id = ?`, [cancellationId]);
  if (!row) return;
  const letterText = String(row.letter_text ?? '');
  const result = await sendCancellation(cancellationId, letterText);
  if (!result.sent) {
    execSql(db, `UPDATE cancellations SET status = 'failed' WHERE id = ?`, [cancellationId]);
    execSql(db, `INSERT INTO cancellation_events (id, cancellation_id, event, at) VALUES (?,?,?,?)`,
      [uuid(), cancellationId, `failed: ${result.note}`, nowIso()]);
    return;
  }
  execSql(db, `UPDATE cancellations SET status = 'sent', sent_at = ? WHERE id = ?`, [nowIso(), cancellationId]);
  execSql(db, `INSERT INTO cancellation_events (id, cancellation_id, event, at) VALUES (?,?,?,?)`,
    [uuid(), cancellationId, `sent (${result.note})`, nowIso()]);
}

import { sendCancellation } from './mail';

const HANDLERS: Record<string, (p: Record<string, unknown>) => Promise<void>> = {
  'document.process': processDocument,
  'research.run': runResearch,
  'cancellation.send': sendCancellationJob
};

declare global {
  var __svJobsStarted: boolean | undefined;
}

export async function enqueue(type: string, caseId: string | null, payload: Record<string, unknown> = {}) {
  const db = await getDbNow();
  const id = uuid();
  execSql(db, `INSERT INTO jobs (id, type, case_id, payload_json, status, created_at, updated_at)
    VALUES (?,?,?,?, 'queued', ?, ?)`, [id, type, caseId, JSON.stringify(payload), nowIso(), nowIso()]);
  startJobWorker();
  return id;
}

function startJobWorker() {
  if (globalThis.__svJobsStarted) return;
  globalThis.__svJobsStarted = true;
  setInterval(() => {
    void runNextJob();
  }, 1500);
}

let working = false;
async function runNextJob() {
  if (working) return;
  working = true;
  try {
    const db = await getDbNow();
    const job = queryOne(db, `SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1`);
    if (!job) return;
    execSql(db, `UPDATE jobs SET status = 'processing', updated_at = ? WHERE id = ?`, [nowIso(), String(job.id)]);
    const handler = HANDLERS[String(job.type)];
    if (!handler) {
      execSql(db, `UPDATE jobs SET status = 'failed', error = 'Unbekannter Jobtyp', updated_at = ? WHERE id = ?`, [nowIso(), String(job.id)]);
      return;
    }
    const payload = (JSON.parse(String(job.payload_json ?? '{}')) as Record<string, unknown>);
    await handler(payload);
    execSql(db, `UPDATE jobs SET status = 'completed', updated_at = ? WHERE id = ?`, [nowIso(), String(job.id)]);
  } catch (err) {
    try {
      const db = await getDbNow();
      const job = queryOne(db, `SELECT * FROM jobs WHERE status = 'processing' ORDER BY updated_at LIMIT 1`);
      if (job) execSql(db, `UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`,
        [err instanceof Error ? err.message : String(err), nowIso(), String(job.id)]);
    } catch {
      // DB nicht erreichbar – Fehler bleibt in den Logs
    }
  } finally {
    working = false;
  }
}

export async function touchDb() {
  const db = await getDbNow();
  save(db);
}
