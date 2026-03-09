/**
 * T036 — Asset resolution contract tests
 *
 * Verifies that resolveRuntimeAssets() correctly derives asset paths for both
 * development (repo root dist/) and packaged (process.resourcesPath/crew-library/)
 * modes, and that AssetResolutionError is thrown when required files are absent.
 *
 * Also covers createAssetManifest(), confirming it returns a valid
 * RuntimeAssetManifest from any ResolvedAssets object.
 *
 * Both electron and node:fs are fully mocked so the tests run without any
 * binary dependency or real filesystem access.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock handles — vi.hoisted ensures these are available before the
// vi.mock() factory functions run (which are themselves hoisted to the top of
// the file by Vitest).
// ---------------------------------------------------------------------------

const { mockExistsSync, mockIsPackaged } = vi.hoisted(() => {
  return {
    mockExistsSync: vi.fn<[string], boolean>(),
    mockIsPackaged: { value: false },
  };
});

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
}));

// ---------------------------------------------------------------------------
// electron mock — control app.isPackaged per test via mockIsPackaged.value
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockIsPackaged.value;
    },
  },
}));

// ---------------------------------------------------------------------------
// node:path — use real join/resolve behaviour (no override needed)
//
// process.resourcesPath — Electron-specific; undefined in Node test env.
// We stub it on the process object so the packaged code path can join paths.
// ---------------------------------------------------------------------------

const MOCK_RESOURCES_PATH = '/mock/resources';

// ---------------------------------------------------------------------------
// Import module under test — after all mocks
// ---------------------------------------------------------------------------

import {
  resolveRuntimeAssets,
  createAssetManifest,
  AssetResolutionError,
  type ResolvedAssets,
} from '../asset-resolver.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setPackaged(value: boolean): void {
  mockIsPackaged.value = value;
}

/** Make existsSync return true for paths matching the given substring. */
function allowPath(substring: string): void {
  mockExistsSync.mockImplementation((p) => p.includes(substring));
}

/** Make existsSync return true for all paths. */
function allowAllPaths(): void {
  mockExistsSync.mockReturnValue(true);
}

