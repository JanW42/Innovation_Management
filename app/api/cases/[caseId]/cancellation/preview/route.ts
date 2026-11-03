import { requireCase, ok, handleApiError, apiError } from '@/lib/api';
import { previewCancellation } from '@/lib/cancellation';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await ctx.params;
    await requireCase(caseId, 'read');
    const body = (await req.json()) as { contract_ids?: string[] };
    if (!Array.isArray(body.contract_ids) || body.contract_ids.length === 0) {
      throw apiError('Keine Verträge ausgewählt', 400);
    }
    return ok(await previewCancellation(caseId, body.contract_ids.map(String)));
  } catch (err) {
    return handleApiError(err);
  }
}