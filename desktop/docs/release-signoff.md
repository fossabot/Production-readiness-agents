# Release Sign-Off Procedure

**Document version**: 1.0
**Applies to**: Production Readiness Desktop v0.1.x
**Authority**: This document defines the mandatory approval procedure for any release candidate. No candidate may be declared production-ready without completing this procedure.

---

## 1. Sign-Off Checklist

The following items must all be verified before approval can be granted. Work through each item in order. Record any unresolved items in the sign-off record.

| # | Item | Required | How to verify |
|---|------|----------|--------------|
| 1 | Release gate has been run and status is `passed` | Yes | Open `release-gate.md` for the candidate; confirm `status: passed` and zero blocking reasons |
| 2 | All 9 gate stages show `passed` or documented `skipped` | Yes | Review each stage row in `release-gate.md` |
| 3 | Smoke validation status is `passed` | Yes | Open `smoke-validation.md` for the candidate; confirm `status: passed` |
| 4 | All 5 smoke checkpoints are `true` | Yes | Confirm launched, settingsLoaded, policyViewOpened, runStartedOrBlocked, reportOrHistoryVisible are all `true` in `smoke-validation.json` |
| 5 | Smoke evidence file exists and is non-empty | Yes | Confirm `evidencePath` in `smoke-validation.json` points to a real file |
| 6 | Performance notes are present | Yes | Confirm `performance-notes.md` exists and records policy load, file preview, and preflight timing measurements |
| 7 | Policy load time is within the agreed threshold | Yes | Read timing value from `performance-notes.md`; threshold is 500 ms under normal conditions |
| 8 | Operator runbook exists and is current | Yes | Confirm `desktop/docs/production-readiness.md` exists and matches the docs version referenced in the gate result |
| 9 | This sign-off document exists and matches the gate result | Yes | Confirm `desktop/docs/release-signoff.md` exists and its version matches the `docsVersion` field |
| 10 | No critical findings are unresolved | Yes | Confirm the crew report for the candidate shows zero critical-severity findings, or that each critical finding has a documented, approved exception |
| 11 | Candidate version matches the release artifact | Yes | Confirm the version in `release-gate.json` matches the packaged installer filename and the application title bar |
| 12 | Artifact checksum is recorded | Yes | Confirm `checksum` field in the candidate record is present and matches the distributed file |

---

## 2. Prerequisites

The following conditions must be met before this procedure begins. Do not start the sign-off review if either condition is unmet.

**Prerequisite 1 — Release gate must pass**

Run the release gate from the `desktop/` directory and confirm a zero-error exit:

```bash
npm run release:gate -- --platform current --output desktop/release/validation
```

The gate must exit with code `0`. A non-zero exit means at least one required stage failed and the candidate is not eligible for sign-off.

**Prerequisite 2 — Smoke validation must pass**

Smoke validation runs automatically as stage 8 of the release gate when `--runSmoke` is active (the default). Confirm that `desktop/release/validation/<candidate-id>/smoke-validation.md` shows a passed result before proceeding.

If smoke validation was run separately:

```bash
npm run release:smoke
```

The smoke validator must produce a `SmokeValidationRecord` with `status: passed` and all boolean checkpoints set to `true`.

---

## 3. Procedure

Complete the following steps in order. Each step references a specific artifact. Do not skip a step or rely on memory — the purpose of this procedure is to produce a reviewable audit trail from evidence alone.

**Step 1 — Retrieve the gate result**

Locate the candidate's validation folder:

```
desktop/release/validation/<candidate-id>/
├── release-gate.json
├── release-gate.md
├── smoke-validation.json
├── smoke-validation.md
└── performance-notes.md
```

Open `release-gate.md`. Note the `gateRunId`, `candidateId`, `platform`, `status`, `startedAt`, and `finishedAt` values. These will be entered into the sign-off record.

**Step 2 — Review the gate stage results**

Read each stage row in `release-gate.md`. For every stage:
- If status is `passed`: no action required.
- If status is `failed`: the candidate is rejected. Record the failing stage and reason in the sign-off notes and stop.
- If status is `skipped`: confirm the skip reason is documented in the gate output and that the stage is genuinely non-applicable (for example, a platform-specific step on a different platform).

**Step 3 — Review the smoke evidence**

Open `smoke-validation.md` and `smoke-validation.json`. Confirm:
- `status` is `passed`
- `launched`, `settingsLoaded`, `policyViewOpened`, `runStartedOrBlocked`, and `reportOrHistoryVisible` are all `true`
- `issues` array is empty
- `evidencePath` points to a file that exists

Open the evidence file. It must contain a screenshot, log excerpt, or structured record that a third party can evaluate without running the application.

**Step 4 — Check performance notes**

Open `performance-notes.md`. Confirm that timing measurements are recorded for:
- Policy load time (threshold: 500 ms)
- File preview generation time
- Pre-flight validation time

If any measurement exceeds its threshold, evaluate whether the deviation was recorded as a blocking reason in the gate result. If it was not recorded as blocking but exceeds the threshold, record it as an unresolved item in the sign-off notes.

**Step 5 — Verify documentation currency**

Confirm that both documentation files exist and are the version referenced in the gate result:
- `desktop/docs/production-readiness.md`
- `desktop/docs/release-signoff.md`

The `docs` stage of the release gate checks for the existence of these files. The sign-off record must capture the specific document version (`docsVersion`) so future reviewers can confirm which version of the docs was current at sign-off time.

