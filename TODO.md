# TradoDesk Requirements Checklist

## A) Output Structure
- [x] Create root-level TODO.md first
- [x] Output complete folder/file tree
- [x] Output file content in specific order

## B) Monorepo Structure
- [x] `packages/app` (Electron + React)
- [x] `packages/automation` (Playwright)
- [x] `packages/shared` (Types/Utils)

## C) Core Features

### 1) Electron App Shell
- [x] Electron 29+ setup
- [x] Secure defaults (contextIsolation=true, nodeIntegration=false)
- [x] Tray icon with German menu ("Öffnen", "Neu laden", "Beenden")
- [x] Auto-update boilerplate (electron-updater)
- [x] App Config Flags (DEMO_MODE, SECURE_MODE, LOG_LEVEL)

### 2) Embedded Broker Browser
- [x] Embedded BrowserView for Heldentrader
- [x] Session partition handling
- [x] Shortcut Ctrl+Shift+S (Capture -> Base64 -> IPC)
- [x] Secure Screenshot handling (Redaction/No-autosave)

### 3) Dual-Model LLM Agent
- [x] ModelRouter implementation
    - [x] Deep: `gemini-3-pro-preview` + Thinking Config
    - [x] Fast: `gemini-2.5-flash-lite`
- [x] UI Toggle ("Schnell" vs "Analyse")
- [x] Streaming responses
- [x] Function Calling (Schema validated)
    - [x] `get_chart`, `suggest_trade`, `summarise_session`
    - [x] `place_order` (Guarded by DEMO_MODE)
- [x] Vision Pipeline (Screenshot -> Interpretation)
- [x] Safety Guardrails (German warnings, Confirmation modals)

### 4) Token + Cost Tracking
- [x] Track usage metadata from API response
- [x] Store detailed per-call record
- [x] Persist in `userData`
- [x] Usage Dashboard (German UI)
- [x] Configurable Pricing (JSON)

### 5) API Manager
- [x] Provider UI (Gemini, OpenAI, Local, etc.)
- [x] Secure Storage (Keytar mock/AES fallback)
- [x] Test Connection button

### 6) Automation Bridge
- [x] Playwright runner scaffolding
- [x] IPC Bridge (App -> Automation)
- [x] "Dry Run" logs in German

### 7) UI/UX
- [x] Dark Mode (Tailwind)
- [x] Layout (Broker Left, Chat Right, Logs Bottom)
- [x] Top Bar with Lane/Cost indicators

### 8) Documentation + Ops
- [x] README.md (German instructions)
- [x] SECURITY.md (Threat model)
- [x] ARCHITECTURE.md
- [x] Scripts (Lint, Format, Typecheck)

### 9) Maintenance
- [x] `tools/todo-sync.ts` script

## D) Stability & Diagnostics (Black Screen Fix)
- [x] Move index.html to package root for Vite compatibility
- [x] Fix module resolution (alias for @tradodesk/shared)
- [x] Add Global ErrorBoundary
- [x] Add Diagnostics Overlay (Systemstatus)
- [x] Add detailed Electron lifecycle logs
- [x] Fix production path resolution (`dist/index.html`)
- [x] Add raw HTML error trap for boot failures
- [x] Add process/env polyfills for Web Preview
- [x] Fix absolute path issues in script tags

## E) Audit & Fehlermanagement (Refactoring)
- [x] Shared `AppError` and `Result<T>` types
- [x] Shared `Logger` with correlation IDs and sanitization
- [x] Zod Schema validation for IPC
- [x] Enhanced ErrorBoundary with German UI and details
- [x] Service layer refactoring (Result pattern)
- [x] Robust Web Preview fallback (Mock Electron)
