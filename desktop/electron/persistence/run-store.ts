import { app } from "electron";
import { promises as fs, existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import type { CrewRunRecord } from "../types/run.js";

function normalizeRun(record: CrewRunRecord): CrewRunRecord {
  return {
    ...record,
    policyResolutionSnapshot: record.policyResolutionSnapshot ?? null,
    error: record.error ?? null,
    durationMs: record.durationMs ?? null,
    findingsSummary: record.findingsSummary ?? { critical: 0, high: 0, medium: 0, low: 0 },
  };
}

function getRunsDir(): string {
  return path.join(app.getPath("userData"), "runs");
}

function getRunPath(runId: string): string {
  return path.join(getRunsDir(), `${runId}.json`);
}

export async function ensureRunsDir(): Promise<void> {
  await fs.mkdir(getRunsDir(), { recursive: true });
}

export async function saveRun(record: CrewRunRecord): Promise<void> {
  await ensureRunsDir();
  const filePath = getRunPath(record.runId);
  const tmpPath = `${filePath}.tmp`;
  const data = JSON.stringify(normalizeRun(record), null, 2);
  await fs.writeFile(tmpPath, data, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

export async function getRun(runId: string): Promise<CrewRunRecord | null> {
  try {
    const data = await fs.readFile(getRunPath(runId), "utf-8");
    return normalizeRun(JSON.parse(data) as CrewRunRecord);
  } catch {
    return null;
  }
}

export async function listRuns(
  filter?: { repoPath?: string },
  limit = 50,
  offset = 0,
): Promise<{ runs: CrewRunRecord[]; total: number }> {
  await ensureRunsDir();
  const files = await fs.readdir(getRunsDir());
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const allRuns: CrewRunRecord[] = [];
  for (const file of jsonFiles) {
    try {
      const data = await fs.readFile(path.join(getRunsDir(), file), "utf-8");
      allRuns.push(normalizeRun(JSON.parse(data) as CrewRunRecord));
    } catch {
      // skip corrupted files
    }
  }

  let filtered = allRuns;
  if (filter?.repoPath) {
    filtered = allRuns.filter((r) => r.repoPath === filter.repoPath);
  }

  // Sort by startedAt descending
  filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const total = filtered.length;
  const runs = filtered.slice(offset, offset + limit);
  return { runs, total };
}

export async function deleteRun(runId: string): Promise<boolean> {
  try {
    await fs.unlink(getRunPath(runId));
    return true;
  } catch {
    return false;
  }
}

export async function getActiveRun(): Promise<CrewRunRecord | null> {
  await ensureRunsDir();
  const files = await fs.readdir(getRunsDir());
  for (const file of files.filter((f) => f.endsWith('.json'))) {
    try {
      const data = await fs.readFile(path.join(getRunsDir(), file), 'utf-8');
      const record = normalizeRun(JSON.parse(data) as CrewRunRecord);
      if (record.status === 'queued' || record.status === 'starting' || record.status === 'running') {
        return record;
      }
    } catch {
      // skip corrupted files
    }
  }
  return null;
}
