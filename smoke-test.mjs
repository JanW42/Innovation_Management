const BASE = 'http://localhost:3000';
const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: Boolean(cond), extra });
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  [' + extra + ']' : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RUN = Date.now().toString(36);
let cookie = '';
async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers ?? {}), ...(cookie ? { cookie } : {}) }
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let body = null;
  try { body = await res.json(); } catch { /* html */ }
  return { status: res.status, body };
}

// 1. Registrierung + Login
let r = await api('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `anna-${RUN}@test.de`, password: 'passw0rd', display_name: 'Anna' }) });
check('Registrierung', r.status === 200, JSON.stringify(r.body).slice(0, 120));
r = await api('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `anna-${RUN}@test.de`, password: 'passw0rd' }) });
check('Login (Session-Cookie)', r.status === 200 && cookie.includes('sv_session'));

// 2. Fall anlegen
r = await api('/api/cases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deceased_first_name: 'Hans', deceased_last_name: 'Muster', death_date: '2026-10-01' }) });
const caseId = r.body?.id;
check('Fall anlegen', r.status === 201 && caseId);

// 3. Checkliste + Bestatter
r = await api(`/api/cases/${caseId}/tasks`);
check('Checkliste geseedet', (r.body?.tasks ?? []).length >= 5, String(r.body?.tasks?.length));
await api(`/api/cases/${caseId}/funeral`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ company: 'Bestattung Haus Müller', contact_name: 'Frau Müller', phone: '01234 567890', email: 'info@best-mueller.de', address: 'Hauptstr. 1, 12345 Ort' }) });
r = await api(`/api/cases/${caseId}/funeral`);
check('Bestatter gespeichert', r.body?.contact?.phone === '01234 567890');

// 4. Konto + Kontostand
r = await api(`/api/cases/${caseId}/accounts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: 'Girokonto', bank_name: 'Sparkasse', iban_masked: 'DE12 •••• 7890' }) });
const accountId = r.body?.id;
check('Konto anlegen', r.status === 201 && accountId);
r = await api(`/api/cases/${caseId}/accounts/${accountId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ balance_minor: 123456, balance_as_of: '2026-09-30' }) });
check('Kontostand speichern', r.status === 200);

// 5. CSV-Auszug mit wiederkehrenden Abbuchungen hochladen
const csv = [
  'Buchungstag;Wertstag;Empfaenger;Verwendungszweck;Betrag',
  '02.06.2026;02.06.2026;DAK Gesundheit;Krankenkassenbeitrag; -24,90',
  '02.07.2026;02.07.2026;DAK Gesundheit;Krankenkassenbeitrag; -24,90',
  '02.08.2026;02.08.2026;DAK Gesundheit;Krankenkassenbeitrag; -24,90',
  '02.09.2026;02.09.2026;DAK Gesundheit;Krankenkassenbeitrag; -24,90',
  '05.06.2026;05.06.2026;Netflix.com;Abo; -9,99',
  '05.07.2026;05.07.2026;Netflix.com;Abo; -9,99',
  '05.08.2026;05.08.2026;Netflix.com;Abo; -9,99',
  '05.09.2026;05.09.2026;Netflix.com;Abo; -9,99',
  '01.07.2025;01.07.2025;ACME Versicherung;Laufende Prämie; -60,00',
  '01.07.2026;01.07.2026;ACME Versicherung;Laufende Prämie; -60,00',
  '15.07.2026;15.07.2026;Sohn Petersen;Überweisung; -500,00'
].join('\n');
const form = new FormData();
form.append('file', new File([csv], 'auszug.csv', { type: 'text/csv' }));
form.append('kind', 'bank_statement');
form.append('bank_account_id', accountId);
r = await api(`/api/cases/${caseId}/documents`, { method: 'POST', body: form });
check('CSV-Upload', r.status === 202, JSON.stringify(r.body).slice(0, 100));

