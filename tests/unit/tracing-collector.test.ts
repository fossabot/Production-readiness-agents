/**
 * TracingCollector — unit tests
 *
 * Tests the TracingCollector class from src/tracing/tracer.ts. Covers:
 *   - Initial state
 *   - Event storage and retrieval via getEvents()
 *   - All event types: crew:start, agent:delegated, agent:completed,
 *     agent:failed, agent:retried, tool:called, crew:completed,
 *     policy:resolved, policy:fallback, policy:blocked, policy:runtime-failed
 *   - Delegation record construction via collect()
 *   - Tool-call and retry counters
 *   - Total duration computation
 *   - Timestamp format validation
 *   - Event ordering guarantees
 */

import { describe, it, expect } from "vitest";
import { TracingCollector } from "../../src/tracing/tracer.js";
import type { CrewEvent } from "../../src/tracing/tracer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iso(offset = 0): string {
  return new Date(Date.now() + offset).toISOString();
}

function isIsoString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("TracingCollector — initial state", () => {
  it("starts with an empty events list", () => {
    const collector = new TracingCollector();
    expect(collector.getEvents()).toHaveLength(0);
  });

  it("collect() returns zero delegations when no events have been recorded", () => {
    const collector = new TracingCollector();
    const data = collector.collect();
    expect(data.delegations).toHaveLength(0);
  });

  it("collect() returns zero tool_calls when no events have been recorded", () => {
    const collector = new TracingCollector();
    const data = collector.collect();
    expect(data.tool_calls).toBe(0);
  });

  it("collect() returns zero retries when no events have been recorded", () => {
    const collector = new TracingCollector();
    const data = collector.collect();
    expect(data.retries).toBe(0);
  });

  it("collect() returns a non-negative total_duration_ms on fresh collector", () => {
    const collector = new TracingCollector();
    const data = collector.collect();
    expect(data.total_duration_ms).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Event storage — record() and getEvents()
// ---------------------------------------------------------------------------

describe("TracingCollector — record() and getEvents()", () => {
  it("getEvents() returns exactly the events that were recorded", () => {
    const collector = new TracingCollector();
    const event: CrewEvent = { type: "crew:start", timestamp: iso() };
    collector.record(event);

    const events = collector.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBe(event);
  });

  it("records multiple events in order", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({ type: "crew:start", timestamp: ts });
    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "structural-scout",
      timestamp: ts,
    });
    collector.record({
      type: "agent:completed",
      agent: "structural-scout",
      timestamp: ts,
      duration_ms: 100,
    });

    expect(collector.getEvents()).toHaveLength(3);
  });

  it("preserves strict insertion order", () => {
    const collector = new TracingCollector();
    const eventTypes: CrewEvent["type"][] = [
      "crew:start",
      "agent:delegated",
      "tool:called",
      "agent:completed",
      "crew:completed",
    ];

    const ts = iso();
    collector.record({ type: "crew:start", timestamp: ts });
    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "structural-scout",
      timestamp: ts,
    });
    collector.record({
      type: "tool:called",
      agent: "structural-scout",
      tool: "read_file",
      timestamp: ts,
    });
    collector.record({
      type: "agent:completed",
      agent: "structural-scout",
      timestamp: ts,
      duration_ms: 200,
    });
    collector.record({
      type: "crew:completed",
      timestamp: ts,
      total_duration_ms: 1000,
    });

    const recorded = collector.getEvents().map((e) => e.type);
    expect(recorded).toEqual(eventTypes);
  });

  it("getEvents() returns a readonly-compatible value", () => {
    const collector = new TracingCollector();
    collector.record({ type: "crew:start", timestamp: iso() });

    const events = collector.getEvents();
    // Accessing elements works — no mutation attempted
    expect(events[0]).toBeDefined();
    expect(events[0]?.type).toBe("crew:start");
  });
});

// ---------------------------------------------------------------------------
// crew:start event
// ---------------------------------------------------------------------------

