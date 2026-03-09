# Technical Research: Electron + React Desktop App
# Production Readiness Crew — Desktop UI

**Date:** 2026-03-08
**Branch:** 002-desktop-electron-ui
**Scope:** Architecture decisions for Electron + React + Vite desktop application

---

## 1. Electron + Vite + React Setup

### Decision

Use **electron-vite** (the framework/CLI) with the official `electron-vite-react` template as the project scaffold.

### Rationale

electron-vite is the most mature solution for Electron + Vite + TypeScript as of 2026. It provides:
- Native support for `worker_threads` via `?nodeWorker` import suffix
- First-class TypeScript strict mode support, including `exactOptionalPropertyTypes`
- HMR for renderer and hot reload for main process/preload during development
- V8 bytecode compilation for source code protection in production
- Isolated build mode supports Electron's sandbox renderer architecture

### Alternatives Considered

| Option | Verdict |
|---|---|
| `vite-plugin-electron` (raw plugin) | Lower-level, requires manual config split. Unnecessary complexity. |
| Electron Forge + Vite plugin | Good templates but less control over bundling internals. |
| Manual Vite + Electron setup | Maximum control but requires maintaining three separate Vite configs. Not justified. |

---

## 2. Worker Threads in Electron

### Decision

Use Node.js `worker_threads` in the Electron main process via `?nodeWorker` import suffix. Pass typed message envelopes over `postMessage`. Implement cancellation via `AbortController` + `CANCEL` message protocol.

### Rationale

- `worker_threads` is fully available in Electron main process
- electron-vite handles worker file building automatically via `?nodeWorker` imports
- Type-safe messaging via discriminated union types in shared types file
- `AbortSignal` cannot be transferred across worker boundaries; use a two-part pattern:
  1. Main process listens for `abort` event, sends `{ type: 'CANCEL' }` message
  2. Worker maintains local `isCancelled` flag, checks in loops, exits cleanly
- `worker.terminate()` available as fallback for immediate termination

### Alternatives Considered

| Option | Verdict |
|---|---|
| `utilityProcess` (Electron-specific) | Better isolation but heavier overhead. Not needed for audit tasks. |
| `child_process.fork` | Full OS process. Overkill for in-process audit pipelines. |
| `threads.js` library | Adds abstraction layer; for 7-9 agents the complexity isn't justified. |
| Web Workers in renderer | Wrong process. Cannot use Node APIs. |

---

## 3. IPC Type Safety

### Decision

Use **`electron-trpc`** for command/query IPC, combined with typed `ipcRenderer.on` wrappers for streaming broadcast channels.

### Rationale

- Full tRPC router type inference (input, output, errors) with zero manual type duplication
- Uses `contextBridge` + `contextIsolation: true` by default
- Supports `query` (request/response) and `subscription` (streaming via observable)
- Subscription mechanism maps naturally to the 5 progress broadcast channels
- Performance overhead negligible for 7 async lifecycle commands

### Alternatives Considered

| Option | Verdict |
|---|---|
| Manual `contextBridge` typing | Becomes brittle as channel count grows. Not suitable for 7+5 channels. |
| `electron-typescript-ipc` | Lighter but less ecosystem and documentation. |
| Raw `ipcMain.handle` + `ipcRenderer.invoke` | No type safety without extra boilerplate. Not appropriate for 12 channels. |

---

## 4. Electron State Management

### Decision

Use **`electron-store`** for persistent configuration and **Zustand** for synchronized runtime state between main process and renderer.

### Rationale

**Persistent storage — `electron-store`:**
- Stores JSON in `app.getPath('userData')`
- Synchronous read on startup; async write available
- Typed via generics, schema validation via Ajv

**Runtime state — Zustand:**
- Lightweight, TypeScript-first API
- Main process holds source of truth store
- Renderer receives synchronized copies via IPC
- UI-only state (tabs, panels) stays in local Zustand store in renderer

**Separation of concerns:**

| State type | Tool |
|---|---|
| User settings / preferences | `electron-store` (persisted JSON) |
| Audit runtime state (progress, findings) | Zustand (main-process, synced to renderer) |
| UI-only state (tabs, panels) | Zustand in renderer (local) |

### Alternatives Considered

| Option | Verdict |
|---|---|
| Redux | Heavy; requires action creators, reducers, middleware. Overkill. |
| Jotai | No built-in Electron main/renderer sync. |
| Custom JSON store | Full control, high maintenance burden. Not recommended. |

---

## 5. Electron Security Best Practices

### Decision

Apply full secure baseline as mandatory, non-negotiable configuration.

### Rationale

**Required BrowserWindow configuration:**
- `contextIsolation: true` — isolates preload from renderer
- `nodeIntegration: false` — no Node APIs in renderer
- `sandbox: true` — Chromium OS-level sandbox
- `webSecurity: true` — do not disable
- `allowRunningInsecureContent: false`

**CSP for local app:**
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; connect-src 'none'; font-src 'self'; object-src 'none'; base-uri 'self'
```

**IPC security:**
- All handlers validate input at runtime (Zod schemas via tRPC)
- Never pass raw file system paths from renderer without validation
- Block all navigation and new windows

**contextBridge pattern:**
- Expose one function per IPC channel — never expose `ipcRenderer` itself

### Alternatives Considered

| Option | Verdict |
|---|---|
| `nodeIntegration: true` | Never acceptable. Any XSS becomes RCE. |
| `contextIsolation: false` | Deprecated posture. Breaks modern IPC libraries. |
| `@electron/remote` | Legacy API; security liability. Do not use. |

---

## 6. Electron Builder / Packaging

### Decision

Use **electron-builder** for packaging and distribution, with **`electron-updater`** for auto-updates published to GitHub Releases.

### Rationale

- **Windows:** NSIS installer
- **macOS:** DMG + code signing + notarization
- **Linux:** AppImage, DEB, RPM
- `electron-updater` supports Linux auto-update, staged rollouts, download progress events
- Publish targets include GitHub Releases (zero infrastructure for open source)
- Fine-grained control over `files`, `extraFiles`, `asarUnpack`

**Important:** Worker thread script files referenced at runtime must be `asarUnpack`-ed.

### Alternatives Considered

| Option | Verdict |
|---|---|
| Electron Forge | Easier start but less advanced customization for complex auto-update scenarios. |
| `electron-packager` (raw) | No auto-update, no installer generation. |

---

## Confidence Assessment

**High confidence:** electron-vite, security baseline, electron-builder, AbortController pattern.

**Medium confidence:** Zustand main↔renderer sync under high-frequency agent events (may need batching/throttling). electron-trpc at the boundary where overhead is marginal.

**Prototype before committing:**
1. electron-vite scaffold with `?nodeWorker` in strict mode
2. electron-trpc with one query + one subscription
3. Zustand sync under rapid state updates
