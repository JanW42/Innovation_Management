import { getDb, queryOne } from '@/lib/db';
import { buildLetter, type LetterContext } from '@/lib/mail';
import { formatEuro } from '@/lib/format';
import { intervalLabel } from '@/lib/jobs';
import { apiError } from '@/lib/api';

export function isPortalProvider(name: string): boolean {
  const n = name.toUpperCase();
  return ['NETFLIX', 'SPOTIFY', 'AMAZON'].some((p) => n.includes(p));
}

export function buildLetterFor(
  contract: Record<string, unknown>,
  caseRow: Record<string, unknown>,
  requesterName: string,
  requesterAddress: string
): string {
  const ctx: LetterContext = {
    deceasedFirstName: String(caseRow.deceased_first_name),
    deceasedLastName: String(caseRow.deceased_last_name),
    deathDate: String(caseRow.death_date),
    providerName: String(contract.provider_name),
    expectedAmountLabel: formatEuro(Number(contract.expected_amount_minor)),
    intervalLabel: intervalLabel(String(contract.interval)),
    accountLabel: '–',
    requesterName,
    requesterAddress
  };
  return buildLetter(ctx);
}

export interface PreviewItem {
  contract: Record<string, unknown>;
  channel: string;
  note: string;
}

export async function previewCancellation(caseId: string, contractIds: string[]): Promise<{ caseName: string; items: PreviewItem[] }> {
  const db = await getDb();
  const caseRow = queryOne(db, 'SELECT * FROM cases WHERE id = ?', [caseId]);
  if (!caseRow) throw apiError('Fall nicht gefunden', 404);
  const items: PreviewItem[] = [];
  for (const contractId of contractIds) {
    const contract = queryOne(db, 'SELECT * FROM contracts WHERE id = ? AND case_id = ?', [contractId, caseId]);
    if (!contract) throw apiError(`Vertrag ${contractId} nicht gefunden`, 404);
    if (String(contract.review_status) === 'rejected') {
      throw apiError(`„${String(contract.provider_name)}“ wurde als nicht-kündigbar abgelehnt`, 400);
    }
    const portal = isPortalProvider(String(contract.provider_name));
    items.push({
      contract,
      channel: portal ? 'portal' : 'email',
      note: portal
        ? 'Dieser Anbieter kann nur im Online-Konto gekündigt werden. Die App legt eine Aufgabe mit offiziellem Link an.'
        : 'Kündigung per Brief/E-Mail an den Anbieter.'
    });
  }
  return { caseName: `${String(caseRow.deceased_first_name)} ${String(caseRow.deceased_last_name)}`, items };
}