describe("TracingCollector — crew:start event", () => {
  it("records a crew:start event with the correct type", () => {
    const collector = new TracingCollector();
    const ts = iso();
    collector.record({ type: "crew:start", timestamp: ts });

    const events = collector.getEvents();
    expect(events[0]?.type).toBe("crew:start");
  });

  it("crew:start event has a timestamp string", () => {
    const collector = new TracingCollector();
    const ts = iso();
    collector.record({ type: "crew:start", timestamp: ts });

    const event = collector.getEvents()[0] as Extract<
      CrewEvent,
      { type: "crew:start" }
    >;
    expect(typeof event.timestamp).toBe("string");
  });

  it("crew:start timestamp is a parseable ISO date string", () => {
    const collector = new TracingCollector();
    const ts = iso();
    collector.record({ type: "crew:start", timestamp: ts });

    const event = collector.getEvents()[0] as Extract<
      CrewEvent,
      { type: "crew:start" }
    >;
    expect(isIsoString(event.timestamp)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// agent:delegated event
// ---------------------------------------------------------------------------

describe("TracingCollector — agent:delegated event", () => {
  it("records an agent:delegated event", () => {
    const collector = new TracingCollector();
    const ts = iso();
    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "testing-auditor",
      timestamp: ts,
    });

    expect(collector.getEvents()).toHaveLength(1);
    expect(collector.getEvents()[0]?.type).toBe("agent:delegated");
  });

  it("agent:delegated event carries from and to fields", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "security-resilience-auditor",
      timestamp: iso(),
    });

    const event = collector.getEvents()[0] as Extract<
      CrewEvent,
      { type: "agent:delegated" }
    >;
    expect(event.from).toBe("supervisor");
    expect(event.to).toBe("security-resilience-auditor");
  });
});

// ---------------------------------------------------------------------------
// agent:completed event
// ---------------------------------------------------------------------------

describe("TracingCollector — agent:completed event", () => {
  it("records an agent:completed event", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "agent:completed",
      agent: "structural-scout",
      timestamp: iso(),
      duration_ms: 500,
    });

    expect(collector.getEvents()[0]?.type).toBe("agent:completed");
  });

  it("agent:completed event carries agent name and duration_ms", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "agent:completed",
      agent: "report-synthesizer",
      timestamp: iso(),
      duration_ms: 1234,
    });

    const event = collector.getEvents()[0] as Extract<
      CrewEvent,
      { type: "agent:completed" }
    >;
    expect(event.agent).toBe("report-synthesizer");
    expect(event.duration_ms).toBe(1234);
  });
});

// ---------------------------------------------------------------------------
// agent:failed event
// ---------------------------------------------------------------------------

describe("TracingCollector — agent:failed event", () => {
  it("records an agent:failed event", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "agent:failed",
      agent: "testing-auditor",
      timestamp: iso(),
      duration_ms: 50,
      reason: "timeout",
    });

    expect(collector.getEvents()[0]?.type).toBe("agent:failed");
  });

  it("agent:failed event may carry an optional reason", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "agent:failed",
      agent: "runtime-verifier",
      timestamp: iso(),
      duration_ms: 0,
      reason: "out of memory",
    });

    const event = collector.getEvents()[0] as Extract<
      CrewEvent,
      { type: "agent:failed" }
    >;
    expect(event.reason).toBe("out of memory");
  });

  it("agent:failed event is valid without a reason field", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "agent:failed",
      agent: "docs-compliance-auditor",
      timestamp: iso(),
      duration_ms: 100,
    });

    const event = collector.getEvents()[0] as Extract<
      CrewEvent,
      { type: "agent:failed" }
    >;
    expect(event.reason).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// agent:retried event
// ---------------------------------------------------------------------------

describe("TracingCollector — agent:retried event", () => {
  it("records an agent:retried event", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "agent:retried",
      agent: "structural-scout",
      timestamp: iso(),
    });

    expect(collector.getEvents()[0]?.type).toBe("agent:retried");
  });

  it("agent:retried increments the retry counter", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "structural-scout",
      timestamp: ts,
    });
    collector.record({
      type: "agent:retried",
      agent: "structural-scout",
      timestamp: ts,
    });
    collector.record({
      type: "agent:completed",
      agent: "structural-scout",
      timestamp: ts,
      duration_ms: 400,
    });

    const data = collector.collect();
    expect(data.retries).toBe(1);
  });

  it("multiple retries for the same agent are all counted", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "runtime-verifier",
      timestamp: ts,
    });
    collector.record({
      type: "agent:retried",
      agent: "runtime-verifier",
      timestamp: ts,
    });
    collector.record({
      type: "agent:retried",
      agent: "runtime-verifier",
      timestamp: ts,
    });
    collector.record({
      type: "agent:completed",
      agent: "runtime-verifier",
      timestamp: ts,
      duration_ms: 600,
    });

    const data = collector.collect();
    expect(data.retries).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// tool:called event
// ---------------------------------------------------------------------------

