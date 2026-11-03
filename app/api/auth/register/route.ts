import { registerUser } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string; display_name?: string };
    const user = await registerUser(String(body.email ?? ''), String(body.password ?? ''), String(body.display_name ?? ''));
    return ok({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
