import { cookies } from 'next/headers';
import { login, sessionCookieName } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const user = await login(String(body.email ?? ''), String(body.password ?? ''));
    const store = await cookies();
    store.set(sessionCookieName(), String(user.token), {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 86400
    });
    return ok({ user: { id: user.id, email: user.email, display_name: user.display_name } });
  } catch (err) {
    return handleApiError(err);
  }
}
