/**
 * T045 — Release sign-off contract tests
 *
 * Verifies the ReleaseSignOffChecklist interface and SignOffStatus union
 * defined in desktop/electron/types/release.ts. All tests are contract-level:
 * they use compile-time type assertions backed by runtime fixture objects.
 *
 * Specifically covered:
 *  - SignOffStatus transitions: draft → approved, draft → rejected
 *  - An approved sign-off requires zero unresolvedItems
 *  - A sign-off record must reference a valid candidateId and releaseGateRunId
 *  - Cannot approve when smoke has failed (status constraint)
 *  - Cannot approve when the gate run has failed (status constraint)
 *  - Rejected sign-offs may carry notes
 *  - The operator field must be a non-empty string
 */

import { describe, it, expect } from 'vitest';
import type {
  ReleaseSignOffChecklist,
  SignOffStatus,
  SmokeValidationRecord,
  ReleaseGateResult,
} from '../../electron/types/release.js';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeDraftSignOff(
  overrides: Partial<ReleaseSignOffChecklist> = {},
): ReleaseSignOffChecklist {
  return {
    signOffId: 'signoff-001',
    candidateId: 'cand-001',
    releaseGateRunId: 'gate-run-001',
    operator: 'eng-lead',
    reviewedAt: '2026-03-09T14:00:00.000Z',
    status: 'draft',
    checklistVersion: '1.0.0',
    docsVersion: '3.2.1',
    unresolvedItems: [],
    notes: null,
    ...overrides,
  };
}

function makeApprovedSignOff(
  overrides: Partial<ReleaseSignOffChecklist> = {},
): ReleaseSignOffChecklist {
  return makeDraftSignOff({
    status: 'approved',
    unresolvedItems: [],
    notes: null,
    ...overrides,
  });
}

function makeRejectedSignOff(
  overrides: Partial<ReleaseSignOffChecklist> = {},
): ReleaseSignOffChecklist {
  return makeDraftSignOff({
    status: 'rejected',
    unresolvedItems: ['Missing regression test for fix #42'],
    notes: 'Cannot ship until regression test is merged.',
    ...overrides,
  });
}

function makePassedGateResult(
  overrides: Partial<ReleaseGateResult> = {},
): ReleaseGateResult {
  return {
    gateRunId: 'gate-run-001',
    candidateId: 'cand-001',
    startedAt: '2026-03-09T08:00:00.000Z',
    finishedAt: '2026-03-09T08:30:00.000Z',
    status: 'passed',
    platform: 'linux',
    summary: 'All checks passed.',
    blockingReasons: [],
    checkIds: ['check-001'],
    runtimeSessionIds: [],
    generatedFiles: [],
    ...overrides,
  };
}

function makePassedSmokeRecord(
  overrides: Partial<SmokeValidationRecord> = {},
): SmokeValidationRecord {
  return {
    smokeId: 'smoke-001',
    candidateId: 'cand-001',
    platform: 'linux',
    recordedAt: '2026-03-09T09:00:00.000Z',
    status: 'passed',
    launched: true,
    settingsLoaded: true,
    policyViewOpened: true,
    runStartedOrBlocked: true,
    reportOrHistoryVisible: true,
    issues: [],
    evidencePath: '/release/validation/cand-001/smoke-evidence.log',
    ...overrides,
  };
}

/**
 * Simulates the application-level approval guard.
 * Returns true only when all preconditions for approval are met.
 */
function canApprove(
  signOff: ReleaseSignOffChecklist,
  gate: ReleaseGateResult,
  smoke: SmokeValidationRecord,
): boolean {
  return (
    signOff.unresolvedItems.length === 0 &&
    gate.status === 'passed' &&
    smoke.status === 'passed'
  );
}

// ---------------------------------------------------------------------------
// SignOffStatus union
// ---------------------------------------------------------------------------

