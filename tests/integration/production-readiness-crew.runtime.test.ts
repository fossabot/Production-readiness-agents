/**
 * T014: Production Readiness Crew — runtime contract coverage
 *
 * Verifies that createProductionReadinessCrewSubagents() returns SubAgent
 * definitions that satisfy the structural contracts required for the crew to
 * operate correctly at runtime. No mocks — the factory is called with minimal
 * but real tool stubs that match the ToolList shape (StructuredTool[]).
 */

import { describe, it, expect } from "vitest";
import type { StructuredTool } from "@langchain/core/tools";

import {
  createProductionReadinessCrewSubagents,
  PRODUCTION_READINESS_SUPERVISOR_PROMPT,
  PARENT_RESULT_CONTRACT,
  SHARED_SAFETY_RULES,
} from "../../index.js";

import type {
  ProductionReadinessCrewTools,
  ProductionReadinessCrewModels,
} from "../../index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Minimal StructuredTool stub. deepagents only inspects the tool array at
 * delegation time; the factory itself treats ToolList as an opaque array, so
 * any non-empty array of objects satisfies the contract for these tests.
 */
function makeTool(name: string): StructuredTool {
  return { name } as unknown as StructuredTool;
}

/** Builds a complete ProductionReadinessCrewTools with one stub tool each. */
function makeTools(
  overrides: Partial<ProductionReadinessCrewTools> = {},
): ProductionReadinessCrewTools {
  return {
    structuralScout: [makeTool("read_file")],
    codePerformanceAuditor: [makeTool("read_file")],
    securityResilienceAuditor: [makeTool("read_file")],
    testingAuditor: [makeTool("read_file")],
    infrastructureAuditor: [makeTool("read_file")],
    docsComplianceAuditor: [makeTool("read_file")],
    runtimeVerifier: [makeTool("bash")],
    reportSynthesizer: [makeTool("read_file")],
    ...overrides,
  };
}

/** The names returned by the factory (supervisor is the parent, not a subagent). */
const CORE_AGENT_NAMES = [
  "structural-scout",
  "code-performance-auditor",
  "security-resilience-auditor",
  "testing-auditor",
  "infrastructure-auditor",
  "docs-compliance-auditor",
  "runtime-verifier",
  "report-synthesizer",
] as const;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createProductionReadinessCrewSubagents — default (8 subagents)", () => {
  const subagents = createProductionReadinessCrewSubagents(makeTools());

  it("returns exactly 8 subagents when includeGeneralPurposeFallback is not set", () => {
    expect(subagents).toHaveLength(8);
  });

  it("returns all 8 core agent names in order", () => {
    const names = subagents.map((a) => a.name);
    expect(names).toEqual([...CORE_AGENT_NAMES]);
  });

  it("every subagent has a non-empty name string", () => {
    for (const agent of subagents) {
      expect(typeof agent.name).toBe("string");
      expect(agent.name.length).toBeGreaterThan(0);
    }
  });

  it("every subagent has a non-empty description string", () => {
    for (const agent of subagents) {
      expect(typeof agent.description).toBe("string");
      expect(agent.description.length).toBeGreaterThan(0);
    }
  });

  it("every subagent has a non-empty systemPrompt string", () => {
    for (const agent of subagents) {
      expect(typeof agent.systemPrompt).toBe("string");
      expect(agent.systemPrompt.length).toBeGreaterThan(0);
    }
  });

  it("every subagent has a defined, non-empty tools array", () => {
    for (const agent of subagents) {
      expect(Array.isArray(agent.tools)).toBe(true);
      expect((agent.tools as unknown[]).length).toBeGreaterThan(0);
    }
  });
});

describe("createProductionReadinessCrewSubagents — PARENT_RESULT_CONTRACT inclusion", () => {
  const subagents = createProductionReadinessCrewSubagents(makeTools());

  it("every subagent's systemPrompt includes PARENT_RESULT_CONTRACT", () => {
    for (const agent of subagents) {
      expect(agent.systemPrompt).toContain(PARENT_RESULT_CONTRACT);
    }
  });

  it("every subagent's systemPrompt includes SHARED_SAFETY_RULES", () => {
    for (const agent of subagents) {
      expect(agent.systemPrompt).toContain(SHARED_SAFETY_RULES);
    }
  });

  it("PARENT_RESULT_CONTRACT is a non-empty Arabic-language string", () => {
    expect(typeof PARENT_RESULT_CONTRACT).toBe("string");
    expect(PARENT_RESULT_CONTRACT.length).toBeGreaterThan(0);
    // The contract is authored in Arabic — verify at least one Arabic character is present.
    expect(/[\u0600-\u06FF]/.test(PARENT_RESULT_CONTRACT)).toBe(true);
  });
});