describe("TracingCollector — tool:called event", () => {
  it("records a tool:called event", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "tool:called",
      agent: "structural-scout",
      tool: "read_file",
      timestamp: iso(),
    });

    expect(collector.getEvents()[0]?.type).toBe("tool:called");
  });

  it("each tool:called event increments the tool_calls counter", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({
      type: "tool:called",
      agent: "structural-scout",
      tool: "read_file",
      timestamp: ts,
    });
    collector.record({
      type: "tool:called",
      agent: "structural-scout",
      tool: "list_dir",
      timestamp: ts,
    });
    collector.record({
      type: "tool:called",
      agent: "testing-auditor",
      tool: "run_tests",
      timestamp: ts,
    });

    const data = collector.collect();
    expect(data.tool_calls).toBe(3);
  });

  it("tool_calls counter is zero when no tool events are recorded", () => {
    const collector = new TracingCollector();
    collector.record({ type: "crew:start", timestamp: iso() });

    const data = collector.collect();
    expect(data.tool_calls).toBe(0);
  });

  it("tool:called event carries agent and tool name fields", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "tool:called",
      agent: "infrastructure-auditor",
      tool: "inspect_dockerfile",
      timestamp: iso(),
    });

    const event = collector.getEvents()[0] as Extract<
      CrewEvent,
      { type: "tool:called" }
    >;
    expect(event.agent).toBe("infrastructure-auditor");
    expect(event.tool).toBe("inspect_dockerfile");
  });
});

// ---------------------------------------------------------------------------
// crew:completed event
// ---------------------------------------------------------------------------

describe("TracingCollector — crew:completed event", () => {
  it("records a crew:completed event", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "crew:completed",
      timestamp: iso(),
      total_duration_ms: 8000,
    });

    expect(collector.getEvents()[0]?.type).toBe("crew:completed");
  });

  it("total_duration_ms from crew:completed is used by collect()", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({ type: "crew:start", timestamp: ts });
    collector.record({
      type: "crew:completed",
      timestamp: ts,
      total_duration_ms: 5000,
    });

    const data = collector.collect();
    expect(data.total_duration_ms).toBe(5000);
  });

  it("without crew:completed, collect() still returns a non-negative duration", () => {
    const collector = new TracingCollector();
    collector.record({ type: "crew:start", timestamp: iso() });

    const data = collector.collect();
    expect(data.total_duration_ms).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Delegation record construction
// ---------------------------------------------------------------------------

describe("TracingCollector — delegation records via collect()", () => {
  it("builds a completed delegation record from delegated+completed pair", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "structural-scout",
      timestamp: ts,
    });
    collector.record({
      type: "agent:completed",
      agent: "structural-scout",
      timestamp: iso(100),
      duration_ms: 150,
    });

    const data = collector.collect();
    expect(data.delegations).toHaveLength(1);
    expect(data.delegations[0]?.from).toBe("supervisor");
    expect(data.delegations[0]?.to).toBe("structural-scout");
    expect(data.delegations[0]?.status).toBe("completed");
    expect(data.delegations[0]?.duration_ms).toBe(150);
  });

  it("builds a failed delegation record from delegated+failed pair", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "testing-auditor",
      timestamp: ts,
    });
    collector.record({
      type: "agent:failed",
      agent: "testing-auditor",
      timestamp: iso(50),
      duration_ms: 50,
      reason: "timeout",
    });

    const data = collector.collect();
    expect(data.delegations).toHaveLength(1);
    expect(data.delegations[0]?.status).toBe("failed");
    expect(data.delegations[0]?.to).toBe("testing-auditor");
  });

  it("builds a retried delegation record from delegated+retried pair", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "security-resilience-auditor",
      timestamp: ts,
    });
    collector.record({
      type: "agent:retried",
      agent: "security-resilience-auditor",
      timestamp: iso(100),
    });
    collector.record({
      type: "agent:completed",
      agent: "security-resilience-auditor",
      timestamp: iso(200),
      duration_ms: 200,
    });

    const data = collector.collect();
    // retry + completion = 2 delegation records
    expect(data.delegations).toHaveLength(2);
    const retried = data.delegations.find((d) => d.status === "retried");
    expect(retried).toBeDefined();
    expect(retried?.to).toBe("security-resilience-auditor");
  });

  it("delegation record has a timestamp string", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "structural-scout",
      timestamp: ts,
    });
    collector.record({
      type: "agent:completed",
      agent: "structural-scout",
      timestamp: iso(100),
      duration_ms: 100,
    });

    const data = collector.collect();
    expect(typeof data.delegations[0]?.timestamp).toBe("string");
    expect(isIsoString(data.delegations[0]?.timestamp)).toBe(true);
  });

  it("does not create delegation records for agents without a prior delegated event", () => {
    const collector = new TracingCollector();
    // agent:completed without a prior agent:delegated — no record expected
    collector.record({
      type: "agent:completed",
      agent: "orphan-agent",
      timestamp: iso(),
      duration_ms: 100,
    });

    const data = collector.collect();
    expect(data.delegations).toHaveLength(0);
  });

  it("builds delegation records for multiple independent agents", () => {
    const collector = new TracingCollector();
    const ts = iso();

    const agents = [
      "structural-scout",
      "code-performance-auditor",
      "testing-auditor",
    ];

    for (const agent of agents) {
      collector.record({
        type: "agent:delegated",
        from: "supervisor",
        to: agent,
        timestamp: ts,
      });
    }
    for (const agent of agents) {
      collector.record({
        type: "agent:completed",
        agent,
        timestamp: iso(200),
        duration_ms: 200,
      });
    }

    const data = collector.collect();
    expect(data.delegations).toHaveLength(3);
    expect(data.delegations.map((d) => d.to).sort()).toEqual(agents.sort());
  });
});