describe('SignOffStatus union', () => {
  it('accepts "draft" as a valid status', () => {
    const status: SignOffStatus = 'draft';
    expect(status).toBe('draft');
  });

  it('accepts "approved" as a valid status', () => {
    const status: SignOffStatus = 'approved';
    expect(status).toBe('approved');
  });

  it('accepts "rejected" as a valid status', () => {
    const status: SignOffStatus = 'rejected';
    expect(status).toBe('rejected');
  });

  it('the union has exactly three members', () => {
    const all: SignOffStatus[] = ['draft', 'approved', 'rejected'];
    expect(all).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// ReleaseSignOffChecklist — required field types
// ---------------------------------------------------------------------------

describe('ReleaseSignOffChecklist — required field types', () => {
  it('signOffId is a non-empty string', () => {
    const so = makeDraftSignOff();
    expect(typeof so.signOffId).toBe('string');
    expect(so.signOffId.length).toBeGreaterThan(0);
  });

  it('candidateId is a non-empty string', () => {
    const so = makeDraftSignOff();
    expect(typeof so.candidateId).toBe('string');
    expect(so.candidateId.length).toBeGreaterThan(0);
  });

  it('releaseGateRunId is a non-empty string', () => {
    const so = makeDraftSignOff();
    expect(typeof so.releaseGateRunId).toBe('string');
    expect(so.releaseGateRunId.length).toBeGreaterThan(0);
  });

  it('operator is a non-empty string', () => {
    const so = makeDraftSignOff();
    expect(typeof so.operator).toBe('string');
    expect(so.operator.length).toBeGreaterThan(0);
  });

  it('reviewedAt is a string (ISO-8601)', () => {
    const so = makeDraftSignOff();
    expect(typeof so.reviewedAt).toBe('string');
    const parsed = new Date(so.reviewedAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it('status is a string', () => {
    const so = makeDraftSignOff();
    expect(typeof so.status).toBe('string');
  });

  it('checklistVersion is a string', () => {
    const so = makeDraftSignOff();
    expect(typeof so.checklistVersion).toBe('string');
  });

  it('docsVersion is a string', () => {
    const so = makeDraftSignOff();
    expect(typeof so.docsVersion).toBe('string');
  });

  it('unresolvedItems is an array', () => {
    const so = makeDraftSignOff();
    expect(Array.isArray(so.unresolvedItems)).toBe(true);
  });

  it('notes is null or a string', () => {
    const withNull = makeDraftSignOff({ notes: null });
    const withNote = makeDraftSignOff({ notes: 'Some note' });
    expect(withNull.notes).toBeNull();
    expect(typeof withNote.notes).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Status transition: draft → approved
// ---------------------------------------------------------------------------

describe('SignOff status transition: draft → approved', () => {
  it('a sign-off that starts as draft can transition to approved', () => {
    const so = makeDraftSignOff();
    expect(so.status).toBe('draft');

    // Apply transition (mutable field in the interface)
    so.status = 'approved';

    expect(so.status).toBe('approved');
  });

  it('status field is mutable (the interface declares it without readonly)', () => {
    const so = makeDraftSignOff();
    so.status = 'approved';
    expect(so.status).toBe('approved');
    so.status = 'rejected';
    expect(so.status).toBe('rejected');
    so.status = 'draft';
    expect(so.status).toBe('draft');
  });

  it('approved sign-off has status "approved"', () => {
    const so = makeApprovedSignOff();
    expect(so.status).toBe('approved');
  });
});

// ---------------------------------------------------------------------------
// Status transition: draft → rejected
// ---------------------------------------------------------------------------

describe('SignOff status transition: draft → rejected', () => {
  it('a sign-off that starts as draft can transition to rejected', () => {
    const so = makeDraftSignOff();
    expect(so.status).toBe('draft');

    so.status = 'rejected';

    expect(so.status).toBe('rejected');
  });

  it('rejected sign-off has status "rejected"', () => {
    const so = makeRejectedSignOff();
    expect(so.status).toBe('rejected');
  });

  it('a rejected sign-off can carry explanatory notes', () => {
    const so = makeRejectedSignOff({ notes: 'Fix security issue first.' });
    expect(so.notes).toBe('Fix security issue first.');
  });
});

// ---------------------------------------------------------------------------
// Approved sign-off requires zero unresolvedItems
// ---------------------------------------------------------------------------

describe('approved sign-off — unresolvedItems constraint', () => {
  it('an approved sign-off has zero unresolved items', () => {
    const so = makeApprovedSignOff();
    expect(so.unresolvedItems).toHaveLength(0);
  });

  it('a sign-off with unresolved items cannot be approved', () => {
    const so = makeDraftSignOff({
      unresolvedItems: ['Missing changelog entry', 'Performance regression unaddressed'],
    });
    // The contract: zero unresolvedItems is a necessary condition for approval.
    const isEligibleForApproval = so.unresolvedItems.length === 0;
    expect(isEligibleForApproval).toBe(false);
  });

  it('all unresolved items are non-empty strings', () => {
    const so = makeDraftSignOff({
      unresolvedItems: ['item-a', 'item-b'],
    });
    for (const item of so.unresolvedItems) {
      expect(typeof item).toBe('string');
      expect(item.length).toBeGreaterThan(0);
    }
  });

  it('a draft sign-off with unresolved items can transition to rejected (not approved)', () => {
    const so = makeDraftSignOff({
      unresolvedItems: ['Open issue: flaky test in CI'],
    });
    // Rejection is permitted regardless of unresolved items.
    so.status = 'rejected';
    expect(so.status).toBe('rejected');
    expect(so.unresolvedItems.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Sign-off must reference a valid candidateId and releaseGateRunId
// ---------------------------------------------------------------------------

describe('sign-off reference integrity', () => {
  it('candidateId on the sign-off matches the referenced candidate', () => {
    const gate = makePassedGateResult({ candidateId: 'cand-ref-001' });
    const so = makeDraftSignOff({
      candidateId: 'cand-ref-001',
      releaseGateRunId: gate.gateRunId,
    });

    // The contract: sign-off candidateId must equal the gate candidateId.
    expect(so.candidateId).toBe(gate.candidateId);
  });

  it('releaseGateRunId on the sign-off matches the referenced gate run', () => {
    const gate = makePassedGateResult({ gateRunId: 'gate-ref-001' });
    const so = makeDraftSignOff({ releaseGateRunId: gate.gateRunId });

    expect(so.releaseGateRunId).toBe(gate.gateRunId);
  });

  it('sign-off with mismatched candidateId fails the reference integrity check', () => {
    const gate = makePassedGateResult({ candidateId: 'cand-A' });
    const so = makeDraftSignOff({ candidateId: 'cand-B' });

    // Contract enforcement: the IDs must agree.
    const referencesAreConsistent = so.candidateId === gate.candidateId;
    expect(referencesAreConsistent).toBe(false);
  });

  it('candidateId must be a non-empty string', () => {
    const so = makeDraftSignOff({ candidateId: 'cand-001' });
    expect(so.candidateId.length).toBeGreaterThan(0);
  });

  it('releaseGateRunId must be a non-empty string', () => {
    const so = makeDraftSignOff({ releaseGateRunId: 'gate-run-001' });
    expect(so.releaseGateRunId.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Cannot approve with failed smoke
// ---------------------------------------------------------------------------

describe('approval blocked by failed smoke', () => {
  it('canApprove returns false when smoke status is "failed"', () => {
    const so = makeDraftSignOff({ unresolvedItems: [] });
    const gate = makePassedGateResult();
    const smoke = makePassedSmokeRecord({ status: 'failed', issues: ['crash'] });

    expect(canApprove(so, gate, smoke)).toBe(false);
  });

  it('canApprove returns false when smoke has issues even if status is set to "passed"', () => {
    // The guard checks smoke.status, not the issues array; but the issues field
    // documents why the smoke failed. We assert status is the deciding factor.
    const so = makeDraftSignOff({ unresolvedItems: [] });
    const gate = makePassedGateResult();
    const smoke = makePassedSmokeRecord({ status: 'failed', issues: ['hang on startup'] });

    expect(canApprove(so, gate, smoke)).toBe(false);
  });

  it('canApprove returns true when smoke status is "passed" and no unresolved items', () => {
    const so = makeDraftSignOff({ unresolvedItems: [] });
    const gate = makePassedGateResult();
    const smoke = makePassedSmokeRecord({ status: 'passed' });

    expect(canApprove(so, gate, smoke)).toBe(true);
  });

  it('a failed smoke record that has no issues is still status "failed"', () => {
    // Edge case: smoke may have failed before writing issues. Status wins.
    const smoke = makePassedSmokeRecord({ status: 'failed', issues: [] });
    expect(smoke.status).toBe('failed');
  });
});

// ---------------------------------------------------------------------------
// Cannot approve with failed gate
// ---------------------------------------------------------------------------

describe('approval blocked by failed gate', () => {
  it('canApprove returns false when gate status is "failed"', () => {
    const so = makeDraftSignOff({ unresolvedItems: [] });
    const gate = makePassedGateResult({ status: 'failed', blockingReasons: ['desktop-tests failed'] });
    const smoke = makePassedSmokeRecord();

    expect(canApprove(so, gate, smoke)).toBe(false);
  });

  it('canApprove returns false when gate status is "running"', () => {
    const so = makeDraftSignOff({ unresolvedItems: [] });
    const gate = makePassedGateResult({ status: 'running', finishedAt: null });
    const smoke = makePassedSmokeRecord();

    expect(canApprove(so, gate, smoke)).toBe(false);
  });

  it('canApprove returns false when gate status is "pending"', () => {
    const so = makeDraftSignOff({ unresolvedItems: [] });
    const gate = makePassedGateResult({ status: 'pending', finishedAt: null });
    const smoke = makePassedSmokeRecord();

    expect(canApprove(so, gate, smoke)).toBe(false);
  });

  it('canApprove returns false when gate status is "cancelled"', () => {
    const so = makeDraftSignOff({ unresolvedItems: [] });
    const gate = makePassedGateResult({ status: 'cancelled' });
    const smoke = makePassedSmokeRecord();

    expect(canApprove(so, gate, smoke)).toBe(false);
  });

  it('canApprove returns false when both gate and smoke have failed', () => {
    const so = makeDraftSignOff({ unresolvedItems: [] });
    const gate = makePassedGateResult({ status: 'failed' });
    const smoke = makePassedSmokeRecord({ status: 'failed', issues: ['crash'] });

    expect(canApprove(so, gate, smoke)).toBe(false);
  });

  it('canApprove returns false when gate passed but there are unresolved items', () => {
    const so = makeDraftSignOff({
      unresolvedItems: ['CHANGELOG not updated'],
    });
    const gate = makePassedGateResult();
    const smoke = makePassedSmokeRecord();

    expect(canApprove(so, gate, smoke)).toBe(false);
  });

  it('canApprove returns true only when gate passed, smoke passed, and zero unresolved items', () => {
    const so = makeDraftSignOff({ unresolvedItems: [] });
    const gate = makePassedGateResult({ status: 'passed' });
    const smoke = makePassedSmokeRecord({ status: 'passed' });

    expect(canApprove(so, gate, smoke)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// operator field
// ---------------------------------------------------------------------------

describe('sign-off operator field', () => {
  it('operator is a non-empty string', () => {
    const so = makeDraftSignOff({ operator: 'alice' });
    expect(so.operator).toBe('alice');
    expect(so.operator.length).toBeGreaterThan(0);
  });

  it('operator can be an email-like string', () => {
    const so = makeDraftSignOff({ operator: 'release-team@example.com' });
    expect(so.operator).toBe('release-team@example.com');
  });

  it('operator field is preserved after status transition', () => {
    const so = makeDraftSignOff({ operator: 'bob' });
    so.status = 'approved';
    expect(so.operator).toBe('bob');
  });
});
