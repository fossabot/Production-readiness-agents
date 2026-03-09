# Implementation Plan: Desktop Electron UI

**Branch**: `002-desktop-electron-ui` | **Date**: 2026-03-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-desktop-electron-ui/spec.md`

## Summary

Build an Electron + React desktop application that provides a graphical user interface for the Production Readiness Crew system. Users select a local repository, configure AI models and tools per agent, then launch a production readiness audit that runs in a Worker Thread. The UI shows live agent progress, displays the final report (Markdown + JSON), and maintains a history of past runs with export capabilities.

Technical approach: electron-vite for build tooling, worker_threads for background execution, electron-trpc for type-safe IPC, Zustand for state management, electron-store for persistence, and electron-builder for packaging.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022 target, NodeNext modules, strict + exactOptionalPropertyTypes)
**Primary Dependencies**: Electron 34+, React 19, Vite 6, electron-vite, electron-trpc, Zustand, electron-store, electron-builder
**Storage**: electron-store (JSON files in userData/), file system for reports and traces
**Testing**: Vitest (unit + integration), Playwright (E2E for Electron)
**Target Platform**: Desktop — Windows 10+, macOS 12+, Linux (AppImage/DEB/RPM)
**Project Type**: desktop-app (Electron)
**Performance Goals**: 30fps UI during audit, <1s event reflection latency, <30s cancellation, <2s history browsing (100 records)
**Constraints**: Worker Thread for crew execution, IPC type-safe, no UI freeze, contextIsolation + sandbox mandatory
**Scale/Scope**: 9 agents, 5 pages, ~100 historical runs, single concurrent run

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| No agent topology change | PASS | Desktop UI wraps existing crew; no agents added/removed |
| Explicit agent contracts (Principle II) | PASS | Existing SubAgent definitions unchanged; UI reads them |
| Context isolation (Principle III) | PASS | Worker Thread provides process-level isolation |
| Least privilege tools (Principle III) | PASS | UI layer has no agent tools; crew library handles tools |
| Tracing mandatory (§8) | PASS | TracingCollector events forwarded via IPC to UI |
| No implicit inheritance (Principle II) | PASS | UI does not define new agents |
| Constitution governance (§Governance) | PASS | No topology/naming/policy changes; UI is a consumer |

**Post-Phase 1 re-check**: PASS — data model and contracts align with existing library types (see data-model.md §8 Type Import Map).

## Project Structure

### Documentation (this feature)

```text
specs/002-desktop-electron-ui/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: Entity definitions and validation
├── quickstart.md        # Phase 1: Setup and development guide
├── contracts/
│   └── ipc-contract.md  # Phase 1: IPC channel definitions
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
desktop/
├── electron/
│   ├── main.ts                    ← Electron entry point
│   ├── ipc/
│   │   ├── channels.ts            ← IPC channel name constants
│   │   ├── handlers.ts            ← ipcMain.handle implementations
│   │   └── contracts.ts           ← Type definitions for IPC messages
│   ├── worker/
│   │   ├── crew-worker.ts         ← Worker Thread entry point
│   │   ├── crew-runtime.ts        ← CrewRuntime adapter interface
│   │   ├── event-bus.ts           ← Event emission from TracingCollector
│   │   └── cancellation.ts        ← AbortController + CANCEL message handling
│   ├── persistence/
│   │   ├── settings-store.ts      ← electron-store wrapper for Settings
│   │   ├── run-store.ts           ← CRUD for CrewRunRecord files
│   │   ├── report-store.ts        ← Read/write/export report files
│   │   └── trace-store.ts         ← Append-only trace log writer
│   ├── security/
│   │   └── preload.ts             ← contextBridge API exposure
│   └── types/
│       ├── run.ts                 ← CrewRunRecord, CrewRunStatus, AgentRunState
│       ├── events.ts              ← CrewWorkerEvent discriminated union
│       ├── errors.ts              ← ErrorCode, IpcError
│       └── settings.ts            ← Settings, RuntimePolicy, UiPreferences
├── src/
│   ├── App.tsx                    ← Root component with routing
│   ├── pages/
│   │   ├── ScanPage.tsx           ← Repository selection + Start button
│   │   ├── ProgressPage.tsx       ← Live agent progress cards
│   │   ├── ReportPage.tsx         ← Markdown + JSON report viewer
│   │   ├── SettingsPage.tsx       ← Tabbed settings (6 tabs)
│   │   └── HistoryPage.tsx        ← Run history list with filters
│   ├── components/
│   │   ├── AgentCard.tsx          ← Agent status card
│   │   ├── FindingBadge.tsx       ← Severity badge
│   │   ├── RepoSelector.tsx       ← Path input + Browse button
│   │   └── ModelPicker.tsx        ← Model selection dropdown
│   ├── hooks/
│   │   ├── useCrewRun.ts          ← Run lifecycle management hook
│   │   └── useSettings.ts         ← Settings read/write hook
│   ├── state/
│   │   ├── run-store.ts           ← Zustand store for active run
│   │   └── settings-store.ts      ← Zustand store for settings
│   └── lib/
│       └── ipc-client.ts          ← Type-safe wrapper around window.electronAPI
├── package.json
├── tsconfig.json
├── electron.vite.config.ts        ← electron-vite unified config
└── electron-builder.yml           ← Build and distribution config
```

**Structure Decision**: Desktop app in `desktop/` subdirectory of the existing repo. Imports the crew library from `../../dist/index.js`. This avoids publishing the library to npm while maintaining clear separation between the library and the UI.

## Complexity Tracking

> No constitution violations detected. No complexity justifications needed.
