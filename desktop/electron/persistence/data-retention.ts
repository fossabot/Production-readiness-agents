import { existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

const MAX_AGE_DAYS = 90;
const MAX_RUN_COUNT = 100;
const CLEANUP_DIRS = ['runs', 'reports', 'traces'] as const;

export interface CleanupResult {
  readonly removedCount: number;
  readonly removedPaths: string[];
  readonly reason: 'age' | 'count' | 'none';
}

export function runDataRetentionCleanup(): CleanupResult {
  const userData = app.getPath('userData');
  const removedPaths: string[] = [];
  let reason: CleanupResult['reason'] = 'none';

  // Collect all entries across cleanup directories with their timestamps
  const entries: Array<{ dir: string; name: string; path: string; mtime: Date }> = [];

  for (const dirName of CLEANUP_DIRS) {
    const dirPath = join(userData, dirName);
    if (!existsSync(dirPath)) continue;

    for (const name of readdirSync(dirPath)) {
      const entryPath = join(dirPath, name);
      try {
        const stat = statSync(entryPath);
        entries.push({ dir: dirName, name, path: entryPath, mtime: stat.mtime });
      } catch {
        // Skip unreadable entries
      }
    }
  }

  // Sort oldest first
  entries.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

  const now = Date.now();
  const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  // Remove entries older than MAX_AGE_DAYS
  for (const entry of entries) {
    if (now - entry.mtime.getTime() > maxAgeMs) {
      try {
        rmSync(entry.path, { recursive: true, force: true });
        removedPaths.push(entry.path);
        reason = 'age';
      } catch {
        // Skip entries that can't be removed
      }
    }
  }

  // Re-collect remaining entries for count check
  const remaining = entries.filter((e) => !removedPaths.includes(e.path));

  // If still over MAX_RUN_COUNT, remove oldest until within limit
  // Count by unique run IDs in the runs/ directory
  const runEntries = remaining.filter((e) => e.dir === 'runs');
  if (runEntries.length > MAX_RUN_COUNT) {
    const toRemoveCount = runEntries.length - MAX_RUN_COUNT;
    const toRemove = runEntries.slice(0, toRemoveCount);

    for (const entry of toRemove) {
      try {
        rmSync(entry.path, { recursive: true, force: true });
        removedPaths.push(entry.path);
        reason = reason === 'none' ? 'count' : reason;

        // Also remove corresponding reports and traces
        const baseName = entry.name.replace(/\.json$/, '');
        for (const dirName of ['reports', 'traces'] as const) {
          const relatedPath = join(app.getPath('userData'), dirName, baseName);
          if (existsSync(relatedPath)) {
            rmSync(relatedPath, { recursive: true, force: true });
            removedPaths.push(relatedPath);
          }
        }
      } catch {
        // Skip entries that can't be removed
      }
    }
  }

  return {
    removedCount: removedPaths.length,
    removedPaths,
    reason,
  };
}
