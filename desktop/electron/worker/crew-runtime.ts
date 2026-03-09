import type { CrewWorkerEvent } from "../types/events.js";
import type { RuntimePolicy } from "../types/settings.js";
import type { RunPolicyResolutionSnapshot } from "../types/model-policy.js";
import { createCrewFromLibrary } from "../runtime/crew-adapter.js";
import { resolveRuntimeAssets, AssetResolutionError } from "../runtime/asset-resolver.js";
import { emitAgentStatus, emitAgentFinding, emitRunError } from "./event-bus.js";

export interface CrewRunInput {
  readonly runId: string;
  readonly repoPath: string;
  readonly agents: string[];
  readonly models: Record<string, string>;
  readonly policy: RuntimePolicy;
  readonly policyResolutionSnapshot: RunPolicyResolutionSnapshot;
}

export interface CrewRunOutput {
  readonly markdownReport: string;
  readonly jsonReport: string;
  readonly findingsCount: number;
  readonly severitySummary: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
  readonly overallAssessment: "ready" | "ready_with_conditions" | "not_ready";
}

export interface PartialCompletionInfo {
  readonly successfulAgents: string[];
  readonly failedAgents: Array<{ agentId: string; reason: string }>;
}

export interface CrewRuntime {
  run(
    input: CrewRunInput,
    emit: (event: CrewWorkerEvent) => void,
    signal: AbortSignal,
  ): Promise<CrewRunOutput>;
}

export function createCrewRuntime(): CrewRuntime {
  return {
    async run(input, emit, signal) {
      // Resolve runtime assets (dev or packaged)
      let resolvedAssets;
      try {
        resolvedAssets = resolveRuntimeAssets();
      } catch (err) {
        const message = err instanceof AssetResolutionError
          ? err.message
          : 'Failed to resolve runtime assets';
        throw new Error(`RUNTIME_ASSET_ERROR: ${message}`);
      }

      // Create crew from library
      const { subagents, tracer } = await createCrewFromLibrary({
        resolvedAssets,
        models: input.models,
        enabledAgents: input.agents,
        onTraceEvent: (event) => {
          emit({
            kind: 'trace.event',
            runId: input.runId,
            timestamp: new Date().toISOString(),
            traceId: `crew-${input.runId}-${Date.now()}`,
            spanName: event.type,
            crewEvent: event,
          });
        },
      });

      // Filter to enabled agents only
      const activeSubagents = subagents.filter(
        (sa) => input.agents.includes(sa.name) || sa.name === 'supervisor',
      );

      // Execute agents with partial-completion resilience (FR-018)
      const partialInfo: PartialCompletionInfo = {
        successfulAgents: [],
        failedAgents: [],
      };

      const agentResults: Array<{ agentId: string; output: unknown }> = [];

      for (const agent of activeSubagents) {
        if (signal.aborted) break;
        if (agent.name === 'supervisor') continue;

        const startedAt = new Date().toISOString();
        emitAgentStatus(input.runId, agent.name, 'running', {
          startedAt,
          finishedAt: null,
          durationMs: null,
        });

        try {
          // The actual agent execution would be delegated to the deepagents
          // framework here. For now, we simulate the execution flow.
          // In production, this would call the crew's run method.
          const agentStart = Date.now();

          // Check abort between agents
          if (signal.aborted) {
            (partialInfo.failedAgents as Array<{ agentId: string; reason: string }>).push({
              agentId: agent.name,
              reason: 'Run was cancelled',
            });
            break;
          }

          agentResults.push({ agentId: agent.name, output: {} });
          (partialInfo.successfulAgents as string[]).push(agent.name);

          const finishedAt = new Date().toISOString();
          emitAgentStatus(input.runId, agent.name, 'completed', {
            startedAt,
            finishedAt,
            durationMs: Date.now() - agentStart,
          });
        } catch (agentErr) {
          const reason = agentErr instanceof Error ? agentErr.message : String(agentErr);
          (partialInfo.failedAgents as Array<{ agentId: string; reason: string }>).push({
            agentId: agent.name,
            reason,
          });

          emitAgentStatus(input.runId, agent.name, 'failed', {
            startedAt,
            finishedAt: new Date().toISOString(),
            durationMs: null,
          });

          emitRunError(input.runId, 'AGENT_ERROR', reason, agent.name);

          // FR-018: Continue with remaining agents on provider failure
          continue;
        }
      }

      // If ALL agents failed, this is a full failure
      if (partialInfo.successfulAgents.length === 0 && partialInfo.failedAgents.length > 0) {
        const failedNames = partialInfo.failedAgents.map((f) => f.agentId).join(', ');
        throw new Error(`All agents failed: ${failedNames}`);
      }

      // Build output from successful results
      const tracingData = tracer.getEvents();
      const findingsSummary = { critical: 0, high: 0, medium: 0, low: 0 };

      // Count findings from trace events
      for (const event of tracingData) {
        if ('severity' in event) {
          const sev = (event as { severity: string }).severity?.toLowerCase();
          if (sev && sev in findingsSummary) {
            findingsSummary[sev as keyof typeof findingsSummary]++;
          }
        }
      }

      const totalFindings = findingsSummary.critical + findingsSummary.high + findingsSummary.medium + findingsSummary.low;

      // Determine overall assessment
      let overallAssessment: CrewRunOutput['overallAssessment'] = 'ready';
      if (findingsSummary.critical > 0) {
        overallAssessment = 'not_ready';
      } else if (findingsSummary.high > 0 || partialInfo.failedAgents.length > 0) {
        overallAssessment = 'ready_with_conditions';
      }

      // Build partial-failure note if applicable
      let partialNote = '';
      if (partialInfo.failedAgents.length > 0) {
        partialNote = `\n\n> **Partial completion**: ${partialInfo.failedAgents.length} agent(s) failed: ${partialInfo.failedAgents.map((f) => `${f.agentId} (${f.reason})`).join(', ')}`;
      }

      const markdownReport = `# Production Readiness Report\n\n**Status**: ${overallAssessment}\n**Findings**: ${totalFindings}\n**Agents**: ${partialInfo.successfulAgents.length} succeeded, ${partialInfo.failedAgents.length} failed${partialNote}`;

      const jsonReport = JSON.stringify({
        overallAssessment,
        findingsCount: totalFindings,
        severitySummary: findingsSummary,
        successfulAgents: partialInfo.successfulAgents,
        failedAgents: partialInfo.failedAgents,
        tracingEvents: tracingData.length,
      });

      return {
        markdownReport,
        jsonReport,
        findingsCount: totalFindings,
        severitySummary: findingsSummary,
        overallAssessment,
      };
    },
  };
}
