import type { MessagePort } from "node:worker_threads";

/**
 * Manages cancellation state for a crew run within the worker thread.
 * Main process sends { type: "CANCEL" } message → worker sets cancelled flag.
 */
export class CancellationManager {
  private readonly controller = new AbortController();
  private _isCancelled = false;

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get isCancelled(): boolean {
    return this._isCancelled;
  }

  cancel(): void {
    if (!this._isCancelled) {
      this._isCancelled = true;
      this.controller.abort();
    }
  }

  /**
   * Listen for CANCEL messages from the main thread on the given port.
   */
  listenForCancel(port: MessagePort): void {
    port.on("message", (msg: unknown) => {
      if (typeof msg === "object" && msg !== null && "type" in msg && (msg as { type: string }).type === "CANCEL") {
        this.cancel();
      }
    });
  }

  /**
   * Throws if cancelled. Use as a checkpoint in loops.
   */
  throwIfCancelled(): void {
    if (this._isCancelled) {
      throw new CancellationError("Run was cancelled");
    }
  }
}

export class CancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CancellationError";
  }
}
