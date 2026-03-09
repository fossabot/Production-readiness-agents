import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

function getReportsDir(): string {
  return path.join(app.getPath("userData"), "reports");
}

export async function ensureReportsDir(): Promise<void> {
  await fs.mkdir(getReportsDir(), { recursive: true });
}

export async function saveReport(runId: string, format: "markdown" | "json", content: string): Promise<string> {
  await ensureReportsDir();
  const ext = format === "markdown" ? "md" : "json";
  const filePath = path.join(getReportsDir(), `${runId}.${ext}`);
  await fs.writeFile(filePath, content, "utf-8");
  return filePath;
}

export async function getReport(runId: string, format: "markdown" | "json"): Promise<{ content: string; path: string } | null> {
  const ext = format === "markdown" ? "md" : "json";
  const filePath = path.join(getReportsDir(), `${runId}.${ext}`);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return { content, path: filePath };
  } catch {
    return null;
  }
}

export async function exportReport(
  runId: string,
  format: "markdown" | "json",
  destinationPath: string,
): Promise<{ success: boolean; path: string }> {
  const report = await getReport(runId, format);
  if (!report) {
    return { success: false, path: destinationPath };
  }
  try {
    await fs.writeFile(destinationPath, report.content, "utf-8");
    return { success: true, path: destinationPath };
  } catch {
    return { success: false, path: destinationPath };
  }
}

export async function deleteReports(runId: string): Promise<void> {
  const mdPath = path.join(getReportsDir(), `${runId}.md`);
  const jsonPath = path.join(getReportsDir(), `${runId}.json`);
  await Promise.allSettled([
    fs.unlink(mdPath),
    fs.unlink(jsonPath),
  ]);
}
