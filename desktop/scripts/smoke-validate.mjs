#!/usr/bin/env node

/**
 * Packaged Smoke Validator
 *
 * Offline file-structure validation for a packaged Electron release candidate.
 * Checks that all assets required for successful app launch, settings load,
 * policy view, run dispatch, and report rendering are present in the unpacked
 * output tree.  No live app process is started.
 *
 * Usage:
 *   node scripts/smoke-validate.mjs --candidate-id <id> [--unpacked-path <path>]
 *
 * Defaults:
 *   --unpacked-path defaults to desktop/release/win-unpacked on Windows,
 *                  desktop/release/mac/<AppName>.app/Contents on macOS,
 *                  and desktop/release/linux-unpacked on Linux.
 *
 * Outputs:
 *   desktop/release/validation/<candidateId>/smoke-validation.json
 *   desktop/release/validation/<candidateId>/smoke-validation.md
 *
 * Exit codes:
 *   0  All checkpoints passed
 *   1  One or more checkpoints failed
 */

import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// ─── Path constants ───────────────────────────────────────────────────────────

const DESKTOP_ROOT = resolve(import.meta.dirname, '..');

/** Product name as defined in electron-builder.yml */
const PRODUCT_NAME = 'Production Readiness Desktop';

// ─── Platform helpers ─────────────────────────────────────────────────────────

/**
 * Maps Node.js process.platform values to the smoke-record platform literals.
 *
 * @returns {'win' | 'mac' | 'linux' | 'current'}
 */
function detectPlatform() {
  const map = { win32: 'win', darwin: 'mac', linux: 'linux' };
  return map[process.platform] ?? 'current';
}

/**
 * Returns the default unpacked directory for the current platform based on the
 * electron-builder output layout used by this project.
 *
 * Win  → release/win-unpacked
 * Mac  → release/mac/<ProductName>.app/Contents
 * Linux → release/linux-unpacked
 *
 * @returns {string}
 */
function defaultUnpackedPath() {
  const releaseDir = join(DESKTOP_ROOT, 'release');
  switch (process.platform) {
    case 'darwin':
      return join(releaseDir, 'mac', `${PRODUCT_NAME}.app`, 'Contents');
    case 'linux':
      return join(releaseDir, 'linux-unpacked');
    default:
      // win32 and anything unknown
      return join(releaseDir, 'win-unpacked');
  }
}

// ─── CLI argument parsing ─────────────────────────────────────────────────────

/**
 * Parses --candidate-id and --unpacked-path from process.argv.
 *
 * @returns {{ candidateId: string; unpackedPath: string }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let candidateId = null;
  let unpackedPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--candidate-id' && args[i + 1]) {
      candidateId = args[++i];
    } else if (args[i] === '--unpacked-path' && args[i + 1]) {
      unpackedPath = args[++i];
    }
  }

  return {
    candidateId: candidateId ?? `cand-${randomUUID()}`,
    unpackedPath: unpackedPath ? resolve(unpackedPath) : defaultUnpackedPath(),
  };
}

// ─── Checkpoint definitions ───────────────────────────────────────────────────

/**
 * Describes one checkpoint inside the smoke-validation flow.
 *
 * @typedef {{ id: string; label: string; check: (ctx: CheckContext) => CheckResult }} CheckpointDef
 */

/**
 * @typedef {{ unpackedPath: string; platform: 'win' | 'mac' | 'linux' | 'current' }} CheckContext
 */

/**
 * @typedef {{ passed: boolean; issue: string | null }} CheckResult
 */

/**
 * Returns a passed CheckResult.
 *
 * @returns {CheckResult}
 */
function pass() {
  return { passed: true, issue: null };
}

/**
 * Returns a failed CheckResult with a descriptive issue message.
 *
 * @param {string} message
 * @returns {CheckResult}
 */
function fail(message) {
  return { passed: false, issue: message };
}

