import { NextResponse } from 'next/server';
import { sessionUser } from './auth';
import { getDb, queryOne, type Row } from './db';
import { parseMembership, authorizeCaseAction, type CaseAction, type Membership } from './permissions';

export interface ApiError extends Error {
  status: number;
}

export function apiError(message: string, status: number): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  return err;
}

export async function requireUser(): Promise<Row> {
  const user = await sessionUser();
  if (!user) throw apiError('Bitte anmelden', 401);
  return user;
}

export async function requireCase(caseId: string, action: CaseAction): Promise<{ user: Row; membership: Membership }> {
  const user = await requireUser();
  const db = await getDb();
  const membershipRow = queryOne(db, 'SELECT role, can_approve FROM case_members WHERE case_id = ? AND user_id = ?', [caseId, String(user.id)]);
  const membership = parseMembership(membershipRow);
  authorizeCaseAction(membership, action);
  return { user, membership: membership as Membership };
}

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof Error && typeof (err as ApiError).status === 'number') {
    const e = err as ApiError;
    if (e.status >= 400 && e.status < 600) return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error('[api]', err);
  return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
}