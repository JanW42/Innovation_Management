export interface LetterContext {
  deceasedFirstName: string;
  deceasedLastName: string;
  deathDate: string;
  providerName: string;
  expectedAmountLabel: string;
  intervalLabel: string;
  accountLabel: string;
  requesterName: string;
  requesterAddress: string;
}

export function buildLetter(ctx: LetterContext): string {
  const date = new Date().toLocaleDateString('de-DE');
  const death = new Date(ctx.deathDate).toLocaleDateString('de-DE');
  return [
    ctx.requesterName,
    ctx.requesterAddress,
    '',
    ctx.providerName,
    '',
    `${date}`,
    '',
    'Kündigung des Vertrags infolge des Todes der versicherten bzw. vertraglich gebundenen Person',
    '',
    `Sehr geehrte Damen und Herren,`,
    '',
    `hiermit kündige ich als berechtigte Angehörige Person den zu ${ctx.expectedAmountLabel} (${ctx.intervalLabel}) bestehenden Vertrag von ${ctx.deceasedFirstName} ${ctx.deceasedLastName} (Konto: ${ctx.accountLabel}) fristgerecht und ohne weitere Bindung.`,
    `Die Person verstarb am ${death}. Eine Sterbeurkunde liegt bei bzw. wird auf Anforderung nachgereicht.`,
    '',
    'Bitte bestätigen Sie mir die Kündigung schriftlich und geben Sie mir den Beendigungszeitpunkt des Vertrags sowie eventuelle Restforderungen bekannt.',
    '',
    'Mit freundlichen Grüßen',
    '',
    ctx.requesterName
  ].join('\n');
}

export async function sendCancellation(cancellationId: string, letterText: string): Promise<{ sent: boolean; note: string }> {
  const mode = process.env.MAIL_MODE ?? 'dev';
  if (mode === 'dev') {
    console.log(`[mail:dev] Kündigung ${cancellationId} – simulierter Versand\n${letterText}`);
    return { sent: true, note: 'Dev-Modus: Versand simuliert (MAIL_MODE=dev)' };
  }
  if (mode === 'smtp') {
    throw new Error('SMTP-Versand ist im MVP nicht implementiert – MAIL_MODE=dev verwenden');
  }
  throw new Error(`Unbekannter MAIL_MODE: ${mode}`);
}