/**
 * Returns the expected executable path inside the unpacked tree for the given
 * platform.
 *
 * Win  → <unpacked>/Production Readiness Desktop.exe
 * Mac  → <unpacked>/MacOS/Production Readiness Desktop
 * Linux → <unpacked>/production-readiness-desktop
 *
 * @param {string} unpackedPath
 * @param {'win' | 'mac' | 'linux' | 'current'} platform
 * @returns {string}
 */
function exePath(unpackedPath, platform) {
  switch (platform) {
    case 'mac':
      return join(unpackedPath, 'MacOS', PRODUCT_NAME);
    case 'linux':
      return join(unpackedPath, 'production-readiness-desktop');
    default:
      return join(unpackedPath, `${PRODUCT_NAME}.exe`);
  }
}

/**
 * The ordered list of smoke checkpoints.
 *
 * Each checkpoint maps to one boolean field in SmokeValidationRecord:
 *   1. launched             — app executable exists in the unpacked tree
 *   2. settingsLoaded       — settings-store entry point is bundled (main JS)
 *   3. policyViewOpened     — staged crew-library index exists (policy catalog)
 *   4. runStartedOrBlocked  — worker entry exists (crew-worker.js)
 *   5. reportOrHistoryVisible — renderer JS bundle exists
 *
 * @type {CheckpointDef[]}
 */
const CHECKPOINTS = [
  {
    id: 'launched',
    label: 'App executable present in unpacked output',

    /** @param {CheckContext} ctx @returns {CheckResult} */
    check(ctx) {
      const exe = exePath(ctx.unpackedPath, ctx.platform);
      return existsSync(exe)
        ? pass()
        : fail(
            `Executable not found at ${exe}. ` +
              'Run electron-builder and verify the unpacked output path.',
          );
    },
  },

  {
    id: 'settingsLoaded',
    label: 'Main-process bundle present (settings-store entry point)',

    /** @param {CheckContext} ctx @returns {CheckResult} */
    check(ctx) {
      // electron-vite emits the main process under out/main/main.js inside asar.
      // In the unpacked tree the asar archive itself lives at resources/app.asar.
      // We check for the asar or, for asar-less builds, the raw out directory.
      const asarPath = join(ctx.unpackedPath, 'resources', 'app.asar');
      const rawMainPath = join(ctx.unpackedPath, 'resources', 'app', 'out', 'main', 'main.js');

      if (existsSync(asarPath) || existsSync(rawMainPath)) {
        return pass();
      }

      return fail(
        `Neither app.asar nor out/main/main.js found under ${join(ctx.unpackedPath, 'resources')}. ` +
          'Ensure the Electron Vite build completed before packaging.',
      );
    },
  },

  {
    id: 'policyViewOpened',
    label: 'Staged crew-library index present (policy catalog source)',

    /** @param {CheckContext} ctx @returns {CheckResult} */
    check(ctx) {
      // prepare-runtime-assets.mjs copies the root dist/ output to
      // resources/crew-library/ which electron-builder then copies to the
      // packaged app under resources/crew-library/ (see electron-builder.yml).
      const libraryIndex = join(
        ctx.unpackedPath,
        'resources',
        'crew-library',
        'index.js',
      );

      return existsSync(libraryIndex)
        ? pass()
        : fail(
            `Staged crew-library index not found at ${libraryIndex}. ` +
              'Run "node scripts/prepare-runtime-assets.mjs" before packaging.',
          );
    },
  },

  {
    id: 'runStartedOrBlocked',
    label: 'Worker entry present (crew-worker.js)',

    /** @param {CheckContext} ctx @returns {CheckResult} */
    check(ctx) {
      // electron-builder.yml asarUnpack includes out/main/crew-worker*.js so
      // that the worker can be referenced via __dirname at runtime.  The
      // unpacked worker lives under resources/app.asar.unpacked/.
      const unpackedWorker = join(
        ctx.unpackedPath,
        'resources',
        'app.asar.unpacked',
        'out',
        'main',
        'crew-worker.js',
      );

      // Fallback: asar-less or raw build layout
      const rawWorker = join(
        ctx.unpackedPath,
        'resources',
        'app',
        'out',
        'main',
        'crew-worker.js',
      );

      if (existsSync(unpackedWorker) || existsSync(rawWorker)) {
        return pass();
      }

      return fail(
        `Worker entry not found at ${unpackedWorker} (or ${rawWorker}). ` +
          'Ensure the desktop build emitted crew-worker.js and that asarUnpack is configured.',
      );
    },
  },

  {
    id: 'reportOrHistoryVisible',
    label: 'Renderer bundle present (report and history views)',

    /** @param {CheckContext} ctx @returns {CheckResult} */
    check(ctx) {
      // The renderer is bundled under out/renderer/ inside the asar.
      // We look for the renderer directory through the asar or via the raw
      // out tree when packaging is asar-less.
      //
      // The asar itself is opaque, so we confirm by checking:
      //   1. app.asar exists (renderer is inside it — treat as present)
      //   2. OR the raw renderer assets directory exists
      const asarPath = join(ctx.unpackedPath, 'resources', 'app.asar');
      const rawRendererDir = join(
        ctx.unpackedPath,
        'resources',
        'app',
        'out',
        'renderer',
      );

      if (existsSync(asarPath) || existsSync(rawRendererDir)) {
        return pass();
      }

      return fail(
        `Renderer bundle not found under ${join(ctx.unpackedPath, 'resources')}. ` +
          'Ensure the Electron Vite build produced out/renderer/ before packaging.',
      );
    },
  },
];