// 6. Warten auf Verarbeitung
let contracts = [];
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  const d = await api(`/api/cases/${caseId}/contracts`);
  contracts = d.body?.contracts ?? [];
  if (contracts.length >= 2) break;
}
check('Verträge automatisch erkannt', contracts.length >= 2, `gefunden: ${contracts.map((c) => c.provider_name).join(', ')}`);
const dak = contracts.find((c) => c.provider_name.includes('DAK'));
const netflix = contracts.find((c) => c.provider_name.includes('Netflix'));
const acme = contracts.find((c) => c.provider_name.includes('ACME'));
check('DAK monatlich erkannt', dak?.interval === 'monthly' && Number(dak.expected_amount_minor) === 2490);
check('Jährliche Prämie erkannt', acme?.interval === 'annual');
check('Einmaler nicht als Vertrag', !contracts.some((c) => c.provider_name.includes('Petersen')));

// 7. Sterbeurkunde (ohne OpenAI: Hinweis + manueller Weg)
const form2 = new FormData();
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
form2.append('file', new File([pngBytes], 'sterbeurkunde.png', { type: 'image/png' }));
form2.append('kind', 'death_certificate');
r = await api(`/api/cases/${caseId}/documents`, { method: 'POST', body: form2 });
check('Sterbeurkunde-Upload', r.status === 202);
let docStatus = '';
for (let i = 0; i < 20; i++) {
  await sleep(1000);
  const d = await api(`/api/cases/${caseId}/documents`);
  const doc = (d.body?.documents ?? []).find((x) => x.kind === 'death_certificate');
  docStatus = doc?.processing_status ?? '';
  if (docStatus !== 'queued' && docStatus !== 'processing') break;
}
check('Sterbeurkunde verarbeitet (Hinweis ohne OpenAI)', docStatus === 'ready_for_review' || docStatus === 'failed', docStatus);

// 8. Recherche (Mock-Modus: DAK-Hint)
r = await api(`/api/cases/${caseId}/contracts/${dak.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'research' }) });
check('Recherche gestartet', r.status === 200);
let withUrl = false;
for (let i = 0; i < 20; i++) {
  await sleep(1000);
  const d = await api(`/api/cases/${caseId}/contracts/${dak.id}`);
  if (d.body?.contract?.official_url) { withUrl = true; break; }
}
check('Offizieller Link erfasst', withUrl, 'dak.de erwartet');

// 9. Ablehnung eines Vertrags (Petersen existiert nicht; Netflix ablehnen -> Prüfung)
// Preview mit DAK + ACME
r = await api(`/api/cases/${caseId}/cancellation/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contract_ids: [dak.id, acme.id] }) });
check('Kündigungs-Vorschau', r.status === 200 && (r.body?.items ?? []).length === 2);

// 10. Freigabe (Owner darf)
r = await api(`/api/cases/${caseId}/cancellation/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contract_ids: [dak.id, acme.id], requester_name: 'Anna Mustermann', requester_address: 'Beispielweg 3, 12345 Ort', confirmed: true }) });
check('Kündigungen freigegeben', r.status === 201, JSON.stringify(r.body).slice(0, 120));

// 11. Versand (dev simuliert)
let sentCount = 0;
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  const d = await api(`/api/cases/${caseId}/cancellations`);
  sentCount = (d.body?.cancellations ?? []).filter((c) => c.status === 'sent').length;
  if (sentCount >= 2) break;
}
check('Kündigungen versendet (Sim)', sentCount >= 2, String(sentCount));

// 12. Bestätigung erhalten
r = await api(`/api/cases/${caseId}/cancellations`, {});
const firstCancel = (r.body?.cancellations ?? []).find((c) => c.contract_id === dak.id) ?? (r.body?.cancellations ?? [])[0];
r = await api(`/api/cases/${caseId}/cancellations/${firstCancel.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: 'Einschreiben erhalten' }) });
check('Bestätigung erfasst', r.status === 200);
const d = await api(`/api/cases/${caseId}/contracts`);
const dakAfter = (d.body?.contracts ?? []).find((c) => c.id === dak.id);
check('Vertrag nach Bestätigung beendet', dakAfter?.review_status === 'ended');

