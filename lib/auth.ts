import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getDb, queryOne, execSql, uuid, nowIso, type Row } from './db';

const COOKIE = 'sv_session';
const SESSION_DAYS = 30;

export function hashPassword(password: string, salt?: string): string {
  const s = salt ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return `${s}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export async function registerUser(email: string, password: string, displayName: string): Promise<Row> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new Error('Ungültige E-Mail-Adresse');
  if (password.length < 8) throw new Error('Passwort braucht mindestens 8 Zeichen');
  const existing = queryOne(db, 'SELECT id FROM users WHERE email = ?', [normalized]);
  if (existing) throw new Error('E-Mail ist bereits registriert');
  const id = uuid();
  execSql(db, 'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
    [id, normalized, hashPassword(password), displayName.trim() || normalized, nowIso()]);
  return { id, email: normalized, display_name: displayName.trim() || normalized };
}

export async function login(email: string, password: string): Promise<Row> {
  const db = await getDb();
  const user = queryOne(db, 'SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!user || !verifyPassword(password, String(user.password_hash))) throw new Error('E-Mail oder Passwort ist falsch');
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  execSql(db, 'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)',
    [token, String(user.id), nowIso(), expires]);
  return { ...user, token };
}

export async function sessionUser(): Promise<Row | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const row = queryOne(db, `
    SELECT u.id, u.email, u.display_name
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?`, [token, nowIso()]);
  return row;
}

export async function logout() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    execSql(db, 'DELETE FROM sessions WHERE token = ?', [token]);
  }
}

export function sessionCookieName() {
  return COOKIE;
}
