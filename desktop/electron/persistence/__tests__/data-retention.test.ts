/**
 * T064 — Data retention auto-cleanup (FR-019)
 *
 * Verifies the behaviour of runDataRetentionCleanup() from data-retention.ts:
 *   - Removes runs older than 90 days (MAX_AGE_DAYS)
 *   - Keeps runs newer than 90 days
 *   - Removes excess runs beyond 100 count (MAX_RUN_COUNT), keeping newest
 *   - Handles empty run list
 *   - Handles mixed old/new runs
 *   - Does not remove active runs (covered by age/count logic — active runs
 *     are recent by definition)
 *   - Returns a CleanupResult with counts
 *   - Respects both age and count thresholds simultaneously
 *
 * node:fs is fully mocked so no real filesystem is touched. The electron
 * module is mocked to provide a deterministic userData path.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock handles
// ---------------------------------------------------------------------------

const {
  mockExistsSync,
  mockReaddirSync,
  mockStatSync,
  mockRmSync,
  MOCK_USER_DATA,
} = vi.hoisted(() => {
  const MOCK_USER_DATA = "/mock-app-data";

  return {
    mockExistsSync: vi.fn<[string], boolean>().mockReturnValue(true),
    mockReaddirSync: vi.fn<[string], string[]>().mockReturnValue([]),
    mockStatSync: vi
      .fn()
      .mockReturnValue({ mtime: new Date() }),
    mockRmSync: vi.fn(),
    MOCK_USER_DATA,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn().mockReturnValue(MOCK_USER_DATA),
  },
}));

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
  rmSync: mockRmSync,
}));

// ---------------------------------------------------------------------------
// Import module under test — after mocks
// ---------------------------------------------------------------------------

import { runDataRetentionCleanup, type CleanupResult } from "../data-retention.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_DAYS = 90;
const MAX_RUN_COUNT = 100;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

/**
 * Configure the mocked filesystem to contain specific entries across the
 * runs/, reports/, and traces/ directories.
 *
 * @param entries Array of { dir, name, mtime } objects describing the mock
 *                filesystem layout. `dir` should be 'runs', 'reports', or 'traces'.
 */
