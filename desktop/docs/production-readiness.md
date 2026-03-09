# Production Readiness Operator Runbook

**Document version**: 1.0
**Applies to**: Production Readiness Desktop v0.1.x
**Target**: An operator can complete setup and make their first readiness decision within 15 minutes.

---

## 1. Prerequisites

### Runtime requirements

| Component | Minimum version | Notes |
|-----------|----------------|-------|
| Node.js | 20 LTS | Required for build scripts and the crew library |
| npm | 10+ | Bundled with Node.js 20 |
| Git | 2.40+ | Required to clone and inspect target repositories |
| Operating system | Windows 11, macOS 13, or Ubuntu 22.04 | Windows is the primary supported platform |

Verify your environment before proceeding:

```bash
node --version   # must print v20.x.x or higher
npm --version    # must print 10.x.x or higher
git --version    # must print 2.40 or higher
```

### Repository access

You must have read access to any repository you intend to audit. The application operates locally — no repository data leaves your machine.

### Provider credentials

At least one AI provider API key is required before a scan can run. Supported providers are configured through the Settings page inside the application. Keys are stored in the operating system keychain (Windows Credential Manager, macOS Keychain, or the system secret service on Linux) and never written to disk in plaintext.

---

## 2. Quick Start

### Step 1 — Clone and install the root library

```bash
git clone <repo-url> production-readiness-agent
cd production-readiness-agent
npm install
npm run build
```

This compiles the core crew library that the desktop application depends on.

### Step 2 — Install desktop dependencies

```bash
cd desktop
npm install
```

### Step 3 — Build the desktop application (development mode)

```bash
npm run build
```

This runs `electron-vite build` and stages the runtime assets required by the worker process.

### Step 4 — Run in development mode

```bash
npm run dev
```

The application opens automatically. Use development mode to verify configuration before running scans.

### Step 5 — Build a packaged release (optional)

To produce a distributable installer for the current platform:

```bash
npm run package
```

Output files are written to `desktop/release/`. The `prepackage` step automatically stages the compiled crew library into the packaged output tree so the worker process can locate it at runtime.

---

## 3. Configuration

### Settings file location

