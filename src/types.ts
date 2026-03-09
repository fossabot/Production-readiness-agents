import type { SubAgent } from "deepagents";

// ─── Primitive Re-exports ────────────────────────────────────────────────────

export type ToolList = NonNullable<SubAgent["tools"]>;
export type ModelRef = SubAgent["model"];

// ─── Enums ───────────────────────────────────────────────────────────────────

export type Severity = "Critical" | "High" | "Medium" | "Low";

export type EffortLevel = "low" | "medium" | "high";

// ─── Evidence ────────────────────────────────────────────────────────────────

export interface Evidence {
  readonly type: "file" | "command" | "reference";
  readonly location: string;
  readonly snippet: string | null;
}

// ─── Finding ─────────────────────────────────────────────────────────────────

export interface Finding {
  readonly id: string;
  readonly title: string;
  readonly severity: Severity;
  readonly category: string;
  readonly description: string;
  readonly evidence: readonly Evidence[];
  readonly recommendation: string;
  readonly effort?: EffortLevel;
  readonly source_agent: string;
}

// ─── Observation ─────────────────────────────────────────────────────────────

export interface Observation {
  readonly title: string;
  readonly description: string;
  readonly source_agent: string;
}

// ─── CoverageEntry ───────────────────────────────────────────────────────────

export interface CoverageEntry {
  readonly axis: string;
  readonly agent: string;
  readonly status: "completed" | "partial" | "failed" | "skipped";
  readonly reason: string | null;
}

// ─── RemediationStep ─────────────────────────────────────────────────────────

export interface RemediationStep {
  readonly priority: number;
  readonly finding_ids: readonly string[];
  readonly action: string;
  readonly effort: EffortLevel;
}

// ─── GapDeclaration ──────────────────────────────────────────────────────────

export interface GapDeclaration {
  readonly axis: string;
  readonly agent: string;
  readonly reason: string;
}

// ─── ReportMetadata ──────────────────────────────────────────────────────────

export interface ReportMetadata {
  readonly crew_version: string;
  readonly agents_used: readonly string[];
  readonly batches: number | null;
  readonly subprojects_scanned: number | null;
}

// ─── SubprojectInfo ──────────────────────────────────────────────────────────

export interface SubprojectInfo {
  readonly name: string;
  readonly path: string;
  readonly type?: string;
}

// ─── CommandSpec ─────────────────────────────────────────────────────────────

export interface CommandSpec {
  readonly name: string;
  readonly command: string;
  readonly description?: string;
}

// ─── ProjectManifest ─────────────────────────────────────────────────────────

export interface ProjectManifest {
  readonly appType: string;
  readonly packageManager?: string;
  readonly entryPoints: readonly string[];
  readonly configFiles: readonly string[];
  readonly isMonorepo: boolean;
  readonly subprojects?: readonly SubprojectInfo[];
  readonly languages: readonly string[];
}

// ─── ExecutionContext ────────────────────────────────────────────────────────

export interface ExecutionContext {
  readonly commands: readonly CommandSpec[];
  readonly environment?: Record<string, string>;
  readonly constraints?: readonly string[];
  readonly allowedCommands: readonly string[];
}

// ─── Crew Configuration Interfaces ───────────────────────────────────────────

export interface ProductionReadinessCrewTools {
  readonly structuralScout: ToolList;
  readonly codePerformanceAuditor: ToolList;
  readonly securityResilienceAuditor: ToolList;
  readonly testingAuditor: ToolList;
  readonly infrastructureAuditor: ToolList;
  readonly docsComplianceAuditor: ToolList;
  readonly runtimeVerifier: ToolList;
  readonly reportSynthesizer: ToolList;
  readonly generalPurposeFallback?: ToolList;
}

export interface ProductionReadinessCrewModels {
  readonly structuralScout?: ModelRef;
  readonly codePerformanceAuditor?: ModelRef;
  readonly securityResilienceAuditor?: ModelRef;
  readonly testingAuditor?: ModelRef;
  readonly infrastructureAuditor?: ModelRef;
  readonly docsComplianceAuditor?: ModelRef;
  readonly runtimeVerifier?: ModelRef;
  readonly reportSynthesizer?: ModelRef;
  readonly generalPurposeFallback?: ModelRef;
}

export interface ProductionReadinessCrewSkills {
  readonly structuralScout?: readonly string[];
  readonly codePerformanceAuditor?: readonly string[];
  readonly securityResilienceAuditor?: readonly string[];
  readonly testingAuditor?: readonly string[];
  readonly infrastructureAuditor?: readonly string[];
  readonly docsComplianceAuditor?: readonly string[];
  readonly runtimeVerifier?: readonly string[];
  readonly reportSynthesizer?: readonly string[];
  readonly generalPurposeFallback?: readonly string[];
}

export interface ProductionReadinessCrewOptions {
  readonly models?: ProductionReadinessCrewModels;
  readonly skills?: ProductionReadinessCrewSkills;
  readonly includeGeneralPurposeFallback?: boolean;
}
