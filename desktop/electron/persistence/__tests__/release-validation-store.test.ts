/**
 * T038 — Release validation persistence contract tests
 *
 * Verifies the behaviour of release-validation-store.ts functions:
 *   saveGateResult   — writes release-gate.json atomically under the correct path
 *   loadGateResult   — reads back the serialised ReleaseGateResult or returns null
 *   saveSmokeRecord  — writes smoke-validation.json atomically
 *   loadSmokeRecord  — reads back the SmokeValidationRecord or returns null
 *   getValidationDir — creates the per-candidate directory structure
 *
 * node:fs is fully mocked so no real filesystem is touched. electron is also
 * mocked to satisfy the module graph (handlers.ts transitively imports it).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock handles — vi.hoisted() ensures these are available before the
// vi.mock() factory runs (vi.mock is hoisted to top of the file by Vitest).
// ---------------------------------------------------------------------------

const {
  mockExistsSync,
  mockMkdirSync,
  mockWriteFileSync,
  mockRenameSync,
  mockReadFileSync,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn<[string], boolean>().mockReturnValue(false),
  mockMkdirSync: vi.fn<[string, { recursive: boolean }], void>(),
  mockWriteFileSync: vi.fn<[string, string, string], void>(),
  mockRenameSync: vi.fn<[string, string], void>(),
  mockReadFileSync: vi.fn<[string, string], string>(),
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  renameSync: mockRenameSync,
  readFileSync: mockReadFileSync,
}));

// ---------------------------------------------------------------------------
// Import module under test — after all mocks
// ---------------------------------------------------------------------------

import {
  saveGateResult,
  loadGateResult,
  saveSmokeRecord,
  loadSmokeRecord,
  getValidationDir,
} from '../release-validation-store.js';
import type {
  ReleaseGateResult,
  SmokeValidationRecord,
} from '../../types/release.js';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeGateResult(
  overrides: Partial<ReleaseGateResult> = {},
): ReleaseGateResult {
  return {
    gateRunId: 'gate-run-001',
    candidateId: 'cand-001',
    startedAt: '2026-03-09T08:00:00.000Z',
    finishedAt: '2026-03-09T08:30:00.000Z',
    status: 'passed',
    platform: 'linux',
    summary: 'All gate checks passed.',
    blockingReasons: [],
    checkIds: ['check-001', 'check-002'],
    runtimeSessionIds: ['session-001'],
    generatedFiles: ['/release/validation/cand-001/release-gate.json'],
    ...overrides,
  };
}

function makeSmokeRecord(
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: directories do not exist so mkdirSync will be called.
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue('{}');
});

// ---------------------------------------------------------------------------
// getValidationDir
// ---------------------------------------------------------------------------

describe('getValidationDir', () => {
  it('returns a string path', () => {
    const dir = getValidationDir('cand-001');
    expect(typeof dir).toBe('string');
  });

  it('returned path contains the candidateId', () => {
    const dir = getValidationDir('cand-abc');
    expect(dir).toContain('cand-abc');
  });

  it('returned path contains the validation directory segment', () => {
    const dir = getValidationDir('cand-001');
    // The store uses VALIDATION_DIR = "desktop/release/validation"
    expect(dir).toContain('validation');
  });

  it('calls mkdirSync when the directory does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    getValidationDir('cand-new');
    expect(mockMkdirSync).toHaveBeenCalledOnce();
  });

  it('calls mkdirSync with { recursive: true }', () => {
    mockExistsSync.mockReturnValue(false);
    getValidationDir('cand-new');
    const call = mockMkdirSync.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1]).toEqual({ recursive: true });
  });

  it('does NOT call mkdirSync when the directory already exists', () => {
    mockExistsSync.mockReturnValue(true);
    getValidationDir('cand-existing');
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// saveGateResult
// ---------------------------------------------------------------------------

describe('saveGateResult', () => {
  it('returns a string file path', () => {
    const result = makeGateResult();
    const path = saveGateResult(result);
    expect(typeof path).toBe('string');
  });

  it('returned path contains "release-gate.json"', () => {
    const result = makeGateResult();
    const path = saveGateResult(result);
    expect(path).toContain('release-gate.json');
  });

  it('returned path contains the candidateId', () => {
    const result = makeGateResult({ candidateId: 'cand-xyz' });
    const path = saveGateResult(result);
    expect(path).toContain('cand-xyz');
  });

  it('calls writeFileSync (atomic write stage 1)', () => {
    saveGateResult(makeGateResult());
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
  });

  it('calls renameSync (atomic write stage 2 — tmp → final)', () => {
    saveGateResult(makeGateResult());
    expect(mockRenameSync).toHaveBeenCalledOnce();
  });

  it('writeFileSync receives a .tmp path as its first argument', () => {
    saveGateResult(makeGateResult());
    const [writtenPath] = mockWriteFileSync.mock.calls[0]!;
    expect(writtenPath).toContain('.tmp');
  });

  it('writeFileSync receives JSON-serialised data', () => {
    const result = makeGateResult({ gateRunId: 'gate-check-serial' });
    saveGateResult(result);
    const [, content] = mockWriteFileSync.mock.calls[0]!;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(parsed['gateRunId']).toBe('gate-check-serial');
  });

  it('writeFileSync encodes with utf-8', () => {
    saveGateResult(makeGateResult());
    const [, , encoding] = mockWriteFileSync.mock.calls[0]!;
    expect(encoding).toBe('utf-8');
  });

  it('renameSync renames from .tmp path to the final path', () => {
    saveGateResult(makeGateResult());
    const [tmpPath, finalPath] = mockRenameSync.mock.calls[0]!;
    expect(tmpPath).toContain('.tmp');
    expect(finalPath).toContain('release-gate.json');
    expect(finalPath).not.toContain('.tmp');
  });

  it('preserves all fields from the ReleaseGateResult in the written JSON', () => {
    const result = makeGateResult({
      status: 'failed',
      blockingReasons: ['root-tests failed'],
    });
    saveGateResult(result);
    const [, content] = mockWriteFileSync.mock.calls[0]!;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(parsed['status']).toBe('failed');
    expect(parsed['blockingReasons']).toEqual(['root-tests failed']);
  });
});

// ---------------------------------------------------------------------------
// loadGateResult
// ---------------------------------------------------------------------------

describe('loadGateResult', () => {
  it('returns null when the gate result file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const result = loadGateResult('cand-missing');
    expect(result).toBeNull();
  });

  it('returns a ReleaseGateResult object when the file exists', () => {
    mockExistsSync.mockReturnValue(true);
    const stored = makeGateResult({ candidateId: 'cand-found' });
    mockReadFileSync.mockReturnValue(JSON.stringify(stored));

    const result = loadGateResult('cand-found');

    expect(result).not.toBeNull();
    expect(result?.gateRunId).toBe(stored.gateRunId);
  });

  it('returned object has gateRunId matching stored data', () => {
    mockExistsSync.mockReturnValue(true);
    const stored = makeGateResult({ gateRunId: 'gate-loaded-001' });
    mockReadFileSync.mockReturnValue(JSON.stringify(stored));

    const result = loadGateResult('cand-001');

    expect(result?.gateRunId).toBe('gate-loaded-001');
  });

  it('returned object has status matching stored data', () => {
    mockExistsSync.mockReturnValue(true);
    const stored = makeGateResult({ status: 'failed' });
    mockReadFileSync.mockReturnValue(JSON.stringify(stored));

    const result = loadGateResult('cand-001');

    expect(result?.status).toBe('failed');
  });

  it('reads from the correct path containing the candidateId and "release-gate.json"', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(makeGateResult()));

    loadGateResult('cand-path-check');

    // existsSync is called to check the path; capture the argument.
    const checkedPath = mockExistsSync.mock.calls[0]?.[0];
    expect(checkedPath).toContain('cand-path-check');
    expect(checkedPath).toContain('release-gate.json');
  });

  it('returns all fields including arrays from the stored JSON', () => {
    mockExistsSync.mockReturnValue(true);
    const stored = makeGateResult({
      checkIds: ['c1', 'c2', 'c3'],
      blockingReasons: [],
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(stored));

    const result = loadGateResult('cand-001');

    expect(result?.checkIds).toEqual(['c1', 'c2', 'c3']);
    expect(result?.blockingReasons).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// saveSmokeRecord
// ---------------------------------------------------------------------------

describe('saveSmokeRecord', () => {
  it('returns a string file path', () => {
    const record = makeSmokeRecord();
    const path = saveSmokeRecord(record);
    expect(typeof path).toBe('string');
  });

  it('returned path contains "smoke-validation.json"', () => {
    const record = makeSmokeRecord();
    const path = saveSmokeRecord(record);
    expect(path).toContain('smoke-validation.json');
  });

  it('returned path contains the candidateId', () => {
    const record = makeSmokeRecord({ candidateId: 'cand-smoke' });
    const path = saveSmokeRecord(record);
    expect(path).toContain('cand-smoke');
  });

  it('calls writeFileSync once (atomic write stage 1)', () => {
    saveSmokeRecord(makeSmokeRecord());
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
  });

  it('calls renameSync once (atomic write stage 2)', () => {
    saveSmokeRecord(makeSmokeRecord());
    expect(mockRenameSync).toHaveBeenCalledOnce();
  });

  it('writeFileSync receives JSON that includes the smokeId', () => {
    const record = makeSmokeRecord({ smokeId: 'smoke-serial-check' });
    saveSmokeRecord(record);
    const [, content] = mockWriteFileSync.mock.calls[0]!;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(parsed['smokeId']).toBe('smoke-serial-check');
  });

  it('writeFileSync encodes with utf-8', () => {
    saveSmokeRecord(makeSmokeRecord());
    const [, , encoding] = mockWriteFileSync.mock.calls[0]!;
    expect(encoding).toBe('utf-8');
  });

  it('preserves the issues array in the serialised JSON', () => {
    const record = makeSmokeRecord({
      status: 'failed',
      issues: ['app crashed', 'settings blank'],
    });
    saveSmokeRecord(record);
    const [, content] = mockWriteFileSync.mock.calls[0]!;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    expect(parsed['issues']).toEqual(['app crashed', 'settings blank']);
  });
});

// ---------------------------------------------------------------------------
// loadSmokeRecord
// ---------------------------------------------------------------------------

describe('loadSmokeRecord', () => {
  it('returns null when the smoke validation file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const result = loadSmokeRecord('cand-missing');
    expect(result).toBeNull();
  });

  it('returns a SmokeValidationRecord when the file exists', () => {
    mockExistsSync.mockReturnValue(true);
    const stored = makeSmokeRecord({ candidateId: 'cand-found' });
    mockReadFileSync.mockReturnValue(JSON.stringify(stored));

    const result = loadSmokeRecord('cand-found');

    expect(result).not.toBeNull();
    expect(result?.smokeId).toBe(stored.smokeId);
  });

  it('returned record has status matching stored data', () => {
    mockExistsSync.mockReturnValue(true);
    const stored = makeSmokeRecord({ status: 'failed' });
    mockReadFileSync.mockReturnValue(JSON.stringify(stored));

    const result = loadSmokeRecord('cand-001');

    expect(result?.status).toBe('failed');
  });

  it('reads from a path containing the candidateId and "smoke-validation.json"', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(makeSmokeRecord()));

    loadSmokeRecord('cand-smoke-path');

    const checkedPath = mockExistsSync.mock.calls[0]?.[0];
    expect(checkedPath).toContain('cand-smoke-path');
    expect(checkedPath).toContain('smoke-validation.json');
  });

  it('returned record preserves all boolean fields', () => {
    mockExistsSync.mockReturnValue(true);
    const stored = makeSmokeRecord({
      launched: true,
      settingsLoaded: true,
      policyViewOpened: false,
      runStartedOrBlocked: false,
      reportOrHistoryVisible: false,
      status: 'failed',
      issues: ['policy view blocked'],
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(stored));

    const result = loadSmokeRecord('cand-001');

    expect(result?.launched).toBe(true);
    expect(result?.settingsLoaded).toBe(true);
    expect(result?.policyViewOpened).toBe(false);
    expect(result?.runStartedOrBlocked).toBe(false);
    expect(result?.reportOrHistoryVisible).toBe(false);
  });

  it('returned record issues array matches stored data', () => {
    mockExistsSync.mockReturnValue(true);
    const stored = makeSmokeRecord({
      status: 'failed',
      issues: ['crash on open'],
    });
    mockReadFileSync.mockReturnValue(JSON.stringify(stored));

    const result = loadSmokeRecord('cand-001');

    expect(result?.issues).toEqual(['crash on open']);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: save then load
// ---------------------------------------------------------------------------

describe('round-trip: save then load', () => {
  it('saveGateResult + loadGateResult returns identical data', () => {
    // Simulate the file write by capturing writeFileSync content,
    // then feed it back through readFileSync for the load call.
    let capturedContent = '';
    mockWriteFileSync.mockImplementation((_path: string, data: string) => {
      capturedContent = data;
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => capturedContent);

    const original = makeGateResult({ gateRunId: 'gate-round-trip' });
    saveGateResult(original);
    const loaded = loadGateResult(original.candidateId);

    expect(loaded?.gateRunId).toBe(original.gateRunId);
    expect(loaded?.status).toBe(original.status);
    expect(loaded?.blockingReasons).toEqual(original.blockingReasons);
  });

  it('saveSmokeRecord + loadSmokeRecord returns identical data', () => {
    let capturedContent = '';
    mockWriteFileSync.mockImplementation((_path: string, data: string) => {
      capturedContent = data;
    });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => capturedContent);

    const original = makeSmokeRecord({ smokeId: 'smoke-round-trip' });
    saveSmokeRecord(original);
    const loaded = loadSmokeRecord(original.candidateId);

    expect(loaded?.smokeId).toBe(original.smokeId);
    expect(loaded?.status).toBe(original.status);
    expect(loaded?.issues).toEqual(original.issues);
  });
});