// 13. Chat (Mock-Modus, Streaming)
async function chatStream(question) {
  const res = await fetch(BASE + `/api/cases/${caseId}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ messages: [{ role: 'user', content: question }] })
  });
  if (!res.ok || !res.body) return { status: res.status, content: '' };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          const p = JSON.parse(line.slice(5).trim());
          if (typeof p.delta === 'string') content += p.delta;
          if (p.error) content = p.error;
        } catch { /* unvollständiges Ereignis */ }
      }
    }
  }
  return { status: res.status, content };
}
let chat1 = await chatStream('Was ist als Nächstes zu tun?');
check('Chat antwortet (Streaming)', chat1.status === 200 && chat1.content.length > 20, chat1.content.slice(0, 60));
let chat2 = await chatStream('Wie kündige ich die Verträge?');
check('Chat erklärt Kündigung (Streaming)', chat2.content.includes('Verträge'));

// 14. Familie: Einladung + Rechte
r = await api(`/api/cases/${caseId}/family`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `bruder-${RUN}@test.de`, role: 'editor' }) });
const inviteToken = r.body?.token;
check('Einladung erstellt', r.status === 201 && inviteToken);
cookie = '';
r = await api('/api/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: inviteToken, email: `bruder-${RUN}@test.de`, password: 'passw0rd123', display_name: 'Bernd' }) });
check('Einladung angenommen (2. User)', r.status === 200 && r.body?.caseId === caseId);
r = await api(`/api/cases/${caseId}/contracts`);
check('Editor kann lesen', r.status === 200);
r = await api(`/api/cases/${caseId}/cancellation/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contract_ids: [netflix.id], confirmed: true }) });
check('Editor ohne Freigaberecht wird blockiert', r.status === 403, `Status ${r.status}`);
// Owner gibt Freigaberecht
cookie = '';
await api('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `anna-${RUN}@test.de`, password: 'passw0rd' }) });
const mem = await api(`/api/cases/${caseId}/family`);
const bernd = (mem.body?.members ?? []).find((m) => m.email === `bruder-${RUN}@test.de`);
await api(`/api/cases/${caseId}/family/${bernd.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'editor', can_approve: true }) });
cookie = '';
await api('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `bruder-${RUN}@test.de`, password: 'passw0rd123' }) });
r = await api(`/api/cases/${caseId}/cancellation/approve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contract_ids: [netflix.id], confirmed: true }) });
check('Editor mit Freigaberecht darf freigeben (Portal-Kanal)', r.status === 201, JSON.stringify(r.body).slice(0, 120));
const d2 = await api(`/api/cases/${caseId}/cancellations`);
const portal = (d2.body?.cancellations ?? []).find((c) => c.channel === 'portal');
check('Portal-Kündigung als Aufgabe, kein Versand', portal?.status === 'approved' && !portal.sent_at);
const tasks = await api(`/api/cases/${caseId}/tasks`);
check('Portal-Aufgabe in Checkliste', (tasks.body?.tasks ?? []).some((t) => String(t.title).includes('Netflix')));

// 15. Viewer-Rechte
cookie = '';
await api('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `tante-${RUN}@test.de`, password: 'passw0rd123', display_name: 'Tante' }) });
await api('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `tante-${RUN}@test.de`, password: 'passw0rd123' }) });
r = await api(`/api/cases/${caseId}/contracts`);
check('Fremde ohne Mitgliedschaft: 403', r.status === 403);

// 16. Unautorisierter Zugriff
cookie = '';
r = await api(`/api/cases/${caseId}/contracts`);
check('Ohne Session: 401', r.status === 401);

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} Bestanden`);
process.exit(failed.length > 0 ? 1 : 0);