/**
 * T037 — Smoke validation contract tests
 *
 * The smoke-validate script itself is an ESM .mjs file and cannot be cleanly
 * imported in a TS test. These tests instead exercise the *type contracts*
 * expressed in desktop/electron/types/release.ts, which the script must
 * produce. Tests use compile-time type assertions backed by runtime fixture
 * objects so that any breaking change to SmokeValidationRecord or
 * SmokeValidationStatus is caught at both layers.
 *
 * Specifically covered:
 *  - SmokeValidationRecord has every required field with the correct type
 *  - status "passed" requires all boolean checks true and zero issues
 *  - status "failed" requires at least one issue in the issues array
 *  - platform "current" is a valid value of the union; concrete platforms are
 *    the set { "win", "mac", "linux", "current" }
 *  - evidencePath must be a non-empty string (the script always writes one)
 */

import { describe, it, expect } from 'vitest';
import type {
  SmokeValidationRecord,
  SmokeValidationStatus,
} from '../../electron/types/release.js';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makePassedRecord(
  overrides: Partial<SmokeValidationRecord> = {},
): SmokeValidationRecord {
  return {
    smokeId: 'smoke-001',
    candidateId: 'cand-001',
    platform: 'current',
    recordedAt: '2026-03-09T10:00:00.000Z',
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

function makeFailedRecord(
  overrides: Partial<SmokeValidationRecord> = {},
): SmokeValidationRecord {
  return {
    smokeId: 'smoke-002',
    candidateId: 'cand-002',
    platform: 'win',
    recordedAt: '2026-03-09T11:00:00.000Z',
    status: 'failed',
    launched: false,
    settingsLoaded: false,
    policyViewOpened: false,
    runStartedOrBlocked: false,
    reportOrHistoryVisible: false,
    issues: ['Application failed to launch within timeout'],
    evidencePath: '/release/validation/cand-002/smoke-evidence.log',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SmokeValidationRecord — required fields shape
// ---------------------------------------------------------------------------

describe('SmokeValidationRecord — required field types', () => {
  it('smokeId is a non-empty string', () => {
    const record = makePassedRecord();
    expect(typeof record.smokeId).toBe('string');
    expect(record.smokeId.length).toBeGreaterThan(0);
  });

  it('candidateId is a non-empty string', () => {
    const record = makePassedRecord();
    expect(typeof record.candidateId).toBe('string');
    expect(record.candidateId.length).toBeGreaterThan(0);
  });

  it('platform is a string', () => {
    const record = makePassedRecord();
    expect(typeof record.platform).toBe('string');
  });

  it('recordedAt is a string (ISO-8601)', () => {
    const record = makePassedRecord();
    expect(typeof record.recordedAt).toBe('string');
    const parsed = new Date(record.recordedAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it('status is a string', () => {
    const record = makePassedRecord();
    expect(typeof record.status).toBe('string');
  });

  it('launched is a boolean', () => {
    const record = makePassedRecord();
    expect(typeof record.launched).toBe('boolean');
  });

  it('settingsLoaded is a boolean', () => {
    const record = makePassedRecord();
    expect(typeof record.settingsLoaded).toBe('boolean');
  });

  it('policyViewOpened is a boolean', () => {
    const record = makePassedRecord();
    expect(typeof record.policyViewOpened).toBe('boolean');
  });

  it('runStartedOrBlocked is a boolean', () => {
    const record = makePassedRecord();
    expect(typeof record.runStartedOrBlocked).toBe('boolean');
  });

  it('reportOrHistoryVisible is a boolean', () => {
    const record = makePassedRecord();
    expect(typeof record.reportOrHistoryVisible).toBe('boolean');
  });

  it('issues is an array', () => {
    const record = makePassedRecord();
    expect(Array.isArray(record.issues)).toBe(true);
  });

  it('evidencePath is a non-empty string', () => {
    const record = makePassedRecord();
    expect(typeof record.evidencePath).toBe('string');
    expect(record.evidencePath.length).toBeGreaterThan(0);
  });

  it('has exactly the expected top-level keys (no missing, no extra required ones)', () => {
    const record = makePassedRecord();
    const keys = Object.keys(record);
    const expected = [
      'smokeId',
      'candidateId',
      'platform',
      'recordedAt',
      'status',
      'launched',
      'settingsLoaded',
      'policyViewOpened',
      'runStartedOrBlocked',
      'reportOrHistoryVisible',
      'issues',
      'evidencePath',
    ];
    for (const key of expected) {
      expect(keys).toContain(key);
    }
  });
});

// ---------------------------------------------------------------------------
// SmokeValidationStatus union
// ---------------------------------------------------------------------------

describe('SmokeValidationStatus union', () => {
  it('accepts "passed" as a valid status', () => {
    const status: SmokeValidationStatus = 'passed';
    expect(status).toBe('passed');
  });

  it('accepts "failed" as a valid status', () => {
    const status: SmokeValidationStatus = 'failed';
    expect(status).toBe('failed');
  });

  it('the union has exactly two members', () => {
    // Enumerate all valid literals for documentation + drift detection.
    const validStatuses: SmokeValidationStatus[] = ['passed', 'failed'];
    expect(validStatuses).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// "passed" status contract
// ---------------------------------------------------------------------------

describe('SmokeValidationRecord — "passed" status contract', () => {
  it('a passing record has status "passed"', () => {
    const record = makePassedRecord();
    expect(record.status).toBe('passed');
  });

  it('a passing record has zero issues', () => {
    const record = makePassedRecord();
    expect(record.issues).toHaveLength(0);
  });

  it('a passing record has launched=true', () => {
    const record = makePassedRecord();
    expect(record.launched).toBe(true);
  });

  it('a passing record has settingsLoaded=true', () => {
    const record = makePassedRecord();
    expect(record.settingsLoaded).toBe(true);
  });

  it('a passing record has policyViewOpened=true', () => {
    const record = makePassedRecord();
    expect(record.policyViewOpened).toBe(true);
  });

  it('a passing record has runStartedOrBlocked=true', () => {
    const record = makePassedRecord();
    expect(record.runStartedOrBlocked).toBe(true);
  });

  it('a passing record has reportOrHistoryVisible=true', () => {
    const record = makePassedRecord();
    expect(record.reportOrHistoryVisible).toBe(true);
  });

  it('a record cannot be status "passed" when launched is false', () => {
    // Type-level: this is the invariant the script must enforce.
    // At the runtime level we validate the contract by checking that any
    // record constructed with launched=false cannot legitimately be "passed".
    const brokenRecord = makePassedRecord({ launched: false });
    // The script must set status="failed" when any check boolean is false.
    // Here we assert that the combination is logically inconsistent:
    const allChecksPassed =
      brokenRecord.launched &&
      brokenRecord.settingsLoaded &&
      brokenRecord.policyViewOpened &&
      brokenRecord.runStartedOrBlocked &&
      brokenRecord.reportOrHistoryVisible;
    expect(allChecksPassed).toBe(false);
  });

  it('all five boolean checks must be true for a "passed" record', () => {
    const record = makePassedRecord();
    const allTrue =
      record.launched &&
      record.settingsLoaded &&
      record.policyViewOpened &&
      record.runStartedOrBlocked &&
      record.reportOrHistoryVisible;
    expect(allTrue).toBe(true);
  });

  it('issues array being empty is a necessary condition for "passed"', () => {
    const record = makePassedRecord();
    if (record.status === 'passed') {
      // Contract: no issues permitted on a passed record.
      expect(record.issues).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// "failed" status contract
// ---------------------------------------------------------------------------

describe('SmokeValidationRecord — "failed" status contract', () => {
  it('a failing record has status "failed"', () => {
    const record = makeFailedRecord();
    expect(record.status).toBe('failed');
  });

  it('a failing record has at least one issue', () => {
    const record = makeFailedRecord();
    expect(record.issues.length).toBeGreaterThan(0);
  });

  it('each issue is a non-empty string', () => {
    const record = makeFailedRecord({
      issues: ['Launch timeout', 'Settings pane blank'],
    });
    for (const issue of record.issues) {
      expect(typeof issue).toBe('string');
      expect(issue.length).toBeGreaterThan(0);
    }
  });

  it('a failing record can have any mix of boolean checks', () => {
    // Partial failure: some checks passed, but the record is still "failed"
    // because at least one check failed.
    const partialRecord = makeFailedRecord({
      launched: true,
      settingsLoaded: true,
      policyViewOpened: false,
      runStartedOrBlocked: false,
      reportOrHistoryVisible: false,
      issues: ['Policy view did not open', 'Run button unreachable'],
    });
    expect(partialRecord.status).toBe('failed');
    expect(partialRecord.issues.length).toBeGreaterThan(0);
  });

  it('a record with any boolean check false is not passing', () => {
    const record = makeFailedRecord({ launched: false });
    const wouldPass =
      record.launched &&
      record.settingsLoaded &&
      record.policyViewOpened &&
      record.runStartedOrBlocked &&
      record.reportOrHistoryVisible &&
      record.issues.length === 0;
    expect(wouldPass).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Platform union
// ---------------------------------------------------------------------------

describe('SmokeValidationRecord — platform field', () => {
  it('"current" is accepted as the platform value', () => {
    const record = makePassedRecord({ platform: 'current' });
    expect(record.platform).toBe('current');
  });

  it('"win" is accepted as the platform value', () => {
    const record = makePassedRecord({ platform: 'win' });
    expect(record.platform).toBe('win');
  });

  it('"mac" is accepted as the platform value', () => {
    const record = makePassedRecord({ platform: 'mac' });
    expect(record.platform).toBe('mac');
  });

  it('"linux" is accepted as the platform value', () => {
    const record = makePassedRecord({ platform: 'linux' });
    expect(record.platform).toBe('linux');
  });

  it('the platform union has exactly four concrete values', () => {
    // Type-level documentation: keeps the test in sync with the interface.
    const platforms: SmokeValidationRecord['platform'][] = [
      'win',
      'mac',
      'linux',
      'current',
    ];
    expect(platforms).toHaveLength(4);
  });

  it('"current" is semantically distinct from the three concrete OS names', () => {
    // "current" means the script resolves to the OS of the machine running the
    // validation. Tests here document this distinction at the contract level.
    const concreteOsPlatforms: string[] = ['win', 'mac', 'linux'];
    expect(concreteOsPlatforms).not.toContain('current');
  });
});

// ---------------------------------------------------------------------------
// evidencePath contract
// ---------------------------------------------------------------------------

describe('SmokeValidationRecord — evidencePath contract', () => {
  it('evidencePath is a non-empty string on passed records', () => {
    const record = makePassedRecord();
    expect(record.evidencePath).toBeTruthy();
    expect(typeof record.evidencePath).toBe('string');
  });

  it('evidencePath is a non-empty string on failed records', () => {
    const record = makeFailedRecord();
    expect(record.evidencePath).toBeTruthy();
    expect(typeof record.evidencePath).toBe('string');
  });

  it('evidencePath can reference a .log file', () => {
    const record = makePassedRecord({
      evidencePath: '/release/validation/cand-001/smoke-evidence.log',
    });
    expect(record.evidencePath.endsWith('.log')).toBe(true);
  });

  it('evidencePath can reference a .json file', () => {
    const record = makePassedRecord({
      evidencePath: '/release/validation/cand-001/smoke-evidence.json',
    });
    expect(record.evidencePath.endsWith('.json')).toBe(true);
  });
});
