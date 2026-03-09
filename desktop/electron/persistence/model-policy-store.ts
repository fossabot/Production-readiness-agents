import { app } from "electron";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildDefaultActiveSnapshot,
  buildSnapshotFromProfile,
  getBuiltInProfile,
} from "../policy/catalog.js";
import type {
  ModelPolicySnapshot,
  PolicyProfileId,
  PublishSnapshotInput,
} from "../types/model-policy.js";

interface ActivePolicyRef {
  activeSnapshotId: string;
}

function getPolicyRootDir(): string {
  return path.join(app.getPath("userData"), "model-policies");
}

function getSnapshotsDir(): string {
  return path.join(getPolicyRootDir(), "snapshots");
}

function getActiveRefPath(): string {
  return path.join(getPolicyRootDir(), "active.json");
}

function getSnapshotPath(snapshotId: string): string {
  return path.join(getSnapshotsDir(), `${snapshotId}.json`);
}

function ensurePolicyDirs(): void {
  mkdirSync(getSnapshotsDir(), { recursive: true });
}

function saveActiveRef(activeSnapshotId: string): void {
  ensurePolicyDirs();
  writeFileSync(getActiveRefPath(), JSON.stringify({ activeSnapshotId } satisfies ActivePolicyRef, null, 2), "utf-8");
}

function readActiveRef(): ActivePolicyRef | null {
  try {
    return JSON.parse(readFileSync(getActiveRefPath(), "utf-8")) as ActivePolicyRef;
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: ModelPolicySnapshot): ModelPolicySnapshot {
  ensurePolicyDirs();
  writeFileSync(getSnapshotPath(snapshot.snapshotId), JSON.stringify(snapshot, null, 2), "utf-8");
  return snapshot;
}

export function getSnapshot(snapshotId: string): ModelPolicySnapshot | null {
  try {
    return JSON.parse(readFileSync(getSnapshotPath(snapshotId), "utf-8")) as ModelPolicySnapshot;
  } catch {
    return null;
  }
}

function replaceSnapshot(snapshot: ModelPolicySnapshot): ModelPolicySnapshot {
  return saveSnapshot(snapshot);
}

function archiveSnapshot(snapshot: ModelPolicySnapshot, supersededBySnapshotId: string): ModelPolicySnapshot {
  return replaceSnapshot({
    ...snapshot,
    status: "archived",
    supersededBySnapshotId,
  });
}

export function bootstrapActiveSnapshot(): ModelPolicySnapshot {
  ensurePolicyDirs();
  const activeRef = readActiveRef();
  if (activeRef) {
    const existing = getSnapshot(activeRef.activeSnapshotId);
    if (existing) {
      return existing;
    }
  }

  const seeded = saveSnapshot(buildDefaultActiveSnapshot());
  saveActiveRef(seeded.snapshotId);
  return seeded;
}

export function getActiveSnapshot(): ModelPolicySnapshot {
  const activeRef = readActiveRef();
  if (!activeRef) {
    return bootstrapActiveSnapshot();
  }
  return getSnapshot(activeRef.activeSnapshotId) ?? bootstrapActiveSnapshot();
}

export function listSnapshots(): ModelPolicySnapshot[] {
  ensurePolicyDirs();
  const snapshots = readdirSync(getSnapshotsDir())
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => {
      try {
        return JSON.parse(readFileSync(path.join(getSnapshotsDir(), entry), "utf-8")) as ModelPolicySnapshot;
      } catch {
        return null;
      }
    })
    .filter((snapshot): snapshot is ModelPolicySnapshot => snapshot !== null);

  snapshots.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  return snapshots;
}

export function activateSnapshot(nextSnapshot: ModelPolicySnapshot): ModelPolicySnapshot {
  const current = getActiveSnapshot();
  if (current.snapshotId !== nextSnapshot.snapshotId) {
    archiveSnapshot(current, nextSnapshot.snapshotId);
  }

  const activeSnapshot = saveSnapshot({
    ...nextSnapshot,
    status: "active",
    supersededBySnapshotId: null,
    supersedesSnapshotId: current.snapshotId === nextSnapshot.snapshotId ? nextSnapshot.supersedesSnapshotId : current.snapshotId,
  });
  saveActiveRef(activeSnapshot.snapshotId);
  return activeSnapshot;
}

export function applyProfile(profileId: PolicyProfileId): ModelPolicySnapshot {
  const nextSnapshot = buildSnapshotFromProfile(profileId);
  return activateSnapshot(nextSnapshot);
}

export function publishActiveSnapshot(input: PublishSnapshotInput): ModelPolicySnapshot {
  const current = getActiveSnapshot();
  const published: ModelPolicySnapshot = {
    ...current,
    snapshotId: `policy-published-${Date.now()}`,
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    reviewer: input.reviewer,
    approvalNotes: input.approvalNotes,
    reviewByDate: input.reviewByDate,
    sourceLinks: input.sourceLinks,
    supersedesSnapshotId: current.snapshotId,
    supersededBySnapshotId: null,
    status: "active",
  };
  return activateSnapshot(published);
}

export function describeProfile(profileId: PolicyProfileId): { title: string; description: string } {
  const profile = getBuiltInProfile(profileId);
  return { title: profile.title, description: profile.description };
}
