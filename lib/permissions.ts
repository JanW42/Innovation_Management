import type { Row } from './db';

export type Role = 'owner' | 'editor' | 'viewer';

export interface Membership {
  role: Role;
  canApprove: boolean;
}

export type CaseAction = 'read' | 'write' | 'approve';

export function parseMembership(row: Row | null): Membership | null {
  if (!row) return null;
  const role = String(row.role) as Role;
  if (!['owner', 'editor', 'viewer'].includes(role)) return null;
  return { role, canApprove: Number(row.can_approve) === 1 || role === 'owner' };
}

export function authorizeCaseAction(membership: Membership | null, action: CaseAction): void {
  if (!membership) {
    const err = new Error('Kein Zugriff auf diesen Fall');
    (err as { status?: number }).status = 403;
    throw err;
  }
  const allowed: Record<Role, CaseAction[]> = {
    owner: ['read', 'write', 'approve'],
    editor: ['read', 'write', ...(membership.canApprove ? ['approve' as const] : [])],
    viewer: ['read']
  };
  if (!allowed[membership.role].includes(action)) {
    const err = new Error('Ihre Rolle erlaubt diese Aktion nicht');
    (err as { status?: number }).status = 403;
    throw err;
  }
}
