import type { TracingData, DelegationRecord } from "../contracts/report-schema.js";

// ─── Event Types ─────────────────────────────────────────────────────────────

export type CrewEvent =
  | { readonly type: "crew:start"; readonly timestamp: string }
  | {
      readonly type: "agent:delegated";
      readonly from: string;
      readonly to: string;
      readonly timestamp: string;
    }
  | {
      readonly type: "agent:completed";
      readonly agent: string;
      readonly timestamp: string;
      readonly duration_ms: number;
    }
  | {
      readonly type: "agent:failed";
      readonly agent: string;
      readonly timestamp: string;
      readonly duration_ms: number;
      readonly reason?: string;
    }
  | {
      readonly type: "agent:retried";
      readonly agent: string;
      readonly timestamp: string;
    }
  | {
      readonly type: "tool:called";
      readonly agent: string;
      readonly tool: string;
      readonly timestamp: string;
    }
  | {
      readonly type: "crew:completed";
      readonly timestamp: string;
      readonly total_duration_ms: number;
    }
  | {
      readonly type: "policy:resolved";
      readonly agent: string;
      readonly timestamp: string;
      readonly model: string;
      readonly source: string;
    }
  | {
      readonly type: "policy:fallback";
      readonly agent: string;
      readonly timestamp: string;
      readonly from_model: string;
      readonly to_model: string;
      readonly reason: string;
    }
  | {
      readonly type: "policy:blocked";
      readonly agent: string;
      readonly timestamp: string;
      readonly reason: string;
    }
  | {
      readonly type: "policy:runtime-failed";
      readonly agent: string;
      readonly timestamp: string;
      readonly reason: string;
    };

// ─── TracingCollector ────────────────────────────────────────────────────────

export class TracingCollector {
  private readonly events: CrewEvent[] = [];
  private readonly delegationMap = new Map<
    string,
    { from: string; startTimestamp: string }
  >();
  private toolCallCount = 0;
  private retryCount = 0;
  private startTime: number | null = null;

  record(event: CrewEvent): void {
    this.events.push(event);

    switch (event.type) {
      case "crew:start":
        this.startTime = Date.now();
        break;
      case "agent:delegated":
        this.delegationMap.set(event.to, {
          from: event.from,
          startTimestamp: event.timestamp,
        });
        break;
      case "tool:called":
        this.toolCallCount++;
        break;
      case "agent:retried":
        this.retryCount++;
        break;
    }
  }

  collect(): TracingData {
    const delegations: DelegationRecord[] = [];

    for (const event of this.events) {
      if (
        event.type === "agent:completed" ||
        event.type === "agent:failed"
      ) {
        const delegation = this.delegationMap.get(event.agent);
        if (delegation) {
          const status: DelegationRecord["status"] =
            event.type === "agent:failed" ? "failed" : "completed";
          delegations.push({
            from: delegation.from,
            to: event.agent,
            timestamp: delegation.startTimestamp,
            duration_ms: event.duration_ms,
            status,
          });
        }
      } else if (event.type === "agent:retried") {
        const delegation = this.delegationMap.get(event.agent);
        if (delegation) {
          delegations.push({
            from: delegation.from,
            to: event.agent,
            timestamp: event.timestamp,
            duration_ms: 0,
            status: "retried",
          });
        }
      }
    }

    const completedEvent = this.events.find(
      (e): e is Extract<CrewEvent, { type: "crew:completed" }> =>
        e.type === "crew:completed",
    );

    const total_duration_ms =
      completedEvent?.total_duration_ms ??
      (this.startTime !== null ? Date.now() - this.startTime : 0);

    return {
      delegations,
      tool_calls: this.toolCallCount,
      retries: this.retryCount,
      total_duration_ms,
    };
  }

  getEvents(): readonly CrewEvent[] {
    return this.events;
  }
}
