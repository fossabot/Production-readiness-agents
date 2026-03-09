#!/usr/bin/env node

/**
 * Release Gate Orchestrator
 *
 * Runs 9 required validation stages and emits structured results so that an
 * operator or CI pipeline can make a binary pass/fail decision on a release
 * candidate before signing off.
 *
 * Usage:
 *   node scripts/release-gate.mjs [--candidate-id <id>] [--skip-package]
 *
 * Outputs:
 *   desktop/release/validation/<candidateId>/release-gate.json
 *   desktop/release/validation/<candidateId>/release-gate.md
 *
 * Exit codes:
 *   0  All required stages passed
 *   1  One or more required stages failed
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// ─── Path constants ───────────────────────────────────────────────────────────

const DESKTOP_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT    = resolve(DESKTOP_ROOT, '..');

// ─── CLI argument parsing ─────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let candidateId = null;
  let skipPackage = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--candidate-id' && args[i + 1]) {
      candidateId = args[++i];
    } else if (args[i] === '--skip-package') {
      skipPackage = true;
    }
  }

  return {
    candidateId: candidateId ?? `cand-${randomUUID()}`,
    skipPackage,
  };
}

// ─── Stage definitions ────────────────────────────────────────────────────────

/**
 * Returns the ordered list of stages for this gate run.
 *
 * Each stage entry carries everything needed to execute and record one check:
 *   stage      — machine identifier matching ReleaseGateCheckStage
 *   label      — human-readable description for the markdown report
 *   command    — shell command to execute (null for file-existence checks)
 *   cwd        — working directory for the command
 *   required   — whether failure blocks the gate
 *   skip       — whether to skip this stage entirely (e.g. --skip-package)
 *   checkFn    — optional function for checks that have no shell command
 *
 * @param {{ candidateId: string; skipPackage: boolean; outputDir: string }} ctx
 * @returns {StageDefinition[]}
 */
function buildStages(ctx) {
  const { outputDir, skipPackage } = ctx;

  return [
    {
      stage:    'root-static',
      label:    'Root library typecheck',
      command:  'npm run typecheck',
      cwd:      REPO_ROOT,
      required: true,
      skip:     false,
    },
    {
      stage:    'root-tests',
      label:    'Root library unit tests',
      command:  'npm run test:unit',
      cwd:      REPO_ROOT,
      required: true,
      skip:     false,
    },
    {
      stage:    'desktop-static',
      label:    'Desktop typecheck',
      command:  'npm run typecheck',
      cwd:      DESKTOP_ROOT,
      required: true,
      skip:     false,
    },
    {
      stage:    'desktop-tests',
      label:    'Desktop test suite',
      command:  'npm run test',
      cwd:      DESKTOP_ROOT,
      required: true,
      skip:     false,
    },
    {
      stage:    'desktop-build',
      label:    'Desktop Electron Vite build',
      command:  'npm run build',
      cwd:      DESKTOP_ROOT,
      required: true,
      skip:     false,
    },
    {
      stage:    'package',
      label:    'Desktop packaging (electron-builder)',
      command:  'npm run package',
      cwd:      DESKTOP_ROOT,
      required: true,
      skip:     skipPackage,
    },
    {
      stage:    'smoke',
      label:    'Smoke validation of packaged candidate',
      command:  'npm run release:smoke',
      cwd:      DESKTOP_ROOT,
      required: true,
      skip:     skipPackage,
      evidencePath: join(outputDir, 'smoke-validation.json'),
    },
    {
      stage:    'performance',
      label:    'Performance notes evidence check',
      command:  null,
      cwd:      null,
      required: true,
      skip:     false,
      checkFn:  () => checkFileExists(
        join(outputDir, 'performance-notes.md'),
        'performance-notes.md not found at ' + outputDir +
          '. Run performance measurements and write results to that path.',
      ),
      evidencePath: join(outputDir, 'performance-notes.md'),
    },
    {
      stage:    'docs',
      label:    'Permanent documentation check',
      command:  null,
      cwd:      null,
      required: true,
      skip:     false,
      checkFn:  () => checkAllFilesExist([
        {
          path:    join(DESKTOP_ROOT, 'docs', 'production-readiness.md'),
          detail:  'desktop/docs/production-readiness.md is missing.',
        },
        {
          path:    join(DESKTOP_ROOT, 'docs', 'release-signoff.md'),
          detail:  'desktop/docs/release-signoff.md is missing.',
        },
      ]),
      evidencePath: join(DESKTOP_ROOT, 'docs', 'production-readiness.md'),
    },
  ];
}

// ─── File-existence check helpers ─────────────────────────────────────────────

/**
 * Returns null on success or an error message string on failure.
 *
 * @param {string} filePath
 * @param {string} message
 * @returns {string | null}
 */
function checkFileExists(filePath, message) {
  return existsSync(filePath) ? null : message;
}

