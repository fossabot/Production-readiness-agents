import { app } from 'electron';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { RuntimeAssetManifest } from '../types/release.js';

export interface ResolvedAssets {
  readonly libraryEntryPath: string;
  readonly workerEntryPath: string;
  readonly packaged: boolean;
  readonly sourceDistVersion: string;
}

/**
 * Resolves runtime assets for crew execution in both development and packaged modes.
 *
 * Development: resolves from repository root dist/ directory
 * Packaged: resolves from staged assets in the packaged app resources
 */
export function resolveRuntimeAssets(): ResolvedAssets {
  const isPackaged = app.isPackaged;

  if (isPackaged) {
    return resolvePackagedAssets();
  }

  return resolveDevelopmentAssets();
}

function resolveDevelopmentAssets(): ResolvedAssets {
  // In development, the root dist/ directory contains the built crew library
  const repoRoot = resolve(__dirname, '..', '..', '..', '..');
  const distDir = join(repoRoot, 'dist');
  const libraryEntry = join(distDir, 'index.js');
  const workerEntry = join(__dirname, '..', 'worker', 'crew-worker.js');

  if (!existsSync(libraryEntry)) {
    throw new AssetResolutionError(
      `Root crew library not found at ${libraryEntry}. Run 'npm run build' from the repository root first.`,
      libraryEntry,
    );
  }

  if (!existsSync(workerEntry)) {
    throw new AssetResolutionError(
      `Worker entry not found at ${workerEntry}. Run 'npm run build' from the desktop directory first.`,
      workerEntry,
    );
  }

  // Read version from the built package
  const packageJsonPath = join(repoRoot, 'package.json');
  let sourceDistVersion = 'unknown';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require(packageJsonPath);
    sourceDistVersion = pkg.version ?? 'unknown';
  } catch {
    // Version detection is best-effort in development
  }

  return {
    libraryEntryPath: libraryEntry,
    workerEntryPath: workerEntry,
    packaged: false,
    sourceDistVersion,
  };
}

function resolvePackagedAssets(): ResolvedAssets {
  // In packaged builds, assets are staged under the app's resource directory
  const resourcesPath = process.resourcesPath;
  const stagedDir = join(resourcesPath, 'crew-library');
  const libraryEntry = join(stagedDir, 'index.js');
  const workerEntry = join(resourcesPath, 'worker', 'crew-worker.js');

  if (!existsSync(libraryEntry)) {
    throw new AssetResolutionError(
      `Staged crew library not found at ${libraryEntry}. Ensure runtime assets were prepared before packaging.`,
      libraryEntry,
    );
  }

  if (!existsSync(workerEntry)) {
    throw new AssetResolutionError(
      `Packaged worker entry not found at ${workerEntry}. Ensure the desktop build completed successfully.`,
      workerEntry,
    );
  }

  // Read version from the staged manifest
  const manifestPath = join(stagedDir, 'manifest.json');
  let sourceDistVersion = 'unknown';
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const manifest = require(manifestPath);
    sourceDistVersion = manifest.sourceDistVersion ?? 'unknown';
  } catch {
    // Manifest read is best-effort
  }

  return {
    libraryEntryPath: libraryEntry,
    workerEntryPath: workerEntry,
    packaged: true,
    sourceDistVersion,
  };
}

export function createAssetManifest(
  resolved: ResolvedAssets,
  candidateId: string | null = null,
): RuntimeAssetManifest {
  return {
    manifestId: `manifest-${Date.now()}`,
    candidateId,
    generatedAt: new Date().toISOString(),
    libraryEntryPath: resolved.libraryEntryPath,
    workerEntryPath: resolved.workerEntryPath,
    packaged: resolved.packaged,
    sourceDistVersion: resolved.sourceDistVersion,
    copiedFiles: [],
  };
}

export class AssetResolutionError extends Error {
  readonly affectedPath: string;

  constructor(message: string, affectedPath: string) {
    super(message);
    this.name = 'AssetResolutionError';
    this.affectedPath = affectedPath;
  }
}