The application writes its settings file to the Electron `userData` directory:

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\production-readiness-desktop\settings.json` |
| macOS | `~/Library/Application Support/production-readiness-desktop/settings.json` |
| Linux | `~/.config/production-readiness-desktop/settings.json` |

Do not edit `settings.json` directly for credential fields. API keys are stored in the OS keychain; the settings file holds only non-sensitive preferences such as the default repository path and UI theme.

### Credential setup via keychain

1. Open the application.
2. Navigate to **Settings** (gear icon, top-right).
3. Locate the **Provider credentials** section.
4. Enter your API key for the provider you want to use (for example, Anthropic or OpenAI).
5. Click **Save**. The key is written to the OS keychain immediately and never stored in the settings file.

To verify a key was saved: close and reopen the application. The provider row in Settings shows a masked placeholder when a credential is present.

To remove a key: clear the field in Settings and click **Save**.

### Agent configuration

The application runs a fixed crew of 9 subagents. The crew topology is:

- **Supervisor** — plans and delegates; never executes directly
- **Structural Scout** — runs first; discovers repository layout and execution context
- **5 Parallel Auditors** — code/performance, security/resilience, testing, infrastructure, docs/compliance
- **Runtime Verifier** — the only agent permitted to execute shell commands in the repository
- **Report Synthesizer** — runs last; produces the final Markdown and JSON report

Agent configuration is not exposed in the UI. All agents are always active in a scan.

### Model policy

Each agent is assigned a model through the model policy. The policy is resolved at scan start and a snapshot is saved with every run record. To view or override the policy:

1. Open **Settings**.
2. Scroll to **Model policy**.
3. Select a preset or configure individual agent model assignments.
4. Changes take effect on the next scan.

Policy snapshots are stored in `userData/model-policies/` and are attached to every run for traceability.

---

## 4. Running a Production Readiness Scan

### Before you start

- Confirm that at least one provider credential is configured (Settings > Provider credentials).
- Confirm that the target repository is cloned locally and the path is accessible.
- Confirm that no other scan is active — the application allows only one concurrent run. A second start request while a run is active is rejected with a `RUN_ALREADY_ACTIVE` error.

### Step-by-step procedure

**Step 1 — Open the Scan page**

Click **New Scan** in the sidebar or on the home screen.

**Step 2 — Select the repository**

Click **Browse** and navigate to the root directory of the repository you want to audit. The path field accepts an absolute local path. The application validates that the path exists before allowing the scan to start.

**Step 3 — Review the model policy**

The current model policy is shown below the repository selector. If you need a different policy, navigate to Settings first and return.

**Step 4 — Start the scan**

Click **Start Scan**. The application transitions to the Progress page.

**Step 5 — Monitor progress**

The Progress page shows:
- Overall run status (starting, running, completed, failed, cancelled)
- A card for each of the 9 agents with its individual status and timing
- A live findings counter by severity
- Any runtime errors surfaced as human-readable messages

**Step 6 — Review the report**

When the run reaches `completed` or `failed`, the application navigates to the Report page automatically. From there you can:
- Read the structured findings by category and severity
- Export the report as Markdown or JSON
- View the raw execution trace

A failed run still produces a partial report and an error summary. The failure cause is visible on the Report page without requiring access to raw logs.

**Step 7 — Access historical runs**

All completed, failed, and cancelled runs are listed in **History**. Reports and traces remain accessible after the application restarts, up to the retention limits described in Section 8.

---

## 5. Understanding Results

### Assessment levels

Every completed report carries one of three top-level assessment levels:

| Level | Meaning |
|-------|---------|
| `ready` | No blocking findings. The repository meets all criteria checked by the crew. |
| `ready_with_conditions` | One or more high or medium findings are present, but none are critical or blocking. The release can proceed with documented mitigations. |
| `not_ready` | One or more critical or blocking findings are present. The release must not proceed until these are resolved. |

### Severity levels

Findings are classified by four severity levels:

| Severity | Interpretation |
|----------|---------------|
| Critical | Must be resolved before any release. Represents a production-blocking risk. |
| High | Should be resolved before release. Represents a significant risk that may be accepted with formal justification. |
| Medium | Should be reviewed. May be deferred to a follow-on release with documented rationale. |
| Low | Informational. No release-blocking implication. |

### Reading findings

Each finding contains:

- **Title** — a short description of the issue
- **Category** — the audit domain (e.g., security, resilience, testing, infrastructure)
- **Severity** — as above
- **Evidence** — the specific file paths, code excerpts, or configuration values that support the finding
- **Recommendation** — the corrective action the crew recommends

Findings are grouped by category in the report. The executive summary at the top of each report lists all critical and high findings to enable rapid triage.

### Partial results on failure

If the scan fails mid-execution (for example, due to a provider outage), agents that completed successfully still have their findings included in the report. The report header indicates which agents completed and which failed. This partial result is preserved in History and can be used for triage even if a full re-scan is needed.

---

## 6. Release Gate

The release gate is an automated command-line workflow that validates whether a desktop build is ready to distribute. It is the authoritative pre-release check and must pass before sign-off can be granted.

### Running the gate

From the `desktop/` directory:

```bash
npm run release:gate -- --platform current --output desktop/release/validation
```

Optional flags:

| Flag | Purpose |
|------|---------|
| `--platform current` | Validate for the current host platform (default) |
| `--platform win/mac/linux` | Target a specific platform (cross-platform checks only) |
| `--output <dir>` | Directory where validation artifacts are written |
| `--candidateId <id>` | Associate results with a specific release candidate |

### Interpreting results

The gate exits with code `0` (success) only if all required stages pass. Any non-zero exit code means the release must not proceed.

Results are written to:

```
desktop/release/validation/<candidate-id>/
├── release-gate.json   # machine-readable full result
├── release-gate.md     # human-readable summary
├── smoke-validation.json
├── smoke-validation.md
└── performance-notes.md
```

Open `release-gate.md` in any Markdown viewer to review the results. The file lists each stage, its status (passed / failed / skipped), duration, and any blocking reasons.

### The 9 gate stages

| Stage | What it checks | Blocking |
|-------|---------------|---------|
| `root-static` | TypeScript type checking and buildability of the core crew library (`npm run typecheck` in the root) | Yes |
| `root-tests` | Unit and integration tests for the crew library (`npm run test` in the root) | Yes |
| `desktop-static` | TypeScript type checking and configuration validity for the desktop app (`npm run typecheck` in `desktop/`) | Yes |
| `desktop-tests` | Desktop Vitest suite covering main-process handlers, model policy, IPC contracts, renderer flows, and worker runtime | Yes |
| `desktop-build` | Electron Vite compilation and runtime asset staging (`npm run build` in `desktop/`) | Yes |
| `package` | Electron Builder packaging for the current platform, producing a distributable installer or archive | Yes |
| `smoke` | Automated launch of the packaged application, verifying startup, settings load, policy view, run initiation or blocked-run path, and report/history visibility | Yes |
| `performance` | Collection or validation of timing measurements for policy load, file preview, and pre-flight validation against agreed thresholds | Yes |
| `docs` | Verification that `desktop/docs/production-readiness.md` and `desktop/docs/release-signoff.md` exist and are current | Yes |

A stage result of `skipped` is accepted only for non-required platform-specific checks (for example, a macOS code-signing step when running on Windows) and must include a documented reason in the gate output.

---

## 7. Troubleshooting

### RUNTIME_ASSET_ERROR

**Symptom**: Scan fails immediately at startup with a message referencing a missing asset or library entry point.

**Cause**: The desktop worker process could not locate the compiled crew library. This occurs when:
- The root library has not been built (`npm run build` in the repo root was not run)
- The packaged build was produced without running the `prepackage` asset-staging step
- A custom `outputDir` does not contain the expected compiled files

**Resolution**:
1. From the repo root, run `npm run build`.
2. From `desktop/`, run `npm run build` (development) or `npm run package` (packaged distribution). The `prepackage` script runs automatically before `package`.
3. If you are running a packaged build, verify that the release artifact was built with `npm run package` and not copied from a partial build.

### RUN_ALREADY_ACTIVE

**Symptom**: Clicking **Start Scan** shows an error: "A run is already active."

**Cause**: The application enforces a single concurrent run. A previous run is still in `queued`, `starting`, or `running` state.

**Resolution**:
1. Check the Progress page. If a run is still in progress, wait for it to complete or cancel it.
2. To cancel an active run, click **Cancel** on the Progress page.
3. If the application was closed while a run was active, the previous run may be stuck in a terminal state. Open History, locate the stuck run, and check whether it completed. If it shows `running` after a restart, the worker process was interrupted — the run state is preserved but no additional results will be added. You can start a new scan.

### CONFIG_ERROR

**Symptom**: Settings page shows an error, or a scan fails with a message about missing or invalid configuration.

**Cause**: A required provider credential is missing, the model policy references an unavailable model, or the settings file is malformed.

**Resolution**:
1. Navigate to **Settings** and verify that at least one provider credential is saved.
2. Confirm the model policy does not reference a model that has been deprecated or removed by the provider.
3. If the settings file is suspected to be corrupt, locate it using the path in Section 3, rename the file, and restart the application. The application will create a fresh settings file with defaults on the next launch.

### WORKER_CRASH

**Symptom**: Scan progress freezes and the run transitions to `failed` with a message referencing a worker crash or unexpected exit.

**Cause**: The worker subprocess terminated unexpectedly. Common causes include out-of-memory conditions for very large repositories, an unhandled exception in the crew library, or an operating system signal.

**Resolution**:
1. Review the run detail in History. The error code and message are stored with the run record.
2. Check system memory. Large repositories with many files may require more than 4 GB of available RAM during analysis.
3. If the issue is reproducible, run the root test suite (`npm run test` from the repo root) to check for crew library regressions.
4. If you are on a packaged build, verify that the installed version matches a release candidate that passed the full release gate.

---

## 8. Data Management

### Retention policy

The application automatically manages stored run data according to the following policy:

| Threshold | Behavior |
|-----------|---------|
| Age | Runs older than **90 days** are eligible for automatic deletion |
| Count | When more than **100 runs** are stored, the oldest runs beyond that limit are eligible for automatic deletion |

Retention cleanup runs in the background when the application starts. Reports and traces for deleted runs are removed along with the run record.

### Data storage locations

| Data type | Location |
|-----------|---------|
| Run records | `userData/runs/` |
| Reports (Markdown and JSON) | `userData/reports/` |
| Execution traces | `userData/traces/` |
| Model policy snapshots | `userData/model-policies/` |
| Settings | `userData/settings.json` |

### Manual cleanup

To delete a specific run and its associated files manually:
1. Open **History**.
2. Select the run.
3. Click **Delete** (if available in the UI) or locate the run record by `runId` in `userData/runs/` and delete the corresponding entry along with the matching files in `userData/reports/` and `userData/traces/`.

To clear all run data (full reset):
1. Close the application.
2. Delete the contents of `userData/runs/`, `userData/reports/`, and `userData/traces/`.
3. Restart the application.

Settings and model policies are not affected by clearing run data.

### Release validation artifacts

Release gate results and smoke validation records are stored in `desktop/release/validation/<candidate-id>/` within the source tree, not in `userData`. These are not subject to the 90-day / 100-run auto-cleanup and should be retained as long as the release candidate is under review. After a candidate is formally approved or rejected, its validation artifacts serve as the permanent audit trail.
