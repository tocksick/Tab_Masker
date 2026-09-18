# Tab Masker

Chrome-Erweiterung (Manifest V3), die Domainnamen und Favicons in Browser-Tabs mit
zufälligen, aber pro Domain konsistenten Namen und Icons maskiert – praktisch für
Screensharing, Präsentationen oder öffentliche Bildschirme.

## Funktionen

- **Allowlist-Prinzip**: Standardmäßig wird **keine** Domain maskiert. Nur
  Domains, die du explizit im Popup oder in den Einstellungen hinzufügst,
  bekommen einen Tarnnamen und ein Tarn-Icon.
- **Aktuelle Seite maskieren**: Klick auf das Erweiterungssymbol öffnet das
  Popup mit einem Schalter „Diese Domain maskieren“ – damit landet die aktuell
  geöffnete Domain direkt auf der Maskierungsliste.
- **Automatischer Tarnname**: Beim Hinzufügen bekommt eine Domain einen
  zufälligen, aber deterministischen Tarnnamen einer echten, bekannten Seite
  (z. B. „Outlook“, „Google Docs“, „LinkedIn“). Für einige davon wird zusätzlich
  eine an das echte Logo angelehnte, aber bewusst umgefärbte Icon-Form
  gezeichnet – für alle anderen ein passendes Emoji. Beim erneuten Besuch
  bleibt die Maskierung gleich.
- **Neu würfeln**: Über das Popup lässt sich pro Domain eine neue zufällige
  Name/Icon-Kombination erzeugen.
- **Vorlagen bekannter Seiten**: Alternativ lässt sich gezielt eine Vorlage
  wählen, die wie eine bekannte Seite aussieht (z. B. „Google“, „google.de“,
  „heise.de“, „Wikipedia“, „Online-Banking“ …).
- **Eigene Namen/Icons**: Name und Emoji lassen sich pro Domain auch frei per
  Texteingabe festlegen.
- **Pausieren/Entfernen**: Domains lassen sich vorübergehend pausieren (Maske
  bleibt gespeichert) oder komplett von der Liste entfernen.
- **Globaler Schalter**: Maskierung lässt sich mit einem Klick komplett
  aktivieren/deaktivieren, ohne die Liste zu verlieren.
- **Verwaltungsseite**: Übersicht aller Domains auf der Maskierungsliste inkl.
  Status, Pausieren/Aktivieren und Entfernen.
- **Update-Benachrichtigung**: Prüft in regelmäßigen Abständen (und beim
  Browserstart), ob es auf GitHub neue Commits gibt. Falls ja, gibt es eine
  Desktop-Benachrichtigung, einen Hinweis im Popup und ein Änderungsprotokoll
  (mit Link zum jeweiligen Commit) auf der Einstellungsseite.

## Installation (Entwicklermodus)

1. `chrome://extensions` (oder `edge://extensions`) öffnen.
2. Oben rechts **Entwicklermodus** aktivieren.
3. **Entpackte Erweiterung laden** klicken.
4. Diesen Projektordner (`Tab_Masker`) auswählen.
5. Fertig – das Icon erscheint in der Symbolleiste.

## Nutzung

- Klick auf das Erweiterungssymbol öffnet das Popup mit Vorschau, Toggle für die
  aktuelle Domain, „Neu würfeln“, „Zurücksetzen“ sowie einem Bereich zum Festlegen
  eines eigenen Namens/Icons.
- „Alle angepassten Domains verwalten“ öffnet die Einstellungsseite mit einer
  Übersicht und der Möglichkeit, Domains gezielt von der Maskierung auszuschließen.
- Änderungen laden den betroffenen Tab automatisch neu, damit Titel und Favicon
  aktualisiert werden.

## Funktionsweise (technisch)

- `common/mask.js`: Deterministische Namens-/Icon-/Farbgenerierung per
  FNV-1a-Hash über den Hostnamen (gleiche Domain → gleiche Maske, bis manuell
  geändert).
- `background.js`: Service Worker, verwaltet Einstellungen in
  `chrome.storage.local` und beantwortet Nachrichten von Content-Script,
  Popup und Optionsseite. Prüft zusätzlich per `chrome.alarms` alle 6 Stunden
  (und beim Browserstart) über die öffentliche GitHub-API, ob es neue Commits
  im Repository gibt, und zeigt bei Bedarf eine Benachrichtigung samt
  Änderungsprotokoll an.
- `content.js`: Läuft auf jeder Seite (`document_start`), setzt
  `document.title` sowie ein per `<canvas>` generiertes Favicon
  (Data-URL) und überwacht per `MutationObserver`, ob die Seite selbst Titel
  oder Favicon ändert, um die Maskierung dauerhaft aufrechtzuerhalten.
- `popup/`, `options/`: UI zur Steuerung.

## Berechtigungen

- `storage`: Speichern der Einstellungen pro Domain.
- `tabs`: Erkennen der aktuellen Tab-Domain und Neuladen betroffener Tabs nach
  Änderungen.
- `host_permissions: <all_urls>`: Notwendig, damit das Content-Script auf allen
  Seiten Titel und Favicon anpassen kann.
- `alarms`: Für den periodischen Update-Check im Hintergrund.
- `notifications`: Für die Desktop-Benachrichtigung bei neuen Commits.

**Hinweis zur Privatsphäre**: Bis auf eine Ausnahme werden keine Daten an
externe Server gesendet; alles bleibt lokal im Browser (`chrome.storage.local`).
Die Ausnahme ist der Update-Check: dafür ruft die Erweiterung periodisch die
öffentliche GitHub-API (`api.github.com`) auf, um zu prüfen, ob es neue Commits
im Tab-Masker-Repository gibt (keine Übermittlung eigener Daten, nur ein
lesender Abruf). Wer das nicht möchte, kann die Berechtigungen `alarms` und
`notifications` in `chrome://extensions` entfernen bzw. die Erweiterung
entsprechend anpassen.
