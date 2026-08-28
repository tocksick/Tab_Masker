# Tab Masker

Chrome-Erweiterung (Manifest V3), die Domainnamen und Favicons in Browser-Tabs mit
zufälligen, aber pro Domain konsistenten Namen und Icons maskiert – praktisch für
Screensharing, Präsentationen oder öffentliche Bildschirme.

## Funktionen

- **Automatische Maskierung**: Jede Domain bekommt beim ersten Besuch einen
  zufälligen, aber deterministischen Fantasienamen (z. B. „Stiller Fuchs“) und ein
  passendes Emoji-Icon als Favicon. Beim erneuten Besuch bleibt die Maskierung gleich.
- **Neu würfeln**: Über das Popup lässt sich pro Domain eine neue zufällige
  Name/Icon-Kombination erzeugen.
- **Eigene Namen/Icons**: Name und Emoji lassen sich pro Domain frei festlegen.
- **Domains ausschließen**: Einzelne Domains lassen sich dauerhaft von der
  Maskierung ausnehmen (z. B. interne Tools, die man erkennen möchte).
- **Globaler Schalter**: Maskierung lässt sich mit einem Klick komplett
  aktivieren/deaktivieren.
- **Verwaltungsseite**: Übersicht aller angepassten Domains (deaktiviert,
  umbenannt oder neu gewürfelt) inkl. Löschen/Zurücksetzen.

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
  Popup und Optionsseite.
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

Es werden keine Daten an externe Server gesendet; alles bleibt lokal im Browser
(`chrome.storage.local`).