describe("createProductionReadinessCrewSubagents — finding ID prefix contracts", () => {
  const subagents = createProductionReadinessCrewSubagents(makeTools());

  const prefixByAgent: Record<string, string> = {
    "structural-scout": "STR",
    "code-performance-auditor": "PERF",
    "security-resilience-auditor": "SEC",
    "testing-auditor": "TEST",
    "infrastructure-auditor": "INFRA",
    "docs-compliance-auditor": "DOCS",
    "runtime-verifier": "RUN",
  };

  for (const [agentName, prefix] of Object.entries(prefixByAgent)) {
    it(`${agentName} systemPrompt references its finding prefix "${prefix}"`, () => {
      const agent = subagents.find((a) => a.name === agentName);
      expect(agent).toBeDefined();
      expect(agent!.systemPrompt).toContain(prefix);
    });
  }
});

describe("createProductionReadinessCrewSubagents — tool assignment isolation", () => {
  it("each agent receives only its own designated tool list", () => {
    const scoutTool = makeTool("scout_only");
    const auditorTool = makeTool("read_file");
    const verifierTool = makeTool("bash");
    const synthTool = makeTool("write_file");

    const tools: ProductionReadinessCrewTools = {
      structuralScout: [scoutTool],
      codePerformanceAuditor: [auditorTool],
      securityResilienceAuditor: [auditorTool],
      testingAuditor: [auditorTool],
      infrastructureAuditor: [auditorTool],
      docsComplianceAuditor: [auditorTool],
      runtimeVerifier: [verifierTool],
      reportSynthesizer: [synthTool],
    };
    const subagents = createProductionReadinessCrewSubagents(tools);

    expect(subagents.find((a) => a.name === "structural-scout")?.tools).toEqual([scoutTool]);
    expect(subagents.find((a) => a.name === "runtime-verifier")?.tools).toEqual([verifierTool]);
    expect(subagents.find((a) => a.name === "report-synthesizer")?.tools).toEqual([synthTool]);

    const auditorAgents = [
      "code-performance-auditor",
      "security-resilience-auditor",
      "testing-auditor",
      "infrastructure-auditor",
      "docs-compliance-auditor",
    ];
    for (const name of auditorAgents) {
      expect(subagents.find((a) => a.name === name)?.tools).toEqual([auditorTool]);
    }
  });
});

describe("createProductionReadinessCrewSubagents — optional general-purpose fallback", () => {
  it("returns 9 subagents when includeGeneralPurposeFallback is true", () => {
    const tools = makeTools({ generalPurposeFallback: [makeTool("read_file")] });
    const subagents = createProductionReadinessCrewSubagents(tools, {
      includeGeneralPurposeFallback: true,
    });
    expect(subagents).toHaveLength(9);
  });

  it("general-purpose agent is first in the array when included", () => {
    const tools = makeTools({ generalPurposeFallback: [makeTool("read_file")] });
    const subagents = createProductionReadinessCrewSubagents(tools, {
      includeGeneralPurposeFallback: true,
    });
    expect(subagents[0]?.name).toBe("general-purpose");
  });

  it("general-purpose systemPrompt includes PARENT_RESULT_CONTRACT", () => {
    const tools = makeTools({ generalPurposeFallback: [makeTool("read_file")] });
    const subagents = createProductionReadinessCrewSubagents(tools, {
      includeGeneralPurposeFallback: true,
    });
    const gp = subagents.find((a) => a.name === "general-purpose");
    expect(gp?.systemPrompt).toContain(PARENT_RESULT_CONTRACT);
  });

  it("general-purpose systemPrompt references the GEN finding prefix", () => {
    const tools = makeTools({ generalPurposeFallback: [makeTool("read_file")] });
    const subagents = createProductionReadinessCrewSubagents(tools, {
      includeGeneralPurposeFallback: true,
    });
    const gp = subagents.find((a) => a.name === "general-purpose");
    expect(gp?.systemPrompt).toContain("GEN");
  });

  it("does not include general-purpose when includeGeneralPurposeFallback is false", () => {
    const tools = makeTools({ generalPurposeFallback: [makeTool("read_file")] });
    const subagents = createProductionReadinessCrewSubagents(tools, {
      includeGeneralPurposeFallback: false,
    });
    expect(subagents.find((a) => a.name === "general-purpose")).toBeUndefined();
    expect(subagents).toHaveLength(8);
  });
});