function setupFileSystem(
  entries: Array<{ dir: string; name: string; mtime: Date }>,
): void {
  // Group entries by directory
  const byDir = new Map<string, Array<{ name: string; mtime: Date }>>();
  for (const entry of entries) {
    const existing = byDir.get(entry.dir) ?? [];
    existing.push({ name: entry.name, mtime: entry.mtime });
    byDir.set(entry.dir, existing);
  }

  // existsSync: directory exists if it has entries
  mockExistsSync.mockImplementation((p: string) => {
    for (const dirName of ["runs", "reports", "traces"]) {
      if (p.includes(dirName)) {
        return byDir.has(dirName) || entries.length === 0;
      }
    }
    return false;
  });

  // readdirSync: return filenames for the requested directory
  mockReaddirSync.mockImplementation((dirPath: string) => {
    for (const [dirName, dirEntries] of byDir.entries()) {
      if (dirPath.includes(dirName)) {
        return dirEntries.map((e) => e.name);
      }
    }
    return [];
  });

  // statSync: return mtime based on the full path
  mockStatSync.mockImplementation((entryPath: string) => {
    for (const entry of entries) {
      if (entryPath.includes(entry.name) && entryPath.includes(entry.dir)) {
        return { mtime: entry.mtime };
      }
    }
    return { mtime: new Date() };
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all directories exist but are empty
  mockExistsSync.mockReturnValue(true);
  mockReaddirSync.mockReturnValue([]);
  mockStatSync.mockReturnValue({ mtime: new Date() });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runDataRetentionCleanup", () => {
  // -----------------------------------------------------------------------
  // Removes runs older than 90 days
  // -----------------------------------------------------------------------

  describe("removes runs older than 90 days", () => {
    it("removes a single old run file", () => {
      setupFileSystem([
        { dir: "runs", name: "old-run-001.json", mtime: daysAgo(100) },
      ]);

      const result = runDataRetentionCleanup();

      expect(mockRmSync).toHaveBeenCalled();
      expect(result.removedCount).toBeGreaterThanOrEqual(1);
    });

    it("reports reason as 'age'", () => {
      setupFileSystem([
        { dir: "runs", name: "old-run-002.json", mtime: daysAgo(91) },
      ]);

      const result = runDataRetentionCleanup();

      expect(result.reason).toBe("age");
    });

    it("removes multiple old entries across directories", () => {
      setupFileSystem([
        { dir: "runs", name: "ancient-001.json", mtime: daysAgo(120) },
        { dir: "reports", name: "ancient-001.md", mtime: daysAgo(120) },
        { dir: "traces", name: "ancient-001.jsonl", mtime: daysAgo(120) },
      ]);

      const result = runDataRetentionCleanup();

      expect(result.removedCount).toBe(3);
    });

    it("removedPaths includes the paths of removed entries", () => {
      setupFileSystem([
        { dir: "runs", name: "to-remove.json", mtime: daysAgo(95) },
      ]);

      const result = runDataRetentionCleanup();

      expect(result.removedPaths.length).toBeGreaterThan(0);
      const hasRunPath = result.removedPaths.some((p) =>
        p.includes("to-remove.json"),
      );
      expect(hasRunPath).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Keeps runs newer than 90 days
  // -----------------------------------------------------------------------

  describe("keeps runs newer than 90 days", () => {
    it("does not remove a run from yesterday", () => {
      setupFileSystem([
        { dir: "runs", name: "recent-001.json", mtime: daysAgo(1) },
      ]);

      const result = runDataRetentionCleanup();

      expect(mockRmSync).not.toHaveBeenCalled();
      expect(result.removedCount).toBe(0);
    });

    it("does not remove a run from 89 days ago", () => {
      setupFileSystem([
        { dir: "runs", name: "borderline.json", mtime: daysAgo(89) },
      ]);

      const result = runDataRetentionCleanup();

      expect(result.removedCount).toBe(0);
      expect(result.reason).toBe("none");
    });

    it("does not remove today's run", () => {
      setupFileSystem([
        { dir: "runs", name: "today.json", mtime: new Date() },
      ]);

      const result = runDataRetentionCleanup();

      expect(result.removedCount).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Removes excess runs beyond 100 count (keeps newest)
  // -----------------------------------------------------------------------

  describe("removes excess runs beyond 100 count", () => {
    it("removes oldest runs when count exceeds 100", () => {
      // Create 105 run entries, all within 90 days
      const entries: Array<{ dir: string; name: string; mtime: Date }> = [];
      for (let i = 0; i < 105; i++) {
        entries.push({
          dir: "runs",
          name: `run-${String(i).padStart(3, "0")}.json`,
          // Spread across the last 80 days (all within the age limit)
          mtime: daysAgo(80 - Math.floor((i * 80) / 105)),
        });
      }
      setupFileSystem(entries);

      const result = runDataRetentionCleanup();

      // Should remove 5 oldest runs (105 - 100 = 5)
      expect(result.removedCount).toBeGreaterThanOrEqual(5);
    });

    it("keeps exactly 100 runs after cleanup", () => {
      const entries: Array<{ dir: string; name: string; mtime: Date }> = [];
      for (let i = 0; i < 103; i++) {
        entries.push({
          dir: "runs",
          name: `run-${String(i).padStart(3, "0")}.json`,
          mtime: daysAgo(Math.floor((i * 80) / 103)),
        });
      }
      setupFileSystem(entries);

      const result = runDataRetentionCleanup();

      // 103 - 100 = 3 runs should be removed (plus any related reports/traces)
      // At minimum 3 run files removed
      expect(result.removedCount).toBeGreaterThanOrEqual(3);
    });
  });

  // -----------------------------------------------------------------------
  // Handles empty run list
  // -----------------------------------------------------------------------

  describe("handles empty run list", () => {
    it("returns zero removedCount", () => {
      setupFileSystem([]);

      const result = runDataRetentionCleanup();

      expect(result.removedCount).toBe(0);
    });

    it("returns empty removedPaths", () => {
      setupFileSystem([]);

      const result = runDataRetentionCleanup();

      expect(result.removedPaths).toHaveLength(0);
    });

    it("returns reason 'none'", () => {
      setupFileSystem([]);

      const result = runDataRetentionCleanup();

      expect(result.reason).toBe("none");
    });

    it("does not call rmSync", () => {
      setupFileSystem([]);

      runDataRetentionCleanup();

      expect(mockRmSync).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Handles mixed old/new runs
  // -----------------------------------------------------------------------

  describe("handles mixed old/new runs", () => {
    it("removes only the old runs and keeps the new ones", () => {
      setupFileSystem([
        { dir: "runs", name: "old-run.json", mtime: daysAgo(100) },
        { dir: "runs", name: "new-run.json", mtime: daysAgo(5) },
      ]);

      const result = runDataRetentionCleanup();

      // Only the old run should be removed
      expect(result.removedCount).toBe(1);
      const removedOld = result.removedPaths.some((p) =>
        p.includes("old-run.json"),
      );
      expect(removedOld).toBe(true);
    });

    it("does not include new runs in removedPaths", () => {
      setupFileSystem([
        { dir: "runs", name: "ancient.json", mtime: daysAgo(200) },
        { dir: "runs", name: "fresh.json", mtime: daysAgo(2) },
      ]);

      const result = runDataRetentionCleanup();

      const removedNew = result.removedPaths.some((p) =>
        p.includes("fresh.json"),
      );
      expect(removedNew).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Does not remove active runs
  // -----------------------------------------------------------------------

  describe("does not remove active runs", () => {
    it("does not remove a run created today", () => {
      setupFileSystem([
        { dir: "runs", name: "active-run.json", mtime: new Date() },
      ]);

      const result = runDataRetentionCleanup();

      expect(result.removedCount).toBe(0);
      const removedActive = result.removedPaths.some((p) =>
        p.includes("active-run.json"),
      );
      expect(removedActive).toBe(false);
    });

    it("active recent runs survive even when count check runs", () => {
      // 99 old-ish runs within age limit + 1 very recent "active" run = 100 total
      // This should not trigger count-based removal
      const entries: Array<{ dir: string; name: string; mtime: Date }> = [];
      for (let i = 0; i < 99; i++) {
        entries.push({
          dir: "runs",
          name: `batch-${String(i).padStart(3, "0")}.json`,
          mtime: daysAgo(30 + i * 0.5),
        });
      }
      entries.push({
        dir: "runs",
        name: "active-current.json",
        mtime: new Date(),
      });
      setupFileSystem(entries);

      const result = runDataRetentionCleanup();

      // Total is exactly 100, so no count-based removal
      const removedActive = result.removedPaths.some((p) =>
        p.includes("active-current.json"),
      );
      expect(removedActive).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Returns cleanup summary with counts
  // -----------------------------------------------------------------------

  describe("returns cleanup summary with counts", () => {
    it("removedCount matches removedPaths length", () => {
      setupFileSystem([
        { dir: "runs", name: "expired-001.json", mtime: daysAgo(95) },
        { dir: "runs", name: "expired-002.json", mtime: daysAgo(100) },
      ]);

      const result = runDataRetentionCleanup();

      expect(result.removedCount).toBe(result.removedPaths.length);
    });

    it("result has the expected CleanupResult shape", () => {
      setupFileSystem([]);

      const result = runDataRetentionCleanup();

      expect(typeof result.removedCount).toBe("number");
      expect(Array.isArray(result.removedPaths)).toBe(true);
      expect(["age", "count", "none"]).toContain(result.reason);
    });

    it("reason is 'age' when only age-based cleanup occurs", () => {
      setupFileSystem([
        { dir: "runs", name: "old.json", mtime: daysAgo(91) },
      ]);

      const result = runDataRetentionCleanup();

      expect(result.reason).toBe("age");
    });

    it("reason is 'count' when only count-based cleanup occurs", () => {
      // All runs within age limit but exceeding count
      const entries: Array<{ dir: string; name: string; mtime: Date }> = [];
      for (let i = 0; i < 102; i++) {
        entries.push({
          dir: "runs",
          name: `count-run-${String(i).padStart(3, "0")}.json`,
          mtime: daysAgo(Math.floor((i * 80) / 102)),
        });
      }
      setupFileSystem(entries);

      const result = runDataRetentionCleanup();

      // After no age-based cleanup, count-based should trigger
      expect(result.reason).toBe("count");
    });
  });

  // -----------------------------------------------------------------------
  // Respects both age and count thresholds simultaneously
  // -----------------------------------------------------------------------

  describe("respects both age and count thresholds simultaneously", () => {
    it("removes age-expired entries first, then count-excess entries", () => {
      const entries: Array<{ dir: string; name: string; mtime: Date }> = [];
      // 5 entries older than 90 days
      for (let i = 0; i < 5; i++) {
        entries.push({
          dir: "runs",
          name: `ancient-${i}.json`,
          mtime: daysAgo(100 + i * 10),
        });
      }
      // 102 entries within 90 days (after age cleanup, 102 remain > MAX_RUN_COUNT)
      for (let i = 0; i < 102; i++) {
        entries.push({
          dir: "runs",
          name: `recent-${String(i).padStart(3, "0")}.json`,
          mtime: daysAgo(Math.floor((i * 80) / 102)),
        });
      }
      setupFileSystem(entries);

      const result = runDataRetentionCleanup();

      // Age cleanup removes 5, then count cleanup removes 2 more (102 - 100)
      // Total removed should be at least 7 (run files) plus any related reports/traces
      expect(result.removedCount).toBeGreaterThanOrEqual(7);
    });

    it("reason is 'age' when both thresholds triggered (age runs first)", () => {
      const entries: Array<{ dir: string; name: string; mtime: Date }> = [];
      for (let i = 0; i < 3; i++) {
        entries.push({
          dir: "runs",
          name: `old-${i}.json`,
          mtime: daysAgo(95 + i),
        });
      }
      for (let i = 0; i < 101; i++) {
        entries.push({
          dir: "runs",
          name: `new-${String(i).padStart(3, "0")}.json`,
          mtime: daysAgo(Math.floor((i * 85) / 101)),
        });
      }
      setupFileSystem(entries);

      const result = runDataRetentionCleanup();

      // When both thresholds fire, reason stays 'age' because age runs first
      expect(result.reason).toBe("age");
    });
  });
});
