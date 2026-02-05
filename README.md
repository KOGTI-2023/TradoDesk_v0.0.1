# TradoDesk

Eine sichere Desktop-Trading-Umgebung ("Cockpit") mit integriertem KI-Agenten, Broker-Browser und Automatisierung.

## Setup

```bash
# Abhängigkeiten installieren
npm install

# Entwicklung starten (Electron + React Hot Reload)
npm start

# TODOs synchronisieren
npm run todo:sync
```

## Umgebungsvariablen

Erstelle eine `.env` Datei im Root:
```
API_KEY=dein_google_gemini_api_key
```

## Troubleshooting & Logs

### App startet nicht (Black Screen)?
1. Prüfe die Konsole in den DevTools (Ctrl+Shift+I).
2. Prüfe das `boot-error-trap` Overlay (roter Screen).

### Log-Dateien
Logs werden an zwei Orten gespeichert:
1. **Browser Console**: Filterbar nach Level.
2. **File System**:
   - Windows: `%APPDATA%/tradodesk/logs/main.log`
   - macOS: `~/Library/Application Support/tradodesk/logs/main.log`
   - Linux: `~/.config/tradodesk/logs/main.log`

### Reproduktion von Fehlern
Wenn ein Fehler auftritt:
1. Notiere die **Correlation-ID** aus dem Fehler-Screen oder Log.
2. Exportiere die Logs (falls möglich) oder kopiere den relevanten Abschnitt aus der Log-Datei.
3. Erstelle ein Issue mit ID, Zeitstempel und Beschreibung.

## Sicherheit

- **Demo Mode**: Standardmäßig aktiv. Verhindert echte Order-Ausführungen.
- **Secure Mode**: Isoliert den Broker-Browser in einer eigenen Partition.
- **Secrets**: API Keys werden im OS-Keyring (oder verschlüsseltem Fallback) gespeichert.

## Architektur

- **Packages/App**: Electron Hauptprozess und React UI.
- **Packages/Automation**: Playwright Scripte für Broker-Interaktion.
- **Packages/Shared**: Gemeinsame Typen.

## Credits

Gebaut mit Electron, React, Tailwind, Google GenAI.
