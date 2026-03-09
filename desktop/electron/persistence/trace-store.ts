import { app } from "electron";
import { promises as fs } from "node:fs";
import { createWriteStream, type WriteStream } from "node:fs";
import path from "node:path";
import type { CrewWorkerEvent } from "../types/events.js";

function getTracesDir(): string {
  return path.join(app.getPath("userData"), "traces");
}

export async function ensureTracesDir(): Promise<void> {
  await fs.mkdir(getTracesDir(), { recursive: true });
}

const activeStreams = new Map<string, WriteStream>();

export async function openTraceLog(runId: string): Promise<string> {
  await ensureTracesDir();
  const filePath = path.join(getTracesDir(), `${runId}.jsonl`);
  const stream = createWriteStream(filePath, { flags: "a", encoding: "utf-8" });
  activeStreams.set(runId, stream);
  return filePath;
}

export function appendTraceEvent(runId: string, event: CrewWorkerEvent): void {
  const stream = activeStreams.get(runId);
  if (stream) {
    stream.write(JSON.stringify(event) + "\n");
  }
}

export function closeTraceLog(runId: string): void {
  const stream = activeStreams.get(runId);
  if (stream) {
    stream.end();
    activeStreams.delete(runId);
  }
}

export async function deleteTraces(runId: string): Promise<void> {
  closeTraceLog(runId);
  const filePath = path.join(getTracesDir(), `${runId}.jsonl`);
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}
