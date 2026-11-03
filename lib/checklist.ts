import { getDb, queryAll, execSql, uuid } from './db';

export interface ChecklistItem {
  section: string;
  title: string;
  description: string;
  source: string;
}

export const CHECKLIST: ChecklistItem[] = [
  { section: 'Sofort', title: 'Bestatter kontaktieren', description: 'Termin, Bestattungswille und Kosten klären; Kontakt hier im Reiter „Bestatter“ ablegen.', source: 'App-Rubrik Bestatter' },
  { section: 'Sofort', title: 'Sterbeurkunde bestellen', description: 'Bei dem Standesamt am Sterte beantragen (mehrere Ausfertigungen für Versicherung, Bank, Arbeitgeber).', source: 'Standesamt, § 30 PStG' },
  { section: 'Sofort', title: 'Wohnsituation prüfen', description: 'Wird die Wohnung weiter bewohnt? Mietvertrag, Strom, Versicherungen ggf. ummelden statt kündigen.', source: 'Fachliche Prüfung AP01' },
  { section: 'Behörden', title: 'Rentenversicherung informieren', description: 'Waisenrente/Witwenrente prüfen und Antrag stellen, falls zutreffend.', source: 'deutsche-rentenversicherung.de' },
  { section: 'Behörden', title: 'Fristen für Erbschaftsteuer beachten', description: 'Erklärung innerhalb eines Monats nach Kenntnis der Erbschaft bei der Steuerbehörde.', source: 'erbschaftsteuer.info / Finanzamt' },
  { section: 'Versicherungen', title: 'Versicherungen informieren', description: 'Kranken-, Pflege-, Haftpflicht- und Lebensversicherungen; Hinterbliebenenleistungen prüfen.', source: 'Verträge/Prämienbriefe' },
  { section: 'Finanzen', title: 'Konten und Verträge sichten', description: 'Kontoauszüge hier hochladen, erkannte Verträge prüfen und Kündigungen freigeben.', source: 'App-Reiter Verträge' },
  { section: 'Finanzen', title: 'Berechtigungen klären', description: 'Vollmacht, Erbschein oder Testamentsvollstreckung für Banken/Anbieter nachweisen.', source: 'Notar/Familiengericht' },
  { section: 'Arbeitgeber', title: 'Arbeitgeber informieren', description: 'Arbeitsverhältnis endet; Abfindungen/Resturlaub und Sozialversicherung abmelden.', source: 'Arbeitsvertrag' }
];

export async function seedChecklist(caseId: string): Promise<void> {
  const db = await getDb();
  const existing = queryAll(db, 'SELECT id FROM tasks WHERE case_id = ?', [caseId]);
  if (existing.length > 0) return;
  for (const item of CHECKLIST) {
    execSql(db, `INSERT INTO tasks (id, case_id, section, title, description, source) VALUES (?,?,?,?,?,?)`,
      [uuid(), caseId, item.section, item.title, item.description, item.source]);
  }
}
