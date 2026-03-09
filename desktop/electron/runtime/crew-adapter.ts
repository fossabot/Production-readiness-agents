import { pathToFileURL } from 'node:url';
import type { SubAgent } from 'deepagents';
import type { ResolvedAssets } from './asset-resolver.js';
import type { TracingCollector, CrewEvent } from '../../../src/tracing/tracer.js';

/**
 * Result of running the crew via the adapter.
 */
export interface CrewAdapterResult {
  readonly subagents: SubAgent[];
  readonly tracer: TracingCollector;
}

/**
 * Options for the crew adapter.
 */
export interface CrewAdapterOptions {
  readonly resolvedAssets: ResolvedAssets;
  readonly models: Record<string, string>;
  readonly enabledAgents: string[];
  readonly tracer?: TracingCollector;
  readonly onTraceEvent?: (event: CrewEvent) => void;
}

/**
 * Loads the root crew library from the resolved asset path and creates
 * the Production Readiness Crew subagents.
 *
 * This adapter bridges the desktop Electron worker to the root crew library
 * without duplicating subagent definitions. The root library is the sole
 * source of truth for agent prompts, tools, and topology.
 */
export async function createCrewFromLibrary(
  options: CrewAdapterOptions,
): Promise<CrewAdapterResult> {
  const { resolvedAssets, models, enabledAgents } = options;

  // Dynamic import of the root crew library from the resolved path
  const libraryUrl = pathToFileURL(resolvedAssets.libraryEntryPath).href;
  const library = await import(libraryUrl);

  const { createProductionReadinessCrewSubagents, TracingCollector: LibTracingCollector } = library;

  if (typeof createProductionReadinessCrewSubagents !== 'function') {
    throw new Error(
      `Crew library at ${resolvedAssets.libraryEntryPath} does not export createProductionReadinessCrewSubagents`,
    );
  }

  // Create or reuse tracer
  const tracer: TracingCollector = options.tracer ?? new LibTracingCollector();

  // Build tool stubs — the crew library requires tool arrays per agent.
  // In desktop runtime, tools are provided by the deepagents framework at execution time.
  // We provide empty arrays as placeholders since tools are injected by the runner.
  const tools = {
    structuralScout: [],
    codePerformanceAuditor: [],
    securityResilienceAuditor: [],
    testingAuditor: [],
    infrastructureAuditor: [],
    docsComplianceAuditor: [],
    runtimeVerifier: [],
    reportSynthesizer: [],
  };

  // Map desktop model assignments to the crew library's model option format
  const crewModels: Record<string, string> = {};
  const agentNameMap: Record<string, string> = {
    'structural-scout': 'structuralScout',
    'code-performance-auditor': 'codePerformanceAuditor',
    'security-resilience-auditor': 'securityResilienceAuditor',
    'testing-auditor': 'testingAuditor',
    'infrastructure-auditor': 'infrastructureAuditor',
    'docs-compliance-auditor': 'docsComplianceAuditor',
    'runtime-verifier': 'runtimeVerifier',
    'report-synthesizer': 'reportSynthesizer',
  };

  for (const [agentId, modelId] of Object.entries(models)) {
    const optionKey = agentNameMap[agentId];
    if (optionKey) {
      crewModels[optionKey] = modelId;
    }
  }

  const includeGeneralPurpose = enabledAgents.includes('general-purpose');
  if (includeGeneralPurpose) {
    (tools as Record<string, unknown[]>).generalPurposeFallback = [];
    if (models['general-purpose']) {
      crewModels.generalPurposeFallback = models['general-purpose'];
    }
  }

  const subagents: SubAgent[] = createProductionReadinessCrewSubagents(tools, {
    models: crewModels,
    tracer,
    includeGeneralPurposeFallback: includeGeneralPurpose,
  });

  // Wire trace event forwarding by wrapping the record method
  if (options.onTraceEvent) {
    const cb = options.onTraceEvent;
    const originalRecord = tracer.record.bind(tracer);
    tracer.record = (event: CrewEvent) => {
      originalRecord(event);
      cb(event);
    };
  }

  return { subagents, tracer };
}
