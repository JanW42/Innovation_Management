import fs from 'fs';
import path from 'path';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'app.db');

declare global {
  var __svDb: Promise<Database> | undefined;
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY, deceased_first_name TEXT NOT NULL, deceased_last_name TEXT NOT NULL,
  death_date TEXT NOT NULL, created_by TEXT NOT NULL, lifecycle_status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS case_members (
  case_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, can_approve INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (case_id, user_id)
);
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
  token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, accepted_at TEXT, invited_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, label TEXT NOT NULL, bank_name TEXT, iban_masked TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR', balance_minor INTEGER, balance_as_of TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, bank_account_id TEXT, kind TEXT NOT NULL,
  file_path TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'queued', review_status TEXT NOT NULL DEFAULT 'pending',
  error TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS extractions (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, document_id TEXT NOT NULL, schema_version TEXT NOT NULL,
  extracted_json TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS statement_imports (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, bank_account_id TEXT NOT NULL, document_id TEXT NOT NULL,
  period_start TEXT, period_end TEXT, completeness_status TEXT NOT NULL DEFAULT 'complete'
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, bank_account_id TEXT NOT NULL, import_id TEXT NOT NULL,
  booking_date TEXT NOT NULL, value_date TEXT, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
  counterparty TEXT NOT NULL, purpose TEXT, creditor_id TEXT, mandate_ref TEXT,
  fingerprint TEXT NOT NULL, review_status TEXT NOT NULL DEFAULT 'unreviewed'
);
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, provider_name TEXT NOT NULL, provider_domain TEXT,
  official_url TEXT, url_retrieved_at TEXT, url_verified INTEGER NOT NULL DEFAULT 0,
  category TEXT, expected_amount_minor INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
  interval TEXT NOT NULL DEFAULT 'unknown', recognition_score REAL NOT NULL DEFAULT 0,
  recognition_reason TEXT, review_status TEXT NOT NULL DEFAULT 'suggested',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contract_transactions (
  contract_id TEXT NOT NULL, transaction_id TEXT NOT NULL, PRIMARY KEY (contract_id, transaction_id)
);
CREATE TABLE IF NOT EXISTS cancellations (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, contract_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
  channel TEXT NOT NULL, recipient TEXT, letter_text TEXT, template_version TEXT NOT NULL DEFAULT 'v1',
  approved_by TEXT, approved_at TEXT, sent_at TEXT, confirmation_note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cancellation_events (
  id TEXT PRIMARY KEY, cancellation_id TEXT NOT NULL, event TEXT NOT NULL, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, section TEXT NOT NULL, title TEXT NOT NULL,
  description TEXT, source TEXT, status TEXT NOT NULL DEFAULT 'open', done_at TEXT
);
CREATE TABLE IF NOT EXISTS funeral_contacts (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL UNIQUE, company TEXT, contact_name TEXT,
  phone TEXT, email TEXT, address TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
  sources_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY, case_id TEXT, actor_id TEXT, action TEXT NOT NULL,
  entity_type TEXT, entity_id TEXT, at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, case_id TEXT, payload_json TEXT, status TEXT NOT NULL DEFAULT 'queued',
  error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
`;

function initSchema(db: Database) {
  db.run(SCHEMA);
}

function load(): Promise<Database> {
  ensureDataDir();
  return initSqlJs({
    locateFile: (f: string) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
  }).then((SQL) => {
    const db = fs.existsSync(DB_FILE)
      ? new SQL.Database(fs.readFileSync(DB_FILE))
      : new SQL.Database();
    initSchema(db);
    save(db);
    return db;
  });
}

export function getDb(): Promise<Database> {
  if (!globalThis.__svDb) globalThis.__svDb = load();
  return globalThis.__svDb;
}

export function save(db: Database) {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, db.export());
}

export function nowIso() {
  return new Date().toISOString();
}

export function uuid() {
  return crypto.randomUUID();
}

export interface Row {
  [key: string]: unknown;
}

export function queryAll(db: Database, sql: string, params: SqlValue[] = []): Row[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Row[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as Row);
  stmt.free();
  return rows;
}

export function queryOne(db: Database, sql: string, params: SqlValue[] = []): Row | null {
  return queryAll(db, sql, params)[0] ?? null;
}

export function execSql(db: Database, sql: string, params: SqlValue[] = []) {
  db.run(sql, params);
  save(db);
}