// ---------------------------------------------------------------------------
// Policy event types
// ---------------------------------------------------------------------------

describe("TracingCollector — policy event types", () => {
  it("records a policy:resolved event", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "policy:resolved",
      agent: "structural-scout",
      timestamp: iso(),
      model: "claude-sonnet-4.6",
      source: "policy",
    });

    expect(collector.getEvents()[0]?.type).toBe("policy:resolved");
  });

  it("policy:resolved event carries agent, model, and source fields", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "policy:resolved",
      agent: "infrastructure-auditor",
      timestamp: iso(),
      model: "gpt-5.4",
      source: "manual-override",
    });

    const event = collector.getEvents()[0] as Extract<
      CrewEvent,
      { type: "policy:resolved" }
    >;
    expect(event.agent).toBe("infrastructure-auditor");
    expect(event.model).toBe("gpt-5.4");
    expect(event.source).toBe("manual-override");
  });

  it("records a policy:fallback event", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "policy:fallback",
      agent: "testing-auditor",
      timestamp: iso(),
      from_model: "gpt-5.2-codex",
      to_model: "gpt-5-mini",
      reason: "provider rate-limited",
    });

    expect(collector.getEvents()[0]?.type).toBe("policy:fallback");
  });

  it("policy:fallback event carries from_model, to_model, and reason", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "policy:fallback",
      agent: "code-performance-auditor",
      timestamp: iso(),
      from_model: "claude-opus-4.6",
      to_model: "claude-sonnet-4.6",
      reason: "credential missing",
    });

    const event = collector.getEvents()[0] as Extract<
      CrewEvent,
      { type: "policy:fallback" }
    >;
    expect(event.from_model).toBe("claude-opus-4.6");
    expect(event.to_model).toBe("claude-sonnet-4.6");
    expect(event.reason).toBe("credential missing");
  });

  it("records a policy:blocked event", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "policy:blocked",
      agent: "runtime-verifier",
      timestamp: iso(),
      reason: "no valid model",
    });

    expect(collector.getEvents()[0]?.type).toBe("policy:blocked");
  });

  it("policy:blocked event carries agent and reason", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "policy:blocked",
      agent: "docs-compliance-auditor",
      timestamp: iso(),
      reason: "model deprecated",
    });

    const event = collector.getEvents()[0] as Extract<
      CrewEvent,
      { type: "policy:blocked" }
    >;
    expect(event.agent).toBe("docs-compliance-auditor");
    expect(event.reason).toBe("model deprecated");
  });

  it("records a policy:runtime-failed event", () => {
    const collector = new TracingCollector();
    collector.record({
      type: "policy:runtime-failed",
      agent: "runtime-verifier",
      timestamp: iso(),
      reason: "execution timed out",
    });

    expect(collector.getEvents()[0]?.type).toBe("policy:runtime-failed");
  });

  it("records all policy event types in a single collector", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({
      type: "policy:resolved",
      agent: "structural-scout",
      timestamp: ts,
      model: "claude-sonnet-4.6",
      source: "policy",
    });
    collector.record({
      type: "policy:fallback",
      agent: "testing-auditor",
      timestamp: ts,
      from_model: "gpt-5.2-codex",
      to_model: "gpt-5-mini",
      reason: "unavailable",
    });
    collector.record({
      type: "policy:blocked",
      agent: "runtime-verifier",
      timestamp: ts,
      reason: "no valid model",
    });
    collector.record({
      type: "policy:runtime-failed",
      agent: "runtime-verifier",
      timestamp: ts,
      reason: "crash",
    });

    const events = collector.getEvents();
    expect(events).toHaveLength(4);
    expect(events[0]?.type).toBe("policy:resolved");
    expect(events[1]?.type).toBe("policy:fallback");
    expect(events[2]?.type).toBe("policy:blocked");
    expect(events[3]?.type).toBe("policy:runtime-failed");
  });
});

