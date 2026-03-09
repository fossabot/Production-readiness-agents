import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Electron IPC bridge (window.electronAPI)
const mockElectronAPI = {
  startRun: vi.fn(),
  cancelRun: vi.fn(),
  getRun: vi.fn(),
  listRuns: vi.fn(),
  getReport: vi.fn(),
  exportReport: vi.fn(),
  deleteRun: vi.fn(),
  onWorkerEvent: vi.fn(() => vi.fn()),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  getModelPolicy: vi.fn(),
  listModelPolicies: vi.fn(),
};

// Only define window.electronAPI in browser-like (jsdom) environments
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true,
  });
}

// Mock app.getPath for Node test environment
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/tmp/test-userData';
      return `/tmp/test-${name}`;
    }),
    getName: vi.fn(() => 'production-readiness-desktop'),
    getVersion: vi.fn(() => '0.1.0'),
    isPackaged: false,
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));
