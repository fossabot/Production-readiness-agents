import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Static mock for keytar — used in most tests where we do NOT need module
// isolation. vi.mock hoisting ensures this runs before any import of the
// credential-store module.
// ---------------------------------------------------------------------------

const mockGetPassword = vi.fn<[string, string], Promise<string | null>>();
const mockSetPassword = vi.fn<[string, string, string], Promise<void>>();
const mockDeletePassword = vi.fn<[string, string], Promise<boolean>>();

vi.mock('keytar', () => ({
  default: {
    getPassword: mockGetPassword,
    setPassword: mockSetPassword,
    deletePassword: mockDeletePassword,
  },
  getPassword: mockGetPassword,
  setPassword: mockSetPassword,
  deletePassword: mockDeletePassword,
}));

import { credentialStore, CREDENTIAL_ACCOUNTS } from '../credential-store.js';

// ---------------------------------------------------------------------------
// Constants mirrored from the implementation so tests are self-documenting
// ---------------------------------------------------------------------------

const SERVICE_NAME = 'production-readiness-desktop';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// credentialStore.get()
// ---------------------------------------------------------------------------

describe('credentialStore.get()', () => {
  it('calls keytar.getPassword with the correct service name and account', async () => {
    mockGetPassword.mockResolvedValueOnce('test-value');

    await credentialStore.get('openai-api-key');

    expect(mockGetPassword).toHaveBeenCalledOnce();
    expect(mockGetPassword).toHaveBeenCalledWith(SERVICE_NAME, 'openai-api-key');
  });

  it('returns null when no credential exists', async () => {
    mockGetPassword.mockResolvedValueOnce(null);

    const result = await credentialStore.get('anthropic-api-key');

    expect(result).toBeNull();
  });

  it('returns the stored string value when a credential exists', async () => {
    mockGetPassword.mockResolvedValueOnce('sk-abc123');

    const result = await credentialStore.get('openai-api-key');

    expect(result).toBe('sk-abc123');
  });
});

// ---------------------------------------------------------------------------
// credentialStore.set()
// ---------------------------------------------------------------------------

describe('credentialStore.set()', () => {
  it('calls keytar.setPassword with the correct service name, account, and password', async () => {
    mockSetPassword.mockResolvedValueOnce(undefined);

    await credentialStore.set('openai-api-key', 'sk-secret');

    expect(mockSetPassword).toHaveBeenCalledOnce();
    expect(mockSetPassword).toHaveBeenCalledWith(SERVICE_NAME, 'openai-api-key', 'sk-secret');
  });

  it('resolves without a value (void) on success', async () => {
    mockSetPassword.mockResolvedValueOnce(undefined);

    const result = await credentialStore.set('google-api-key', 'AIza-xyz');

    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// credentialStore.delete()
// ---------------------------------------------------------------------------

describe('credentialStore.delete()', () => {
  it('calls keytar.deletePassword with the correct service name and account', async () => {
    mockDeletePassword.mockResolvedValueOnce(true);

    await credentialStore.delete('openai-api-key');

    expect(mockDeletePassword).toHaveBeenCalledOnce();
    expect(mockDeletePassword).toHaveBeenCalledWith(SERVICE_NAME, 'openai-api-key');
  });

  it('returns true when the credential existed and was deleted', async () => {
    mockDeletePassword.mockResolvedValueOnce(true);

    const result = await credentialStore.delete('openai-api-key');

    expect(result).toBe(true);
  });

  it('returns false when the credential did not exist', async () => {
    mockDeletePassword.mockResolvedValueOnce(false);

    const result = await credentialStore.delete('non-existent-account');

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: set() then get() returns the same value (via the mock)
// ---------------------------------------------------------------------------

describe('round-trip: set then get', () => {
  it('get() returns the value that was previously set()', async () => {
    const password = 'super-secret-key';

    // Simulate the system storing and later retrieving the password
    mockSetPassword.mockResolvedValueOnce(undefined);
    mockGetPassword.mockResolvedValueOnce(password);

    await credentialStore.set('anthropic-api-key', password);
    const retrieved = await credentialStore.get('anthropic-api-key');

    expect(retrieved).toBe(password);
    expect(mockSetPassword).toHaveBeenCalledWith(SERVICE_NAME, 'anthropic-api-key', password);
    expect(mockGetPassword).toHaveBeenCalledWith(SERVICE_NAME, 'anthropic-api-key');
  });
});

// ---------------------------------------------------------------------------
// CREDENTIAL_ACCOUNTS shape
// ---------------------------------------------------------------------------

describe('CREDENTIAL_ACCOUNTS', () => {
  it('contains the OPENAI_API_KEY account name', () => {
    expect(CREDENTIAL_ACCOUNTS.OPENAI_API_KEY).toBe('openai-api-key');
  });

  it('contains the ANTHROPIC_API_KEY account name', () => {
    expect(CREDENTIAL_ACCOUNTS.ANTHROPIC_API_KEY).toBe('anthropic-api-key');
  });

  it('contains the GOOGLE_API_KEY account name', () => {
    expect(CREDENTIAL_ACCOUNTS.GOOGLE_API_KEY).toBe('google-api-key');
  });

  it('exposes exactly three account keys', () => {
    expect(Object.keys(CREDENTIAL_ACCOUNTS)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Keytar lazy-loading (module isolation tests)
//
// These tests use vi.resetModules() + dynamic import to get a fresh module
// instance so the module-level `keytarModule` variable is reset to null,
// enabling isolation of the lazy-load behaviour.
// ---------------------------------------------------------------------------

describe('keytar lazy loading', () => {
  it('imports keytar only once across multiple calls', async () => {
    // Track how many times the keytar module factory is called.
    let importCount = 0;

    vi.resetModules();

    vi.doMock('keytar', () => {
      importCount += 1;
      return {
        default: {
          getPassword: vi.fn().mockResolvedValue('value'),
          setPassword: vi.fn().mockResolvedValue(undefined),
          deletePassword: vi.fn().mockResolvedValue(true),
        },
        getPassword: vi.fn().mockResolvedValue('value'),
        setPassword: vi.fn().mockResolvedValue(undefined),
        deletePassword: vi.fn().mockResolvedValue(true),
      };
    });

    const { credentialStore: freshStore } = await import('../credential-store.js');

    await freshStore.get('openai-api-key');
    await freshStore.get('openai-api-key');
    await freshStore.set('anthropic-api-key', 'secret');

    // The dynamic import of keytar should have happened exactly once even
    // though we called three store methods.
    expect(importCount).toBe(1);

    vi.doUnmock('keytar');
  });
});

// ---------------------------------------------------------------------------
// Error handling: keytar unavailable
// ---------------------------------------------------------------------------

describe('when keytar is unavailable', () => {
  it('throws a descriptive error mentioning keytar and the native module', async () => {
    vi.resetModules();

    vi.doMock('keytar', () => {
      throw new Error('Cannot find module');
    });

    const { credentialStore: freshStore } = await import('../credential-store.js');

    await expect(freshStore.get('openai-api-key')).rejects.toThrow(
      'keytar is not available',
    );

    vi.doUnmock('keytar');
  });

  it('error message mentions the Electron version requirement', async () => {
    vi.resetModules();

    vi.doMock('keytar', () => {
      throw new Error('Cannot find module');
    });

    const { credentialStore: freshStore } = await import('../credential-store.js');

    await expect(freshStore.get('openai-api-key')).rejects.toThrow(
      /Electron/,
    );

    vi.doUnmock('keytar');
  });
});
