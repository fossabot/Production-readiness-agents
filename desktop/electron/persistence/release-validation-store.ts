import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  ReleaseGateResult,
  ReleaseCandidateArtifact,
  SmokeValidationRecord,
  ReleaseSignOffChecklist,
} from '../types/release.js';

const VALIDATION_DIR = 'desktop/release/validation';

export function getValidationDir(candidateId: string): string {
  const dir = join(process.cwd(), VALIDATION_DIR, candidateId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function atomicWrite(filePath: string, data: string): void {
  const tmpPath = `${filePath}.tmp`;
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(tmpPath, data, 'utf-8');
  renameSync(tmpPath, filePath);
}

export function saveGateResult(result: ReleaseGateResult): string {
  const dir = getValidationDir(result.candidateId);
  const filePath = join(dir, 'release-gate.json');
  atomicWrite(filePath, JSON.stringify(result, null, 2));
  return filePath;
}

export function loadGateResult(candidateId: string): ReleaseGateResult | null {
  const filePath = join(process.cwd(), VALIDATION_DIR, candidateId, 'release-gate.json');
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8')) as ReleaseGateResult;
}

export function saveSmokeRecord(record: SmokeValidationRecord): string {
  const dir = getValidationDir(record.candidateId);
  const filePath = join(dir, 'smoke-validation.json');
  atomicWrite(filePath, JSON.stringify(record, null, 2));
  return filePath;
}

export function loadSmokeRecord(candidateId: string): SmokeValidationRecord | null {
  const filePath = join(process.cwd(), VALIDATION_DIR, candidateId, 'smoke-validation.json');
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8')) as SmokeValidationRecord;
}

export function saveSignOff(signOff: ReleaseSignOffChecklist): string {
  const dir = getValidationDir(signOff.candidateId);
  const filePath = join(dir, 'sign-off.json');
  atomicWrite(filePath, JSON.stringify(signOff, null, 2));
  return filePath;
}
