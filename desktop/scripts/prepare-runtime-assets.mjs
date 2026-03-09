#!/usr/bin/env node

/**
 * Prepare runtime assets for packaged desktop builds.
 *
 * This script copies the root crew library's dist/ output into the desktop
 * build's resource staging area so that packaged Electron builds can find
 * the library at runtime without depending on the repository root.
 *
 * Usage: node scripts/prepare-runtime-assets.mjs [--check-only]
 */

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const DESKTOP_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(DESKTOP_ROOT, '..');
const ROOT_DIST = join(REPO_ROOT, 'dist');
const ROOT_PKG = join(REPO_ROOT, 'package.json');
const STAGING_DIR = join(DESKTOP_ROOT, 'resources', 'crew-library');
const MANIFEST_PATH = join(STAGING_DIR, 'manifest.json');

async function main() {
  const checkOnly = process.argv.includes('--check-only');

  // Verify root dist/ exists
  if (!existsSync(ROOT_DIST)) {
    console.error(`ERROR: Root dist/ directory not found at ${ROOT_DIST}`);
    console.error('Run "npm run build" from the repository root first.');
    process.exit(1);
  }

  const entryPath = join(ROOT_DIST, 'index.js');
  if (!existsSync(entryPath)) {
    console.error(`ERROR: Library entry point not found at ${entryPath}`);
    process.exit(1);
  }

  // Read source version
  let sourceVersion = 'unknown';
  try {
    const pkg = JSON.parse(readFileSync(ROOT_PKG, 'utf-8'));
    sourceVersion = pkg.version ?? 'unknown';
  } catch {
    console.warn('WARNING: Could not read root package.json version');
  }

  if (checkOnly) {
    console.log(JSON.stringify({
      rootDistExists: true,
      entryPointExists: true,
      sourceVersion,
      stagingDir: STAGING_DIR,
      staged: existsSync(STAGING_DIR),
    }, null, 2));
    return;
  }

  // Stage assets
  console.log(`Staging crew library assets from ${ROOT_DIST} to ${STAGING_DIR}...`);

  if (existsSync(STAGING_DIR)) {
    // Clean previous staging
    const { rmSync } = await import('node:fs');
    rmSync(STAGING_DIR, { recursive: true, force: true });
  }

  mkdirSync(STAGING_DIR, { recursive: true });

  // Copy dist/ contents to staging
  cpSync(ROOT_DIST, STAGING_DIR, { recursive: true });

  // Write manifest
  const manifest = {
    manifestId: `manifest-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    sourceDistVersion: sourceVersion,
    libraryEntryPath: join(STAGING_DIR, 'index.js'),
    workerEntryPath: 'resources/worker/crew-worker.js',
    packaged: true,
    copiedFiles: [],
  };

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`Staged ${sourceVersion} crew library to ${STAGING_DIR}`);
  console.log(`Manifest written to ${MANIFEST_PATH}`);
}

main();
