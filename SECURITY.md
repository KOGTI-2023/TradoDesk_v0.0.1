# Sicherheitsarchitektur

## Threat Model
TradoDesk verarbeitet sensible Finanzdaten und führt Aktionen auf Trading-Plattformen aus. Die höchste Priorität hat der Schutz vor:
1. Unbeabsichtigten Orders (Fat Finger / KI-Halluzination).
2. Abfluss von Screenshots oder Session-Cookies.
3. Injection von bösartigem Code in den Render-Prozess.

## Maßnahmen

### Electron Security
- `contextIsolation: true`: Render-Prozess hat keinen direkten Node.js Zugriff.
- `nodeIntegration: false`: Verhindert `require()` im UI-Code.
- `sandbox: true`: Standard Electron Sandbox.
- **BrowserView Isolation**: Der Broker-Tab läuft in einer getrennten Session-Partition (`persist:broker_session`), Cookies werden nicht mit dem Haupt-Agenten geteilt.

### AI Guardrails
- **Human-in-the-loop**: Die Funktion `place_order` erfordert IMMER eine explizite Bestätigung im UI.
- **Demo Mode**: Wenn `DEMO_MODE=true` (Default), werden 'BUY'/'SELL' Aktionen im Automation-Layer blockiert.
- **Redaction**: Screenshots werden nur flüchtig im Speicher gehalten (Base64) und nicht auf Disk geschrieben, es sei denn, der User exportiert sie explizit.

### Datenspeicherung
- API Keys liegen nicht im Klartext auf der Festplatte. Nutzung von OS Keyring oder AES-256 Encrypted File mit laufzeit-generiertem Salt.

## Fehlermanagement & Diagnose

### Robuste Fehlerbehandlung (Retry-Logic)
Das System fängt Fehler auf globaler und Service-Ebene ab. Wiederholbare Fehler (z.B. 503 Service Unavailable, 429 Rate Limits, Netzwerk-Timeouts) werden automatisch mit **exponentiellem Backoff** (1s, 2s, 4s) erneut versucht. Dies stellt sicher, dass temporäre Verbindungsprobleme nicht zum Abbruch der User-Session führen.

### Korrelation-ID
Jede Transaktion (User-Input, API-Call, System-Fehler) wird mit einer eindeutigen UUID (`correlation_id`) versehen. Diese ID wird durch alle Schichten durchgereicht:
- **Renderer**: Erstellung der ID beim User-Event.
- **Main Process**: Logging mit ID.
- **Automation**: Zuordnung von Browser-Aktionen.
Dies ermöglicht eine präzise Nachverfolgung von Fehlern über Prozessgrenzen hinweg, ohne dass personenbezogene Daten oder sensible Payload-Inhalte geloggt werden müssen.

### Logging & Sanitization
Ein zentraler Logger sammelt Events aus allen Prozessen.
- **Sanitization**: Bevor ein Log geschrieben wird, werden sensible Keys (`api_key`, `token`, `password`) und große Payloads (Base64 Images > 200 chars) automatisch entfernt oder maskiert.
- **Speicherorte**:
  - `console`: Für Entwicklung (DevTools).
  - `userData/logs/app.log`: Rotierendes Logfile für Post-Mortem-Analysen.
- **Level**:
  - `FATAL`: App unbenutzbar (Crash).
  - `ERROR`: Aktion fehlgeschlagen (z.B. API Error nach Retries).
  - `WARN`: Erwartete Abweichung (z.B. Retry aktiv).
  - `INFO`: Normaler Betrieb (Audit Trail).
