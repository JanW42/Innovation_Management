# Stillstand – MVP Nachlass- und Vertragsverwaltung

Ruhige React-Web-App für Angehörige nach einem Sterbefall (Deutschland):
Konten und Kontoauszüge verwalten, Verträge automatisch erkennen,
Anbieter-Seiten recherchieren, Kündigungen freigeben und den Fortschritt
mit Familienmitgliedern teilen. Design: Schwarz/Weiß, Kreuz und Rebzweig.

## Starten

    npm install
    npm run dev          # http://localhost:3000

Produktionslauf:

    npm run build
    npm start

Tests:

    npm test             # Fachlogik (Vertragserkennung)
    node smoke-test.mjs  # End-to-End gegen laufenden Server (npm start)

## Konfiguration (.env)

Die App nutzt per Vorrang das lokale Sprachmodell (llama.cpp) und fällt
sonst auf OpenAI bzw. Demo-Modus zurück:

- `LLM_BASE_URL` – gesetzt (aktuell `http://192.168.188.22:8080/v1`):
  Chat, Bild-/Dokument-Extraktion und Anbieter-Recherche laufen über das
  lokale Qwen-Modell (OpenAI-kompatible API). Reasoning ist per
  `enable_thinking: false` deaktiviert, damit Antworten schnell bleiben.
- `LLM_API_KEY` – beliebig (llama.cpp prüft keinen Key).
- `OPENAI_API_KEY` – optional, nur wenn `LLM_BASE_URL` leer ist:
  dann Chat/Extraktion/Websuche über OpenAI (mit Websuche und PDF-Inputs).
- `lib/settings.ts` – `MODEL_ENDPOINT_LOCAL`: `true` = Hilfe-Chat läuft über das
  lokale llama.cpp-Modell, `false` = über OpenRouter (Standard-Modell
  `openai/gpt-6-luna`, Streaming). Bei `false` wird `OPENROUTER_API_KEY` benütigt.
- `OPENAI_MODE=auto|live|mock` – erzwingt Modus.
- `MAIL_MODE=dev` – Kündigungen werden simuliert (Log-Ausgabe), nicht versendet.

Hinweis: Im lokalen Modus gibt es keine Websuche; die Anbieter-Recherche
nutzt vorab geprüfte offizielle Links (DAK, AOK, TK, BARMER, Telekom,
Vodafone, Netflix, Spotify, Amazon).

## Datenhaltung

Alles lokal unter `data/` (SQLite-Datei `data/app.db`, Uploads in
`data/uploads/`). Das Verzeichnis löschen setzt die App zurück.

## Funktionsumfang (MVP)

- Anmeldung (E-Mail/Passwort), Fälle, Familien-Einladungen per Code
  mit Rollen (Verantwortlich / Bearbeitet / Nur ansehen) und
  separatem Kündigungsfreigabe-Recht.
- Konten: Label, Bank, maskierte IBAN, Kontostand mit Stichtag.
- Dokumenten-Upload (PDF, JPG, PNG, CSV) pro Konto oder als
  Sterbeurkunde; automatische Auswertung (CSV deterministisch,
  Text-PDF per Parser, Bild/PDF ohne Text per OpenAI-Vision).
- Vertragserkennung aus wiederkehrenden Abbuchungen mit Begründung,
  Sicherheit und zugehörigen Buchungen; manuelle Verträge möglich.
- Vertragsübersicht mit Monatskosten, Status, offizieller Anbieterseite
  (Websuche via OpenAI, sonst vorab geprüfte Links) und Abrufdatum.
- Kündigung: Einzel- und Sammelauswahl, Vorschau mit Brieftext,
  ausdrückliche Freigabe, Statusverlauf (Freigegeben → Versendet →
  Bestätigung → Beendet). Portal-Anbieter (z. B. Netflix) erzeugen
  eine Aufgabe mit offiziellem Link statt eines Versands.
- Checkliste „Nächste Schritte im Sterbefall“ mit Quellen.
- Hilfe-Chat (lokal oder OpenRouter, Streaming) – gibt keine
  Kündigungen frei.
- Bestatter-Rubrik mit Kontaktdaten.

## Architektur

Details in `App_architektur.txt`; dokumentierte Abweichungen und
Entscheidungen in `docs/ap01-anforderungen.md`. Kernmodule:

- `lib/contracts.ts` – Vertragserkennung (rein, getestet)
- `lib/extract.ts` – CSV-/PDF-/Vision-Extraktion
- `lib/jobs.ts` – Hintergrund-Jobs (Dokumente, Recherche, Versand)
- `lib/cancellation.ts` – Vorschau, Brief, Portal-Logik
- `lib/permissions.ts` – Rollen und Fall-Zugriff (zentrale Prüfung)

## Grenzen (bewusst)

- Keine Bankanbindung; Auszüge werden hochgeladen.
- Wiederkehrende Zahlung = Vorschlag, nie automatische Kündigung.
- „Versendet“ ≠ „gekündigt“; Beendigung nur nach Bestätigung.
- Demo-Versand (MAIL_MODE=dev): Briefe werden nur protokolliert.
- Keine Rechtsberatung; Inhalte sind Entscheidungshilfe.