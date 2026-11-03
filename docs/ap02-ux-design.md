# AP02 – UX und Design

Stand: 31.10.2026 | Status: FREIGEGEBEN

## Design-Sprache

Schwarz auf Weiß, viel Weißraum, eine Schriftfamilie (System-Stack / Inter),
feine 1px-Ränder in Neutral-200, Status immer Text + Symbol (nicht nur Farbe).
Töne: #000 (Ink), #FAFAFA (Hintergrund), #FFFFFF (Karten), #E5E5E5 (Ränder),
#525252 (Sekundärtext). Akzent: reines Schwarz für primäre Buttons.

## Icons (SVG, public/)

- cross.svg: schlichtes lateinisches Kreuz, 1px-Stil, dezent (Header/Leerbild).
- vine.svg: Rebzweig ohne Trauben – geschwungener Stamm mit Blättern,
  als dezentes Motiv für Header-Right, Footer und Erfolgs-Leerbilder.

## Navigation (Fix links, mobile oben)

Übersicht · Konten & Dokumente · Verträge · Nächste Schritte ·
Familie · Bestatter · Hilfe (Chat, eigener Button + ?-Symbol)

## Seiten (Wireframe-Auslegungen)

1. /login – zentrierte Karte, Kreuz klein darüber, E-Mail + Passwort,
   darunter “Einladung angenommen”-Tab.
2. /cases – Fallliste (Name Verstorbener, Status, Fortschritt-Balken),
   Button “Neuer Fall”.
3. Fall-Übersicht – Kopfzeile mit Name/Datum; Kacheln: offene Aufgaben,
   geschätzte Monatskosten, Verträge (erkannt/geprüft/versendet),
   Bestatter-Kurzinfo; darunter “Nächste Schritte” (max. 3).
4. Konten & Dokumente – Tabelle Konten (Label, Bank, maskierte IBAN,
   Stand/Betriebsart-Datum, #Dokumente); Detail: Upload-Zone (drag&drop,
   PDF/JPG/PNG/CSV), Dokumentliste mit Status (Wird ausgewertet /
   Prüfung erforderlich / Fertig / Fehler) und Korrektur-Link.
   Kontostand-Eingabe direkt im Konto (Betrag + Datum).
5. Verträge – Tabelle: Anbieter, Betrag, Rhythmus, Monatsumlage, Konto,
   Status, Quellen-Link, Aktionen. Checkbox-Spalte + Leiste:
   “n ausgewählt – Kündigungen vorbereiten” (One-Klick: “Alle kündbaren
   auswählen”). Detailansicht: zugehörige Buchungen, Erkennungsbegründung,
   offizieller Link, Kündigungs-Workflow-Schritte.
6. Kündigungs-Vorschau – ausgewählte Verträge, Empfänger/Kanal,
   Brief-Text (mit Daten aus Sterbeurkunde), benötigte Nachweise,
   Checkbox “Ich bestätige …” + Button “Freigeben” (nur bei Berechtigung).
   Danach: Status je Vertrag (Freigegeben/Versendet/Bestätigung erhalten/…);
   Bestätigung hochladen.
7. Nächste Schritte – Checkliste Sektoren (Bestatter, Behörden, Versicherungen,
   Wohnsituation, Verträge/Nachlass); je Aufgabe: Titel, Beschreibung,
   Quelle, erledigt.
8. Familie – Mitglieder + Rollen, Einladung (E-Mail + Rolle),
   Kündigungsfreigabe-Checkbox, Entfernen.
9. Bestatter – Formular/Karte: Unternehmen, Ansprechpartner, Telefon,
   E-Mail, Adresse, Notizen.
10. Hilfe (Chat) – Panel rechts (mobil vollflächig): Vorschläge
    (“Was ist als Nächstes zu tun?”, “Wie kündige ich X?”),
    Antworten mit Quellen; Footer-Hinweis: keine Rechtsberatung.

## Status-Sprache (Text + Symbol)

- Erkannt (Kreuzhaftern) / Geprüft (Häkchen) / Freigegeben (Unterschrift)
- Versendet (Pfeil) / Bestätigung erhalten (Doppelhaken) / Beendet (Kreis)
- Fehler (Ausrufung) / Prüfung erforderlich (Frage)
