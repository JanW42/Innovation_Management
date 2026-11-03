# AP01 – Anforderungen und Pilotumfang (freigegeben)

Stand: 31.10.2026 | Status: FREIGEGEBEN

## Ziel

React-Web-App (MVP) für Angehörige nach einem Sterbefall in Deutschland:
Konten verwalten, Kontoauszüge digitalisieren, Verträge erkennen,
Anbieter recherchieren, Kündigungen freigeben und den Fortschritt verfolgen.

## Use Cases (aus den 12 Featurewünschen, je einem Arbeitspaket zugeordnet)

| # | Feature | Arbeitspaket | Akzeptanzkriterium |
|---|---------|--------------|--------------------|
| F1 | Modernes, schlichtes Schwarz-Weiß-Design mit Kreuz und Rebzweig (ohne Trauben) | AP02, AP05 | UI nur Schwarz/Weiß/Neutraltöne; Kreuz + Rebzweig-SVG sichtbar in Header/Footer |
| F2 | Kontostand hochladen | AP06 | Pro Konto Betrag + Bezugsdatum erfassbar, wird auf Konto- und Übersichtsseite angezeigt |
| F3 | Vertragserkennungs-Übersicht, Ein-Klick-“Alle kündigen” + Einzelkündigung | AP08, AP10 | Checkboxes + “Alle kündbaren Verträge auswählen”; jede Kündigung nur nach expliziter Freigabe |
| F4 | Chatbot mit Hilfe und nächsten Schritten (OpenAI + API-Key) | AP11 | Chat antwortet kontextbezogen; API-Key nur serverseitig; Chat kann keine Kündigung freigegeben |
| F5 | Informationen: Was ist im Sterbefall zu tun | AP11 | Checkliste mit Aufgaben, Zuständigkeit, Quellen; Abhaken pro Aufgabe |
| F6 | Untersuchung von Kontodaten/Abbuchungen, Wiederkehrendes automatisch als Vertrag | AP07, AP08 | Wiederkehrende Abbuchungen erzeugen Vertragsvorschläge mit Begründung; manuell bestätig- und ablehnbar |
| F7 | Mehrere Konten, je Konto Auszug hochladen | AP06 | >=2 Konten pro Fall; mehrere Dateien pro Konto; Zuordnung sichtbar |
| F8 | Aufgeräumte, durchdachte Oberfläche | AP02, AP05, AP12 | Konsistente Navigation, Leer-/Lade-/Fehlerzustände, mobile + Desktop Ansicht |
| F9 | Familienmitglieder können Zugriff bekommen | AP04, AP12 | Einladung per Token-Code (MVP: Code wird in der UI angezeigt, keine E-Mail-Versand); Rollen owner/editor/viewer; viewer ändert nichts; Kündigungsfreigabe nur mit Zusatzrecht |
| F10 | Sterbeurkunde: Foto hochladen -> Digitalisierung; oder direkt PDF | AP06, AP07 | JPG/PNG und PDF; extrahierte Felder (Name, Sterbedatum, Ort) zur Bestätigung; Ergebnis wird in Kündigungsvorlagen genutzt |
| F11 | Vertragsübersicht: Abbuchungsbetrag, gekündigt?, Links zu offiziellen Seiten (Websuche via OpenAI) | AP09 | Tabelle mit Betrag, Rhythmus, Status, offiziellem Link (mit Abrufdatum) je Vertrag |
| F12 | Kontaktinformationen des betreuenden Bestatters in eigener Rubrik | AP11 | Rubrik “Bestatter” mit Ansprechpartner, Telefon, E-Mail, Adresse; editierbar |

## Pilotumfang

- Markt: Deutschland (DE-Datums- und Währungsformat, EUR).
- Unterstützte Auszugsformate MVP: PDF (Text-PDF und per Vision), JPG/PNG (Vision),
  CSV (deterministisch, Format s. docs/csv-format.md).
- Pilotanbieter (Erkennung + Recherche + Vorlage): DAK, AOK, TK, Barrierefrei-Testfälle
  werden durch Provider-Profil mit offiziellem Link abgedeckt; Versand im MVP per
  E-Mail-Anbieter-Adapter (dev: Log-Senke) und Brief-PDF; Portale als Aufgabe.
- Kein automatischer E-Mail-Versand produktiv ohne Feature-Flag.

## Fachliche Grenzen

- Wiederkehrende Zahlung = Vertragsvorschlag, nie automatische Kündigung.
- “Versendet” != “gekündigt”; Beendigung erst nach Bestätigung.
- Sterbeurkunde belegt Sterbefall, nicht automatisch Vertretungsbefugnis;
  die App weist auf fehlende Nachweise hin (Aufgabe + Hinweis in Freigabe).
- Kontostand ohne Buchungen reicht nicht zur Vertragserkennung (App erklärt das).
- Inhalte Checkliste/Chat sind Entscheidungshilfe, keine Rechtsberatung.

## Abweichungen von App_architektur.txt (dokumentiert, begründet)

1. npm statt pnpm (pnpm nicht installiert; npm workspaces nicht nötig:
   einzelne Next.js-App, saubere lib/-Module übernehmen die Paketgrenzen).
2. Supabase durch lokale SQLite (sql.js, WASM – ohne Native-Kompilierung) + E-Mail/Passwort-Auth ersetzt:
   MVP läuft vollständig lokal ohne Cloud-Projekt. Schema und Rechte-Modell
   (Rollen, case-scoped Zugriff, zentrale authorizeCaseAction()) entsprechen
   der Architektur; Migration zu Supabase bleibt möglich (Tabelle-für-Tabelle).
3. Separater Worker-Prozess + pg-boss durch in-process-Job-Queue ersetzt
   (lib/jobs.ts): gleiche Job-Lebenszyklen (queued/processing/ready/completed/failed),
   Idempotenz und Wiederanlauf bleiben erhalten.
4. Storage: lokale data/uploads mit Hash-Prüfung statt Supabase Storage
   (privat, kein öffentlicher Zugriff).

## Teststrategie

- node:test für Fachlogik (Vertragserkennung, Kosten, Statusübergänge, Rechte).
- Manuelle End-to-End-Abnahme nach Abschnitt 11 der Architektur.
