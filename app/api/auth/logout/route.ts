import { cookies } from 'next/headers';
import { logout } from '@/lib/auth';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST() {
  await logout();
  const store = await cookies();
  store.delete('sv_session');
  return ok({ ok: true });
}
