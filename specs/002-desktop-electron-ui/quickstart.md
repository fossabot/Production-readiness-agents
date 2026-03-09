# Quickstart: Desktop Electron UI

**Feature Branch**: `002-desktop-electron-ui`

## Prerequisites

- Node.js 20+
- npm 10+
- The `production-readiness-crew` library built (`npm run build` from repo root)

## Setup

```bash
# From repo root
cd desktop
npm install
```

## Development

```bash
# Start Electron app in dev mode (HMR for renderer, hot reload for main)
npm run dev
```

## Build

```bash
# Build for current platform
npm run build

# Package for distribution
npm run package
```

## Project Structure

```
desktop/
├── electron/
│   ├── main.ts              ← Electron entry point
│   ├── ipc/
│   │   ├── channels.ts      ← IPC channel name constants
│   │   ├── handlers.ts      ← ipcMain.handle implementations
│   │   └── contracts.ts     ← Type definitions for IPC messages
│   ├── worker/
│   │   ├── crew-worker.ts   ← Worker Thread entry point
│   │   ├── crew-runtime.ts  ← CrewRuntime adapter interface
│   │   ├── event-bus.ts     ← Event emission from TracingCollector
│   │   └── cancellation.ts  ← AbortController + CANCEL message handling
│   ├── persistence/
│   │   ├── settings-store.ts← electron-store wrapper for Settings
│   │   ├── run-store.ts     ← CRUD for CrewRunRecord files
│   │   ├── report-store.ts  ← Read/write/export report files
│   │   └── trace-store.ts   ← Append-only trace log writer
│   ├── security/
│   │   └── preload.ts       ← contextBridge API exposure
│   └── types/
│       ├── run.ts           ← CrewRunRecord, CrewRunStatus, AgentRunState
│       ├── events.ts        ← CrewWorkerEvent discriminated union
│       ├── errors.ts        ← ErrorCode, IpcError
│       └── settings.ts      ← Settings, RuntimePolicy, UiPreferences
├── src/
│   ├── App.tsx              ← Root component with routing
│   ├── pages/
│   │   ├── ScanPage.tsx     ← Repository selection + Start button
│   │   ├── ProgressPage.tsx ← Live agent progress cards
│   │   ├── ReportPage.tsx   ← Markdown + JSON report viewer
│   │   ├── SettingsPage.tsx ← Tabbed settings (Agents, Models, Tools, Skills, Secrets, Runtime)
│   │   └── HistoryPage.tsx  ← Run history list with filters
│   ├── components/
│   │   ├── AgentCard.tsx    ← Agent status card (name, status, duration, findings count)
│   │   ├── FindingBadge.tsx ← Severity badge (Critical/High/Medium/Low)
│   │   ├── RepoSelector.tsx ← Path input + Browse button (dialog.showOpenDialog)
│   │   └── ModelPicker.tsx  ← Model selection dropdown per agent
│   ├── hooks/
│   │   ├── useCrewRun.ts    ← React hook managing run lifecycle via IPC
│   │   └── useSettings.ts   ← Settings read/write hook
│   ├── state/
│   │   ├── run-store.ts     ← Zustand store for active run state
│   │   └── settings-store.ts← Zustand store for settings
│   └── lib/
│       └── ipc-client.ts    ← Type-safe wrapper around window.electronAPI
├── package.json
├── tsconfig.json
├── vite.config.ts           ← Vite config for renderer
├── electron.vite.config.ts  ← electron-vite unified config
└── electron-builder.yml     ← Build and distribution config
```

## Key Architecture Decisions

1. **Worker Thread isolation**: The crew runs in a `worker_threads` Worker, keeping the main process and UI responsive.
2. **IPC type safety**: All IPC communication uses typed contracts (see `contracts/ipc-contract.md`).
3. **Cancellation**: `AbortController` in main → `CANCEL` message to worker → graceful agent shutdown.
4. **Persistence**: `electron-store` for settings, JSON files for run records, file system for reports.
5. **Security**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict CSP.

## Configuration

On first launch, the app works with defaults. Configure via Settings page:
- **Secrets tab**: Add your API key (e.g., `ANTHROPIC_API_KEY`)
- **Agents tab**: Choose AI model per agent
- **Runtime tab**: Adjust timeouts, concurrency, tracing

## Importing the Crew Library

The desktop app imports the production-readiness-crew library from `../../dist/`:

```typescript
import { createProductionReadinessCrewSubagents } from "../../dist/index.js";
```

This requires the library to be built first (`npm run build` from repo root).