/**
 * Checks multiple files and returns null on success or a combined message.
 *
 * @param {{ path: string; detail: string }[]} files
 * @returns {string | null}
 */
function checkAllFilesExist(files) {
  const missing = files
    .filter(f => !existsSync(f.path))
    .map(f => f.detail);
  return missing.length === 0 ? null : missing.join(' ');
}

// ─── Stage execution ──────────────────────────────────────────────────────────

/**
 * Runs a single stage and returns a completed ReleaseGateCheck record.
 *
 * @param {StageDefinition} def
 * @param {string} gateRunId
 * @param {{ budgetMs: number; elapsedMs: number }} budget
 * @returns {GateCheck}
 */
function runStage(def, gateRunId, budget) {
  const checkId   = `check-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const startMs   = Date.now();

  // ── skipped stage ──────────────────────────────────────────────────────────
  if (def.skip) {
    const finishedAt = new Date().toISOString();
    log(`  SKIP  [${def.stage}] ${def.label}`);
    return {
      checkId,
      gateRunId,
      stage:        def.stage,
      label:        def.label,
      command:      def.command,
      startedAt,
      finishedAt,
      durationMs:   0,
      status:       'skipped',
      required:     def.required,
      evidencePath: def.evidencePath ?? null,
      details:      'Skipped via --skip-package flag.',
    };
  }

  // ── budget check ──────────────────────────────────────────────────────────
  if (budget.elapsedMs >= budget.budgetMs) {
    const finishedAt = new Date().toISOString();
    log(`  SKIP  [${def.stage}] Budget exhausted, skipping remaining stages.`);
    return {
      checkId,
      gateRunId,
      stage:        def.stage,
      label:        def.label,
      command:      def.command,
      startedAt,
      finishedAt,
      durationMs:   0,
      status:       'skipped',
      required:     def.required,
      evidencePath: def.evidencePath ?? null,
      details:      'Skipped: overall 30-minute budget exhausted.',
    };
  }

  log(`  RUN   [${def.stage}] ${def.label}`);

  let status  = 'passed';
  let details = null;

  // ── file-check stage (no shell command) ───────────────────────────────────
  if (typeof def.checkFn === 'function') {
    const error = def.checkFn();
    if (error !== null) {
      status  = 'failed';
      details = error;
      log(`  FAIL  [${def.stage}] ${details}`);
    }
  } else if (def.command !== null) {
    // ── shell command stage ─────────────────────────────────────────────────
    try {
      execSync(def.command, {
        cwd:    def.cwd ?? REPO_ROOT,
        stdio:  'inherit',
        // Individual stage timeout: remainder of the overall budget
        timeout: Math.max(0, budget.budgetMs - budget.elapsedMs),
      });
    } catch (err) {
      status  = 'failed';
      details = err instanceof Error ? err.message : String(err);
      log(`  FAIL  [${def.stage}] ${details}`);
    }
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Date.now() - startMs;

  // Update elapsed so subsequent stages respect the budget
  budget.elapsedMs += durationMs;

  if (status === 'passed') {
    log(`  PASS  [${def.stage}] (${durationMs}ms)`);
  }

  return {
    checkId,
    gateRunId,
    stage:        def.stage,
    label:        def.label,
    command:      def.command ?? null,
    startedAt,
    finishedAt,
    durationMs,
    status,
    required:     def.required,
    evidencePath: def.evidencePath ?? null,
    details,
  };
}

// ─── Output rendering ─────────────────────────────────────────────────────────

/**
 * Renders a ReleaseGateResult to a Markdown summary string.
 *
 * @param {GateResult} result
 * @param {GateCheck[]} checks
 * @returns {string}
 */
function renderMarkdown(result, checks) {
  const statusEmoji = result.status === 'passed' ? 'PASSED' : 'FAILED';

  const rows = checks.map(c => {
    const statusLabel = c.status.toUpperCase();
    const duration    = c.status === 'skipped' ? '—' : `${c.durationMs}ms`;
    const details     = c.details ? ` — ${c.details}` : '';
    return `| ${c.stage} | ${c.label} | ${statusLabel} | ${duration} |${details}`;
  });

  const blockingSection = result.blockingReasons.length > 0
    ? `\n## Blocking Reasons\n\n${result.blockingReasons.map(r => `- ${r}`).join('\n')}\n`
    : '';

  const generatedSection = result.generatedFiles.length > 0
    ? `\n## Generated Files\n\n${result.generatedFiles.map(f => `- \`${f}\``).join('\n')}\n`
    : '';

  return [
    `# Release Gate — ${statusEmoji}`,
    '',
    `**Candidate**: \`${result.candidateId}\`  `,
    `**Gate Run**: \`${result.gateRunId}\`  `,
    `**Platform**: ${result.platform}  `,
    `**Started**: ${result.startedAt}  `,
    `**Finished**: ${result.finishedAt ?? 'incomplete'}  `,
    `**Summary**: ${result.summary}`,
    '',
    '## Stage Results',
    '',
    '| Stage | Label | Status | Duration |',
    '|-------|-------|--------|----------|',
    ...rows,
    blockingSection,
    generatedSection,
  ].join('\n');
}

