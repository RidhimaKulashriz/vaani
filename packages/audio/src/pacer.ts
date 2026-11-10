export interface PacerClock {
  now(): number;
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
}

const systemClock: PacerClock = {
  now: () => performance.now(),
  sleep: (milliseconds, signal) => new Promise((resolve) => {
    if (milliseconds <= 0 || signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, milliseconds);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  }),
};

/** Sends audio frames against monotonic deadlines; flush aborts any pending wait. */
export class AudioFramePacer {
  private generation = 0;
  private activeController: AbortController | null = null;

  constructor(
    private readonly frameIntervalMs = 20,
    private readonly clock: PacerClock = systemClock,
  ) {
    if (!Number.isFinite(frameIntervalMs) || frameIntervalMs <= 0) {
      throw new RangeError("frameIntervalMs must be a positive number");
    }
  }

  async play(
    frames: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
    sendFrame: (frame: Uint8Array) => void | Promise<void>,
  ): Promise<number> {
    this.flush();
    const generation = this.generation;
    const controller = new AbortController();
    this.activeController = controller;
    const startedAt = this.clock.now();
    let sent = 0;

    try {
      for await (const frame of frames) {
        if (generation !== this.generation) break;
        const deadline = startedAt + sent * this.frameIntervalMs;
        await this.clock.sleep(Math.max(0, deadline - this.clock.now()), controller.signal);
        if (generation !== this.generation || controller.signal.aborted) break;
        await sendFrame(frame);
        sent += 1;
      }
      return sent;
    } finally {
      if (this.activeController === controller) this.activeController = null;
    }
  }

  /** Stop the current stream and discard any frames that have not yet been sent. */
  flush(): void {
    this.generation += 1;
    this.activeController?.abort();
    this.activeController = null;
  }
}