**Step 6 — Make the decision**

Apply the approval criteria and rejection criteria below. Record the decision in a `ReleaseSignOffChecklist` record as described in Section 4.

---

## 4. Sign-Off Record Format

Every completed sign-off review — whether approved or rejected — must produce a `ReleaseSignOffChecklist` record. This record is the machine-readable counterpart to the review performed in this document.

### ReleaseSignOffChecklist entity

```ts
interface ReleaseSignOffChecklist {
  readonly signOffId: string;          // Unique ID for this sign-off event (UUID)
  readonly candidateId: string;        // The release candidate being reviewed
  readonly releaseGateRunId: string;   // The gateRunId from release-gate.json
  readonly operator: string;           // Name or identifier of the reviewer
  readonly reviewedAt: string;         // ISO 8601 timestamp of the sign-off decision
  status: "draft" | "approved" | "rejected";
  readonly checklistVersion: string;   // Version of this document used during review (e.g., "1.0")
  readonly docsVersion: string;        // Version of production-readiness.md at review time
  readonly unresolvedItems: string[];  // Item numbers from the checklist that are unresolved
  readonly notes: string | null;       // Free-text rationale for the decision
}
```

### How to produce the record

If a sign-off tool is available, it will prompt for each field and write the JSON record automatically. If sign-off is performed manually, create a file named `sign-off-<candidateId>.json` in `desktop/release/validation/<candidateId>/` with the above structure.

Example approved record:

```json
{
  "signOffId": "so-20260309-001",
  "candidateId": "rc-20260309-win-001",
  "releaseGateRunId": "gate-20260309-001",
  "operator": "Jane Smith",
  "reviewedAt": "2026-03-09T14:30:00Z",
  "status": "approved",
  "checklistVersion": "1.0",
  "docsVersion": "1.0",
  "unresolvedItems": [],
  "notes": null
}
```

Example rejected record:

```json
{
  "signOffId": "so-20260309-002",
  "candidateId": "rc-20260309-win-002",
  "releaseGateRunId": "gate-20260309-002",
  "operator": "Jane Smith",
  "reviewedAt": "2026-03-09T16:00:00Z",
  "status": "rejected",
  "checklistVersion": "1.0",
  "docsVersion": "1.0",
  "unresolvedItems": ["3", "4"],
  "notes": "Smoke validation failed at policyViewOpened checkpoint. Candidate must be rebuilt and re-validated."
}
```

---

## 5. Approval Criteria

All of the following must be true for the decision to be `approved`:

1. The `ReleaseGateResult.status` is `passed`.
2. `ReleaseGateResult.blockingReasons` is an empty array.
3. All required gate checks have `status: passed`. No required check is `failed`.
4. `SmokeValidationRecord.status` is `passed`.
5. All five smoke checkpoints (`launched`, `settingsLoaded`, `policyViewOpened`, `runStartedOrBlocked`, `reportOrHistoryVisible`) are `true`.
6. `SmokeValidationRecord.issues` is an empty array.
7. Performance measurements are within agreed thresholds or deviations are formally accepted with written justification in the sign-off notes.
8. `desktop/docs/production-readiness.md` exists and its version matches `docsVersion` in the sign-off record.
9. `desktop/docs/release-signoff.md` exists and its version matches `docsVersion` in the sign-off record.
10. `ReleaseSignOffChecklist.unresolvedItems` is an empty array.

If any criterion is not met, the decision must be `rejected` or the review must remain `draft` until the criterion is resolved.

---

## 6. Rejection Criteria

The decision must be `rejected` if any of the following are true:

1. Any required release gate check has `status: failed`.
2. `ReleaseGateResult.blockingReasons` contains one or more entries.
3. `SmokeValidationRecord.status` is `failed`.
4. Any of the five smoke checkpoints is `false`.
5. `SmokeValidationRecord.issues` contains one or more entries.
6. `desktop/docs/production-readiness.md` does not exist or is a different version than expected.
7. `desktop/docs/release-signoff.md` does not exist or is a different version than expected.
8. One or more unresolved checklist items remain with no formal acceptance rationale.
9. The gate result references a runtime execution session that produced a `RUNTIME_ASSET_ERROR` or `WORKER_CRASH` without a documented resolution.

A rejected candidate must not be distributed. A new candidate must be produced, the gate must be re-run in full, and this procedure must be repeated from the beginning.

---

## 7. Record Retention

Sign-off records are permanent. They are not subject to the 90-day / 100-run auto-cleanup policy that governs ordinary run data.

Records must be retained for the following reasons:
- They constitute the audit trail for each production release decision.
- Future operators or auditors may need to trace a deployed version back to its sign-off evidence.
- Regulatory or organizational change-management requirements may mandate retention beyond the project's active lifespan.

### Storage

Sign-off records are stored alongside the gate and smoke artifacts in:

```
desktop/release/validation/<candidate-id>/
└── sign-off-<candidate-id>.json
```

These files must not be deleted, overwritten, or moved after a sign-off decision is recorded. If a candidate is superseded by a newer candidate, its sign-off record remains in place as a historical reference.

### Archiving

When a major version is retired, the entire `desktop/release/validation/` tree for that version's candidates should be archived (for example, copied to a designated long-term storage location) before the working tree is cleaned. The archive must preserve the folder structure so individual candidate records remain traceable.