// ---------------------------------------------------------------------------
// Timestamp format
// ---------------------------------------------------------------------------

describe("TracingCollector — timestamp format", () => {
  it("timestamps on all event types are ISO 8601 strings", () => {
    const collector = new TracingCollector();
    const ts = new Date().toISOString();

    const events: CrewEvent[] = [
      { type: "crew:start", timestamp: ts },
      {
        type: "agent:delegated",
        from: "supervisor",
        to: "structural-scout",
        timestamp: ts,
      },
      {
        type: "agent:completed",
        agent: "structural-scout",
        timestamp: ts,
        duration_ms: 100,
      },
      {
        type: "agent:failed",
        agent: "testing-auditor",
        timestamp: ts,
        duration_ms: 50,
      },
      { type: "agent:retried", agent: "structural-scout", timestamp: ts },
      {
        type: "tool:called",
        agent: "structural-scout",
        tool: "read",
        timestamp: ts,
      },
      { type: "crew:completed", timestamp: ts, total_duration_ms: 1000 },
      {
        type: "policy:resolved",
        agent: "structural-scout",
        timestamp: ts,
        model: "model-a",
        source: "policy",
      },
      {
        type: "policy:fallback",
        agent: "structural-scout",
        timestamp: ts,
        from_model: "a",
        to_model: "b",
        reason: "test",
      },
      {
        type: "policy:blocked",
        agent: "structural-scout",
        timestamp: ts,
        reason: "test",
      },
      {
        type: "policy:runtime-failed",
        agent: "structural-scout",
        timestamp: ts,
        reason: "test",
      },
    ];

    for (const event of events) {
      collector.record(event);
    }

    for (const recorded of collector.getEvents()) {
      expect(isIsoString(recorded.timestamp)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// collect() — TracingData shape
// ---------------------------------------------------------------------------

describe("TracingCollector — collect() TracingData shape", () => {
  it("collect() returns an object with all four required fields", () => {
    const collector = new TracingCollector();
    const data = collector.collect();

    expect(data).toHaveProperty("delegations");
    expect(data).toHaveProperty("tool_calls");
    expect(data).toHaveProperty("retries");
    expect(data).toHaveProperty("total_duration_ms");
  });

  it("delegations is an array", () => {
    const collector = new TracingCollector();
    const data = collector.collect();
    expect(Array.isArray(data.delegations)).toBe(true);
  });

  it("tool_calls is a number", () => {
    const collector = new TracingCollector();
    const data = collector.collect();
    expect(typeof data.tool_calls).toBe("number");
  });

  it("retries is a number", () => {
    const collector = new TracingCollector();
    const data = collector.collect();
    expect(typeof data.retries).toBe("number");
  });

  it("total_duration_ms is a number", () => {
    const collector = new TracingCollector();
    const data = collector.collect();
    expect(typeof data.total_duration_ms).toBe("number");
  });

  it("delegation record has from, to, timestamp, duration_ms, status fields", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "report-synthesizer",
      timestamp: ts,
    });
    collector.record({
      type: "agent:completed",
      agent: "report-synthesizer",
      timestamp: iso(300),
      duration_ms: 300,
    });

    const data = collector.collect();
    const record = data.delegations[0];

    expect(record).toHaveProperty("from");
    expect(record).toHaveProperty("to");
    expect(record).toHaveProperty("timestamp");
    expect(record).toHaveProperty("duration_ms");
    expect(record).toHaveProperty("status");
  });

  it("delegation status is one of completed | failed | retried", () => {
    const collector = new TracingCollector();
    const ts = iso();

    collector.record({
      type: "agent:delegated",
      from: "supervisor",
      to: "structural-scout",
      timestamp: ts,
    });
    collector.record({
      type: "agent:completed",
      agent: "structural-scout",
      timestamp: iso(100),
      duration_ms: 100,
    });

    const data = collector.collect();
    expect(["completed", "failed", "retried"]).toContain(
      data.delegations[0]?.status,
    );
  });
});