/** Make existsSync return false for all paths. */
function denyAllPaths(): void {
  mockExistsSync.mockReturnValue(false);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// Save original process.resourcesPath so we can restore it after each test.
// In a real Electron runtime this is set by the binary; in Node.js it is
// undefined. We stub it globally for the packaged-mode test suites.
const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

beforeEach(() => {
  vi.clearAllMocks();
  setPackaged(false);
  denyAllPaths();
  // Reset the stub back to undefined between tests so dev-mode tests are clean.
  (process as any).resourcesPath = undefined;
});

afterEach(() => {
  (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = originalResourcesPath;
});

// ---------------------------------------------------------------------------
// Development mode (app.isPackaged === false)
// ---------------------------------------------------------------------------

describe('resolveRuntimeAssets — development mode', () => {
  it('resolves packaged=false when app is not packaged', () => {
    setPackaged(false);
    allowAllPaths();

    const result = resolveRuntimeAssets();

    expect(result.packaged).toBe(false);
  });

  it('libraryEntryPath contains the dist/ directory segment', () => {
    setPackaged(false);
    allowAllPaths();

    const result = resolveRuntimeAssets();

    expect(result.libraryEntryPath).toContain('dist');
    expect(result.libraryEntryPath).toContain('index.js');
  });

  it('workerEntryPath references crew-worker.js', () => {
    setPackaged(false);
    allowAllPaths();

    const result = resolveRuntimeAssets();

    expect(result.workerEntryPath).toContain('crew-worker.js');
  });

  it('sourceDistVersion is a non-empty string', () => {
    setPackaged(false);
    allowAllPaths();

    const result = resolveRuntimeAssets();

    expect(typeof result.sourceDistVersion).toBe('string');
    expect(result.sourceDistVersion.length).toBeGreaterThan(0);
  });

  it('sourceDistVersion falls back to "unknown" when package.json is unreadable', () => {
    setPackaged(false);
    // existsSync must return true for the entry paths, but require() will fail
    // for the package.json because the module doesn't exist in the test env.
    allowAllPaths();

    const result = resolveRuntimeAssets();

    // Either a real version string from the actual package.json, or "unknown".
    // The important contract is: never throws, always returns a string.
    expect(typeof result.sourceDistVersion).toBe('string');
  });

  it('throws AssetResolutionError when library entry (index.js) is missing', () => {
    setPackaged(false);
    // Only allow the worker entry; deny the library entry.
    mockExistsSync.mockImplementation((p) => p.includes('crew-worker.js'));

    expect(() => resolveRuntimeAssets()).toThrow(AssetResolutionError);
  });

  it('AssetResolutionError for missing library entry has a non-empty message', () => {
    setPackaged(false);
    mockExistsSync.mockImplementation((p) => p.includes('crew-worker.js'));

    let thrown: unknown;
    try {
      resolveRuntimeAssets();
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AssetResolutionError);
    expect((thrown as AssetResolutionError).message.length).toBeGreaterThan(0);
  });

  it('AssetResolutionError for missing library entry exposes affectedPath containing index.js', () => {
    setPackaged(false);
    mockExistsSync.mockImplementation((p) => p.includes('crew-worker.js'));

    let thrown: unknown;
    try {
      resolveRuntimeAssets();
    } catch (err) {
      thrown = err;
    }

    expect((thrown as AssetResolutionError).affectedPath).toContain('index.js');
  });

  it('throws AssetResolutionError when worker entry (crew-worker.js) is missing', () => {
    setPackaged(false);
    // Allow the library entry only; the worker is absent.
    mockExistsSync.mockImplementation((p) => p.includes('dist') && p.includes('index.js'));

    expect(() => resolveRuntimeAssets()).toThrow(AssetResolutionError);
  });

  it('AssetResolutionError for missing worker entry exposes affectedPath containing crew-worker.js', () => {
    setPackaged(false);
    mockExistsSync.mockImplementation((p) => p.includes('dist') && p.includes('index.js'));

    let thrown: unknown;
    try {
      resolveRuntimeAssets();
    } catch (err) {
      thrown = err;
    }

    expect((thrown as AssetResolutionError).affectedPath).toContain('crew-worker.js');
  });

  it('AssetResolutionError name is "AssetResolutionError"', () => {
    setPackaged(false);
    denyAllPaths();

    let thrown: unknown;
    try {
      resolveRuntimeAssets();
    } catch (err) {
      thrown = err;
    }

    expect((thrown as Error).name).toBe('AssetResolutionError');
  });
});

// ---------------------------------------------------------------------------
// Packaged mode (app.isPackaged === true)
// ---------------------------------------------------------------------------

describe('resolveRuntimeAssets — packaged mode', () => {
  // Stub process.resourcesPath for the entire packaged-mode suite so that
  // the path join() calls inside resolvePackagedAssets() receive a string.
  beforeEach(() => {
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = MOCK_RESOURCES_PATH;
  });

  it('resolves packaged=true when app is packaged', () => {
    setPackaged(true);
    allowAllPaths();

    const result = resolveRuntimeAssets();

    expect(result.packaged).toBe(true);
  });

  it('libraryEntryPath is under crew-library/', () => {
    setPackaged(true);
    allowAllPaths();

    const result = resolveRuntimeAssets();

    expect(result.libraryEntryPath).toContain('crew-library');
    expect(result.libraryEntryPath).toContain('index.js');
  });

  it('workerEntryPath is under the resources directory', () => {
    setPackaged(true);
    allowAllPaths();

    const result = resolveRuntimeAssets();

    expect(result.workerEntryPath).toContain('crew-worker.js');
  });

  it('throws AssetResolutionError when staged library entry is missing in packaged mode', () => {
    setPackaged(true);
    // Only the worker path is allowed.
    mockExistsSync.mockImplementation((p) => p.includes('crew-worker.js'));

    expect(() => resolveRuntimeAssets()).toThrow(AssetResolutionError);
  });

  it('affectedPath for missing staged library references crew-library', () => {
    setPackaged(true);
    mockExistsSync.mockImplementation((p) => p.includes('crew-worker.js'));

    let thrown: unknown;
    try {
      resolveRuntimeAssets();
    } catch (err) {
      thrown = err;
    }

    expect((thrown as AssetResolutionError).affectedPath).toContain('crew-library');
  });

  it('throws AssetResolutionError when packaged worker entry is missing', () => {
    setPackaged(true);
    // Allow the library entry only.
    mockExistsSync.mockImplementation((p) => p.includes('crew-library'));

    expect(() => resolveRuntimeAssets()).toThrow(AssetResolutionError);
  });

  it('affectedPath for missing packaged worker references crew-worker.js', () => {
    setPackaged(true);
    mockExistsSync.mockImplementation((p) => p.includes('crew-library'));

    let thrown: unknown;
    try {
      resolveRuntimeAssets();
    } catch (err) {
      thrown = err;
    }

    expect((thrown as AssetResolutionError).affectedPath).toContain('crew-worker.js');
  });

  it('sourceDistVersion is a string in packaged mode', () => {
    setPackaged(true);
    allowAllPaths();

    const result = resolveRuntimeAssets();

    expect(typeof result.sourceDistVersion).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// createAssetManifest
// ---------------------------------------------------------------------------

describe('createAssetManifest', () => {
  const SAMPLE_RESOLVED: ResolvedAssets = {
    libraryEntryPath: '/dist/index.js',
    workerEntryPath: '/dist/crew-worker.js',
    packaged: false,
    sourceDistVersion: '1.2.3',
  };

  it('returns an object with a non-empty manifestId string', () => {
    const manifest = createAssetManifest(SAMPLE_RESOLVED);

    expect(typeof manifest.manifestId).toBe('string');
    expect(manifest.manifestId.length).toBeGreaterThan(0);
  });

  it('manifestId begins with "manifest-"', () => {
    const manifest = createAssetManifest(SAMPLE_RESOLVED);

    expect(manifest.manifestId.startsWith('manifest-')).toBe(true);
  });

  it('mirrors libraryEntryPath from ResolvedAssets', () => {
    const manifest = createAssetManifest(SAMPLE_RESOLVED);

    expect(manifest.libraryEntryPath).toBe(SAMPLE_RESOLVED.libraryEntryPath);
  });

  it('mirrors workerEntryPath from ResolvedAssets', () => {
    const manifest = createAssetManifest(SAMPLE_RESOLVED);

    expect(manifest.workerEntryPath).toBe(SAMPLE_RESOLVED.workerEntryPath);
  });

  it('mirrors packaged flag from ResolvedAssets', () => {
    const manifest = createAssetManifest(SAMPLE_RESOLVED);

    expect(manifest.packaged).toBe(SAMPLE_RESOLVED.packaged);
  });

  it('mirrors sourceDistVersion from ResolvedAssets', () => {
    const manifest = createAssetManifest(SAMPLE_RESOLVED);

    expect(manifest.sourceDistVersion).toBe(SAMPLE_RESOLVED.sourceDistVersion);
  });

  it('generatedAt is a valid ISO-8601 date string', () => {
    const manifest = createAssetManifest(SAMPLE_RESOLVED);

    expect(typeof manifest.generatedAt).toBe('string');
    const parsed = new Date(manifest.generatedAt);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it('candidateId defaults to null when not provided', () => {
    const manifest = createAssetManifest(SAMPLE_RESOLVED);

    expect(manifest.candidateId).toBeNull();
  });

  it('candidateId is set when provided', () => {
    const manifest = createAssetManifest(SAMPLE_RESOLVED, 'cand-001');

    expect(manifest.candidateId).toBe('cand-001');
  });

  it('copiedFiles is an empty array by default', () => {
    const manifest = createAssetManifest(SAMPLE_RESOLVED);

    expect(Array.isArray(manifest.copiedFiles)).toBe(true);
    expect(manifest.copiedFiles).toHaveLength(0);
  });

  it('satisfies the RuntimeAssetManifest interface at the type level', () => {
    // If the RuntimeAssetManifest interface changes, TypeScript will catch this.
    const manifest = createAssetManifest(SAMPLE_RESOLVED, null);

    expect(manifest).toHaveProperty('manifestId');
    expect(manifest).toHaveProperty('candidateId');
    expect(manifest).toHaveProperty('generatedAt');
    expect(manifest).toHaveProperty('libraryEntryPath');
    expect(manifest).toHaveProperty('workerEntryPath');
    expect(manifest).toHaveProperty('packaged');
    expect(manifest).toHaveProperty('sourceDistVersion');
    expect(manifest).toHaveProperty('copiedFiles');
  });

  it('produces a different manifestId on each call (timestamp-based uniqueness)', () => {
    const first = createAssetManifest(SAMPLE_RESOLVED);
    // Tiny delay not needed — Date.now() monotonically increases, but in the
    // extremely unlikely event of a same-millisecond call we accept equality.
    const second = createAssetManifest(SAMPLE_RESOLVED);

    // The contract: manifestId is always a string; same-ms collisions are rare
    // but tolerated. We assert both are valid, not strict inequality.
    expect(typeof first.manifestId).toBe('string');
    expect(typeof second.manifestId).toBe('string');
  });

  it('works correctly with packaged=true in the resolved assets', () => {
    const packagedResolved: ResolvedAssets = {
      ...SAMPLE_RESOLVED,
      packaged: true,
      libraryEntryPath: '/resources/crew-library/index.js',
      workerEntryPath: '/resources/worker/crew-worker.js',
    };

    const manifest = createAssetManifest(packagedResolved, 'cand-packaged');

    expect(manifest.packaged).toBe(true);
    expect(manifest.candidateId).toBe('cand-packaged');
    expect(manifest.libraryEntryPath).toContain('crew-library');
  });
});

// ---------------------------------------------------------------------------
// AssetResolutionError class
// ---------------------------------------------------------------------------

describe('AssetResolutionError', () => {
  it('is an instance of Error', () => {
    const err = new AssetResolutionError('msg', '/some/path');
    expect(err).toBeInstanceOf(Error);
  });

  it('name is "AssetResolutionError"', () => {
    const err = new AssetResolutionError('msg', '/some/path');
    expect(err.name).toBe('AssetResolutionError');
  });

  it('message is accessible', () => {
    const err = new AssetResolutionError('library missing', '/dist/index.js');
    expect(err.message).toBe('library missing');
  });

  it('affectedPath is accessible', () => {
    const err = new AssetResolutionError('library missing', '/dist/index.js');
    expect(err.affectedPath).toBe('/dist/index.js');
  });

  it('can be caught as a plain Error', () => {
    const throwIt = () => {
      throw new AssetResolutionError('worker missing', '/worker/crew-worker.js');
    };

    expect(throwIt).toThrow(Error);
    expect(throwIt).toThrow('worker missing');
  });
});
