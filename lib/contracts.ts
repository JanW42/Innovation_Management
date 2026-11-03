export type Interval = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'irregular' | 'unknown';

export interface TxLike {
  id: string;
  booking_date: string;
  amount_minor: number;
  counterparty: string;
  purpose?: string;
  creditor_id?: string;
  mandate_ref?: string;
  bank_account_id: string;
}

export interface ContractSuggestion {
  providerName: string;
  interval: Interval;
  expectedAmountMinor: number;
  monthlyCostMinor: number;
  score: number;
  reason: string;
  transactionIds: string[];
}

export function normalizeName(name: string): string {
  return name
    .toUpperCase()
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
    .replace(/[^A-Z0-9]/g, '');
}

const MS_DAY = 86400_000;

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_DAY);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function classifyInterval(medianGapDays: number, spanDays: number, count: number): Interval {
  if (count < 2) return 'unknown';
  if (medianGapDays >= 24 && medianGapDays <= 36) return 'monthly';
  if (medianGapDays >= 75 && medianGapDays <= 110) return 'quarterly';
  if (medianGapDays >= 150 && medianGapDays <= 210) return 'semiannual';
  if (medianGapDays >= 300 && medianGapDays <= 420 && spanDays / Math.max(1, count - 1) >= 300) return 'annual';
  if (count >= 3 && spanDays >= 90) return 'irregular';
  return 'unknown';
}

const INTERVAL_MONTHS: Record<Interval, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12, irregular: 12, unknown: 1
};

export function monthlyCostMinor(amountMinor: number, interval: Interval): number {
  if (interval === 'unknown') return amountMinor;
  return Math.round(amountMinor / INTERVAL_MONTHS[interval]);
}

export function detectContracts(txs: TxLike[]): ContractSuggestion[] {
  const debits = txs.filter((t) => t.amount_minor < 0);
  const groups = new Map<string, TxLike[]>();
  for (const tx of debits) {
    const key = tx.creditor_id || tx.mandate_ref || normalizeName(tx.counterparty);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const suggestions: ContractSuggestion[] = [];
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.booking_date.localeCompare(b.booking_date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap = daysBetween(sorted[i - 1].booking_date, sorted[i].booking_date);
      if (gap > 0 && gap < 400) gaps.push(gap);
    }
    if (gaps.length < 1) continue;
    const medianGap = median(gaps);
    const spanDays = daysBetween(sorted[0].booking_date, sorted[sorted.length - 1].booking_date);
    const interval = classifyInterval(medianGap, spanDays, sorted.length);
    if (interval === 'unknown') continue;

    const amounts = sorted.map((t) => Math.abs(t.amount_minor));
    const amountStable = median(amounts) > 0 && Math.max(...amounts) - Math.min(...amounts) <= median(amounts) * 0.25;
    const gapsStable = gaps.length >= 2 && Math.max(...gaps) - Math.min(...gaps) <= medianGap * 0.6;

    let score = 0;
    if (sorted.length >= 3) score += 0.3;
    if (sorted.length >= 4) score += 0.1;
    if (gapsStable) score += 0.3;
    if (amountStable) score += 0.2;
    if (interval === 'annual') score -= 0.2;

    const amountMinor = median(amounts);
    const names = [...new Set(sorted.map((t) => t.counterparty.trim()))];
    const purpose = sorted[sorted.length - 1].purpose?.trim();

    let reason = `${sorted.length} Abbuchungen von „${names[0]}“ erkannt, Abstand ca. ${Math.round(medianGap)} Tage.`;
    if (interval === 'annual') reason += ' Jährliche Zahlung – bitte prüfen, ob ein Vertrag vorliegt.';
    if (purpose) reason += ` Zweck: ${purpose}`;

    suggestions.push({
      providerName: names[0],
      interval,
      expectedAmountMinor: Math.round(amountMinor),
      monthlyCostMinor: monthlyCostMinor(Math.round(amountMinor), interval),
      score: Math.max(0.05, Math.min(0.95, Math.round(score * 100) / 100)),
      reason,
      transactionIds: sorted.map((t) => t.id)
    });
  }
  return suggestions.sort((a, b) => b.score - a.score);
}