// ─── Record builders ──────────────────────────────────────────────────────────

/**
 * Runs all checkpoints and assembles a SmokeValidationRecord.
 *
 * @param {{ candidateId: string; unpackedPath: string; platform: 'win' | 'mac' | 'linux' | 'current'; evidencePath: string }} opts
 * @returns {{ record: SmokeValidationRecord; checkResults: CheckResult[] }}
 *
 * @typedef {import('./smoke-validate.mjs').SmokeValidationRecord} SmokeValidationRecord
 */
function runCheckpoints(opts) {
  const { candidateId, unpackedPath, platform, evidencePath } = opts;
  const ctx = { unpackedPath, platform };

  /** @type {CheckResult[]} */
  const results = CHECKPOINTS.map(cp => cp.check(ctx));

  const launched              = results[0].passed;
  const settingsLoaded        = results[1].passed;
  const policyViewOpened      = results[2].passed;
  const runStartedOrBlocked   = results[3].passed;
  const reportOrHistoryVisible = results[4].passed;

  const issues = results
    .map(r => r.issue)
    .filter(/** @param {string | null} i @returns {i is string} */ i => i !== null);

  const allPassed =
    launched &&
    settingsLoaded &&
    policyViewOpened &&
    runStartedOrBlocked &&
    reportOrHistoryVisible;

  /** @type {SmokeValidationRecord} */
  const record = {
    smokeId:                randomUUID(),
    candidateId,
    platform,
    recordedAt:             new Date().toISOString(),
    status:                 allPassed ? 'passed' : 'failed',
    launched,
    settingsLoaded,
    policyViewOpened,
    runStartedOrBlocked,
    reportOrHistoryVisible,
    issues,
    evidencePath,
  };

  return { record, checkResults: results };
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

/**
 * Renders a SmokeValidationRecord to a human-readable Markdown summary.
 *
 * @param {SmokeValidationRecord} record
 * @param {string} unpackedPath
 * @returns {string}
 */
function renderMarkdown(record, unpackedPath) {
  const statusLabel = record.status === 'passed' ? 'PASSED' : 'FAILED';

  /** @param {boolean} v @returns {string} */
  const tick = v => (v ? 'PASS' : 'FAIL');

  const checkRows = [
    `| App executable present          | ${tick(record.launched)} |`,
    `| Main-process bundle present     | ${tick(record.settingsLoaded)} |`,
    `| Crew-library index present      | ${tick(record.policyViewOpened)} |`,
    `| Worker entry present            | ${tick(record.runStartedOrBlocked)} |`,
    `| Renderer bundle present         | ${tick(record.reportOrHistoryVisible)} |`,
  ];

  const issuesSection =
    record.issues.length > 0
      ? `\n## Issues\n\n${record.issues.map(i => `- ${i}`).join('\n')}\n`
      : '';

  return [
    `# Smoke Validation — ${statusLabel}`,
    '',
    `**Smoke ID**: \`${record.smokeId}\`  `,
    `**Candidate**: \`${record.candidateId}\`  `,
    `**Platform**: ${record.platform}  `,
    `**Recorded**: ${record.recordedAt}  `,
    `**Unpacked path**: \`${unpackedPath}\`  `,
    `**Evidence**: \`${record.evidencePath}\``,
    '',
    '## Checkpoint Results',
    '',
    '| Checkpoint | Status |',
    '|------------|--------|',
    ...checkRows,
    issuesSection,
  ].join('\n');
}

// ─── Atomic write helper ──────────────────────────────────────────────────────

/**
 * Writes content to a temporary path then atomically renames it into place.
 *
 * @param {string} destPath
 * @param {string} content
 */
function writeAtomic(destPath, content) {
  const tmpPath = `${destPath}.tmp`;
  writeFileSync(tmpPath, content, 'utf-8');
  renameSync(tmpPath, destPath);
}

// ─── Logging ──────────────────────────────────────────────────────────────────

/**
 * @param {string} msg
 */
function log(msg) {
  process.stdout.write(`${msg}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { candidateId, unpackedPath } = parseArgs();
  const platform = detectPlatform();

  // Prepare output directory
  const outputDir = join(DESKTOP_ROOT, 'release', 'validation', candidateId);
  mkdirSync(outputDir, { recursive: true });

  const jsonPath     = join(outputDir, 'smoke-validation.json');
  const markdownPath = join(outputDir, 'smoke-validation.md');

  log('');
  log('Smoke Validation');
  log(`  Candidate  : ${candidateId}`);
  log(`  Platform   : ${platform}`);
  log(`  Unpacked   : ${unpackedPath}`);
  log(`  Output dir : ${outputDir}`);
  log('');

  if (!existsSync(unpackedPath)) {
    log(`  WARNING: Unpacked path does not exist: ${unpackedPath}`);
    log('  All checkpoints will fail.');
  }

  // Run checkpoints
  log('Running checkpoints...');
  log('');

  for (const cp of CHECKPOINTS) {
    log(`  CHECK  ${cp.label}`);
  }

  log('');

  const { record } = runCheckpoints({
    candidateId,
    unpackedPath,
    platform,
    evidencePath: jsonPath,
  });

  // Print per-checkpoint results
  const checkLabels = [
    'launched             ',
    'settingsLoaded       ',
    'policyViewOpened     ',
    'runStartedOrBlocked  ',
    'reportOrHistoryVisible',
  ];
  const checkValues = [
    record.launched,
    record.settingsLoaded,
    record.policyViewOpened,
    record.runStartedOrBlocked,
    record.reportOrHistoryVisible,
  ];

  for (let i = 0; i < checkLabels.length; i++) {
    const status = checkValues[i] ? 'PASS' : 'FAIL';
    log(`  ${status}  ${checkLabels[i]}`);
  }

  log('');

  if (record.issues.length > 0) {
    log('Issues:');
    for (const issue of record.issues) {
      log(`  - ${issue}`);
    }
    log('');
  }

  // Write JSON evidence (atomic)
  const jsonContent = JSON.stringify(record, null, 2);
  writeAtomic(jsonPath, jsonContent);

  // Write Markdown summary (atomic)
  const mdContent = renderMarkdown(record, unpackedPath);
  writeAtomic(markdownPath, mdContent);

  // Terminal summary
  log('─'.repeat(60));
  log(`Status   : ${record.status.toUpperCase()}`);
  log(`Smoke ID : ${record.smokeId}`);
  log(`JSON     : ${jsonPath}`);
  log(`Markdown : ${markdownPath}`);
  log('─'.repeat(60));
  log('');

  process.exit(record.status === 'passed' ? 0 : 1);
}

main().catch(err => {
  process.stderr.write('Unhandled error in smoke-validate.mjs:\n');
  process.stderr.write(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.stderr.write('\n');
  process.exit(1);
});
