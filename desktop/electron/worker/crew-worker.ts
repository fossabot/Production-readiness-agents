import { parentPort } from "node:worker_threads";
import { CancellationManager, CancellationError } from "./cancellation.js";
import { emitLifecycle, emitRunError, emitWorkerEvent } from "./event-bus.js";
import { createCrewRuntime } from "./crew-runtime.js";
import type { CrewRunInput } from "./crew-runtime.js";
import type { RuntimePolicy } from "../types/settings.js";
import type { RunPolicyResolutionSnapshot } from "../types/model-policy.js";

interface StartRunMessage {
  type: "START_RUN";
  runId: string;
  repoPath: string;
  agents: string[];
  models: Record<string, string>;
  policy: RuntimePolicy;
  policyResolutionSnapshot: RunPolicyResolutionSnapshot;
}

type WorkerMessage = StartRunMessage | { type: "CANCEL" };

if (!parentPort) {
  throw new Error("crew-worker.ts must be run as a Worker Thread");
}

const cancellation = new CancellationManager();
const runtime = createCrewRuntime();

parentPort.on("message", async (msg: WorkerMessage) => {
  if (msg.type === "CANCEL") {
    cancellation.cancel();
    return;
  }

  if (msg.type === "START_RUN") {
    const { runId, repoPath, agents, models, policy, policyResolutionSnapshot } = msg;

    const startTime = Date.now();

    try {
      emitLifecycle(runId, "starting");

      const input: CrewRunInput = { runId, repoPath, agents, models, policy, policyResolutionSnapshot };

      emitLifecycle(runId, "running");

      const result = await runtime.run(input, emitWorkerEvent, cancellation.signal);

      emitLifecycle(runId, "completed");

      // Send final results with runtime metadata
      parentPort!.postMessage({
        kind: "run.completed",
        runId,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        result: {
          markdownReport: result.markdownReport,
          jsonReport: result.jsonReport,
          findingsCount: result.findingsCount,
          severitySummary: result.severitySummary,
          overallAssessment: result.overallAssessment,
        },
      });
    } catch (error) {
      if (error instanceof CancellationError || cancellation.isCancelled) {
        emitLifecycle(runId, "cancelled");
      } else {
        const message = error instanceof Error ? error.message : String(error);
        // Map error types to specific error codes
        const code = message.startsWith('RUNTIME_ASSET_ERROR')
          ? 'RUNTIME_ASSET_ERROR'
          : message.startsWith('All agents failed')
            ? 'AGENT_ERROR'
            : 'AGENT_ERROR';
        emitRunError(runId, code, message);
        emitLifecycle(runId, "failed");
      }
    }
  }
});