// ─── Atomic write helper ──────────────────────────────────────────────────────

/**
 * Writes content to a tmp path then renames it into place atomically.
 *
 * @param {string} destPath
 * @param {string} content
 */
function writeAtomic(destPath, content) {
  const tmpPath = destPath + '.tmp';
  writeFileSync(tmpPath, content, 'utf-8');
  renameSync(tmpPath, destPath);
}

// ─── Logging ──────────────────────────────────────────────────────────────────

/**
 * @param {string} msg
 */
function log(msg) {
  process.stdout.write(msg + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { candidateId, skipPackage } = parseArgs();

  const gateRunId  = `gate-${randomUUID()}`;
  const startedAt  = new Date().toISOString();
  const startMs    = Date.now();

  // Determine platform label
  const platformMap = { win32: 'win', darwin: 'mac', linux: 'linux' };
  const platform    = platformMap[process.platform] ?? 'current';

  // Output directory for this candidate
  const outputDir = join(DESKTOP_ROOT, 'release', 'validation', candidateId);
  mkdirSync(outputDir, { recursive: true });

  // 30-minute budget in milliseconds (NFR-002)
  const BUDGET_MS  = 30 * 60 * 1000;
  const budget     = { budgetMs: BUDGET_MS, elapsedMs: 0 };

  log('');
  log(`Release Gate`);
  log(`  Gate Run  : ${gateRunId}`);
  log(`  Candidate : ${candidateId}`);
  log(`  Platform  : ${platform}`);
  log(`  Output    : ${outputDir}`);
  if (skipPackage) {
    log(`  Mode      : dev-validation (--skip-package)`);
  }
  log('');

  // Build the stage list with the resolved output directory
  const stageDefs = buildStages({ candidateId, skipPackage, outputDir });

  // Run every stage in order
  /** @type {GateCheck[]} */
  const checks = [];

  for (const def of stageDefs) {
    const check = runStage(def, gateRunId, budget);
    checks.push(check);
  }

  // Derive gate outcome
  const blockingReasons = checks
    .filter(c => c.required && c.status === 'failed')
    .map(c => `[${c.stage}] ${c.label}: ${c.details ?? 'command failed'}`);

  const overallStatus = blockingReasons.length === 0 ? 'passed' : 'failed';
  const finishedAt    = new Date().toISOString();
  const totalMs       = Date.now() - startMs;

  const passCount  = checks.filter(c => c.status === 'passed').length;
  const failCount  = checks.filter(c => c.status === 'failed').length;
  const skipCount  = checks.filter(c => c.status === 'skipped').length;
  const summary    = overallStatus === 'passed'
    ? `All ${passCount} required checks passed in ${Math.round(totalMs / 1000)}s.`
    : `${failCount} required check(s) failed. ${passCount} passed, ${skipCount} skipped.`;

  /** @type {GateResult} */
  const result = {
    gateRunId,
    candidateId,
    startedAt,
    finishedAt,
    status:          overallStatus,
    platform,
    summary,
    blockingReasons,
    checkIds:        checks.map(c => c.checkId),
    runtimeSessionIds: [],
    generatedFiles:  [],
  };

  // Write JSON result
  const jsonPath = join(outputDir, 'release-gate.json');
  const jsonPayload = JSON.stringify({ result, checks }, null, 2);
  writeAtomic(jsonPath, jsonPayload);
  result.generatedFiles.push(jsonPath);

  // Write Markdown summary
  const mdPath = join(outputDir, 'release-gate.md');
  const mdContent = renderMarkdown(result, checks);
  writeAtomic(mdPath, mdContent);
  result.generatedFiles.push(mdPath);

  // Update generatedFiles in the JSON now that we have both paths
  result.generatedFiles = [jsonPath, mdPath];
  const finalJson = JSON.stringify({ result, checks }, null, 2);
  writeAtomic(jsonPath, finalJson);

  // Terminal summary
  log('');
  log('─'.repeat(60));
  log(`Status  : ${overallStatus.toUpperCase()}`);
  log(`Summary : ${summary}`);
  log(`JSON    : ${jsonPath}`);
  log(`Markdown: ${mdPath}`);
  log('─'.repeat(60));
  log('');

  if (blockingReasons.length > 0) {
    log('Blocking reasons:');
    for (const reason of blockingReasons) {
      log(`  - ${reason}`);
    }
    log('');
  }

  process.exit(overallStatus === 'passed' ? 0 : 1);
}

main().catch(err => {
  process.stderr.write('Unhandled error in release-gate.mjs:\n');
  process.stderr.write(err instanceof Error ? err.stack ?? err.message : String(err));
  process.stderr.write('\n');
  process.exit(1);
});
