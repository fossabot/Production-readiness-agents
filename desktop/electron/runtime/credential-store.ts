const SERVICE_NAME = 'production-readiness-desktop';

export interface CredentialStore {
  get(account: string): Promise<string | null>;
  set(account: string, password: string): Promise<void>;
  delete(account: string): Promise<boolean>;
}

let keytarModule: typeof import('keytar') | null = null;

async function getKeytar(): Promise<typeof import('keytar')> {
  if (!keytarModule) {
    try {
      keytarModule = await import('keytar');
    } catch {
      throw new Error(
        'keytar is not available. Ensure the keytar native module is installed and compiled for this Electron version.',
      );
    }
  }
  return keytarModule;
}

export const credentialStore: CredentialStore = {
  async get(account: string): Promise<string | null> {
    const keytar = await getKeytar();
    return keytar.getPassword(SERVICE_NAME, account);
  },

  async set(account: string, password: string): Promise<void> {
    const keytar = await getKeytar();
    await keytar.setPassword(SERVICE_NAME, account, password);
  },

  async delete(account: string): Promise<boolean> {
    const keytar = await getKeytar();
    return keytar.deletePassword(SERVICE_NAME, account);
  },
};

export const CREDENTIAL_ACCOUNTS = {
  OPENAI_API_KEY: 'openai-api-key',
  ANTHROPIC_API_KEY: 'anthropic-api-key',
  GOOGLE_API_KEY: 'google-api-key',
} as const;

export type CredentialAccount = (typeof CREDENTIAL_ACCOUNTS)[keyof typeof CREDENTIAL_ACCOUNTS];
