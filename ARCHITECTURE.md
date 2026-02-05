# Architektur Übersicht

TradoDesk ist ein Monorepo basierend auf NPM Workspaces.

## Module

### 1. @tradodesk/app (Core)
Der Haupt-Client.
- **Electron Main**: Verwaltet Fenster, IPC, Sicherheit, Persistenz (Logs/Config) und native APIs.
- **Electron Renderer (React)**: Das UI.
    - `GeminiService`: Abstrahiert die Google GenAI API. Implementiert das "Dual-Lane" Konzept und **Retry-Logic** für robuste API-Calls.
    - `Store (Zustand)`: Hält globalen State wie Config und Usage-Stats.
    - `LogService`: Sammelt UI-Logs und sendet sie via IPC an den Main-Process.

### 2. @tradodesk/automation
Ein isolierter Runner für Browser-Automatisierung.
- Nutzt **Playwright**, um Interaktionen im Broker-Webinterface durchzuführen, die keine API haben.
- Wird vom Hauptprozess via IPC oder ChildProcess angesteuert.

### 3. @tradodesk/shared
- Zod Schemas für Validierung (IPC Payloads).
- TypeScript Interfaces für Typ-Sicherheit über Prozessgrenzen hinweg.
- Shared Utilities (Error Mapping, Logger Class).

## Datenfluss & IPC

Der Renderer kommuniziert ausschließlich über eine strikte `contextBridge` API mit dem Main-Process. Direkter IPC-Zugriff ist blockiert.

### Error Flow (Result<T> Pattern)
Das System nutzt das `Result<T>` Pattern, um Exceptions zu vermeiden und Fehler explizit zu behandeln.

```mermaid
graph TD
    UI[User Action] --> Service[GeminiService / AutomationService]
    Service --> Try{API Call}
    Try -- Success --> OK[Result.ok]
    Try -- Failure --> Check[Is Retryable?]
    Check -- Yes --> Backoff[Exponential Backoff Wait] --> Try
    Check -- No / Max Retries --> Fail[Result.fail]
    
    OK --> UI_Update[Update UI State]
    Fail --> ErrorMap[toAppError Mapping]
    ErrorMap --> Logger[Central Logger (Sanitized)]
    ErrorMap --> UI_Error[Show User Friendly Error]
```

### Request Flow
1. User tippt im Chat -> React -> `GeminiService`
2. `GeminiService` streamt Antwort -> React State Update
3. User drückt Shortcut -> Electron Main captured BrokerView -> Sendet Base64 an React (`onScreenshot`)
4. React sendet Bild an Gemini Vision -> Gemini antwortet mit JSON -> React zeigt Trade-Vorschlag

## API-Allowlist (Preload)
Die `window.electron` API ist auf folgende Methoden beschränkt:
- `getBootInfo()`: Lädt initiale Config und Env.
- `logEvent(entry)`: Sendet Log-Einträge (validiert).
- `requestAction(action)`: Generischer Handler für definierte Aktionen (`getConfig`, `saveConfig`, `runAutomation`...).
- `onAppError(cb)`: Listener für globale Fehler aus dem Main-Process.
- `onScreenshot(cb)`: Listener für Broker-Screenshots.