describe("createProductionReadinessCrewSubagents — custom models option", () => {
  it("attaches model to subagent when model is provided for that agent", () => {
    const customModel = "claude-opus-4-5";
    const models: ProductionReadinessCrewModels = {
      structuralScout: customModel,
    };
    const subagents = createProductionReadinessCrewSubagents(makeTools(), {
      models,
    });
    const scout = subagents.find((a) => a.name === "structural-scout");
    expect(scout?.model).toBe(customModel);
  });

  it("does not set model property when no model is provided for an agent", () => {
    const subagents = createProductionReadinessCrewSubagents(makeTools());
    const scout = subagents.find((a) => a.name === "structural-scout");
    // exactOptionalPropertyTypes: the property should be absent, not undefined
    expect(Object.prototype.hasOwnProperty.call(scout, "model")).toBe(false);
  });

  it("applies different models to different agents independently", () => {
    const models: ProductionReadinessCrewModels = {
      structuralScout: "model-a",
      reportSynthesizer: "model-b",
    };
    const subagents = createProductionReadinessCrewSubagents(makeTools(), {
      models,
    });
    const scout = subagents.find((a) => a.name === "structural-scout");
    const synth = subagents.find((a) => a.name === "report-synthesizer");
    const auditor = subagents.find((a) => a.name === "code-performance-auditor");

    expect(scout?.model).toBe("model-a");
    expect(synth?.model).toBe("model-b");
    expect(Object.prototype.hasOwnProperty.call(auditor, "model")).toBe(false);
  });
});

describe("createProductionReadinessCrewSubagents — input validation", () => {
  it("throws when a required tool list is missing", () => {
    const incompleteTools = {
      structuralScout: [makeTool("read_file")],
      // codePerformanceAuditor intentionally omitted
      securityResilienceAuditor: [makeTool("read_file")],
      testingAuditor: [makeTool("read_file")],
      infrastructureAuditor: [makeTool("read_file")],
      docsComplianceAuditor: [makeTool("read_file")],
      runtimeVerifier: [makeTool("bash")],
      reportSynthesizer: [makeTool("read_file")],
    } as unknown as ProductionReadinessCrewTools;

    expect(() =>
      createProductionReadinessCrewSubagents(incompleteTools),
    ).toThrow(/codePerformanceAuditor/);
  });

  it("throws with a descriptive message that names the missing field", () => {
    const incompleteTools = {
      structuralScout: [makeTool("read_file")],
      codePerformanceAuditor: [makeTool("read_file")],
      securityResilienceAuditor: [makeTool("read_file")],
      testingAuditor: [makeTool("read_file")],
      infrastructureAuditor: [makeTool("read_file")],
      docsComplianceAuditor: [makeTool("read_file")],
      runtimeVerifier: [makeTool("bash")],
      // reportSynthesizer intentionally omitted
    } as unknown as ProductionReadinessCrewTools;

    expect(() =>
      createProductionReadinessCrewSubagents(incompleteTools),
    ).toThrow(/reportSynthesizer/);
  });

  it("throws when includeGeneralPurposeFallback is true but generalPurposeFallback tools are absent", () => {
    expect(() =>
      createProductionReadinessCrewSubagents(makeTools(), {
        includeGeneralPurposeFallback: true,
      }),
    ).toThrow(/generalPurposeFallback/);
  });

  it("throws an Error instance (not a non-Error throw)", () => {
    const incompleteTools = {} as unknown as ProductionReadinessCrewTools;
    expect(() =>
      createProductionReadinessCrewSubagents(incompleteTools),
    ).toThrowError(Error);
  });
});

describe("PRODUCTION_READINESS_SUPERVISOR_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(typeof PRODUCTION_READINESS_SUPERVISOR_PROMPT).toBe("string");
    expect(PRODUCTION_READINESS_SUPERVISOR_PROMPT.length).toBeGreaterThan(0);
  });

  it("contains Arabic text", () => {
    expect(/[\u0600-\u06FF]/.test(PRODUCTION_READINESS_SUPERVISOR_PROMPT)).toBe(
      true,
    );
  });

  it("references structural-scout as the mandatory first agent", () => {
    expect(PRODUCTION_READINESS_SUPERVISOR_PROMPT).toContain("structural-scout");
  });

  it("references report-synthesizer as the final agent", () => {
    expect(PRODUCTION_READINESS_SUPERVISOR_PROMPT).toContain("report-synthesizer");
  });

  it("references runtime-verifier safety gate", () => {
    expect(PRODUCTION_READINESS_SUPERVISOR_PROMPT).toContain("runtime-verifier");
  });
});
