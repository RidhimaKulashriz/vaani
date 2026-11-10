import { describe, expect, it } from "vitest";
import { AudioFramePacer, type PacerClock } from "./pacer.js";

function deterministicClock() {
  let currentTime = 0;
  const delays: number[] = [];
  const clock: PacerClock = {
    now: () => currentTime,
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
      currentTime += milliseconds;
    },
  };
  return {
    clock,
    delays,
    now: () => currentTime,
    advance: (milliseconds: number) => { currentTime += milliseconds; },
  };
}

describe("AudioFramePacer", () => {
  it("sends frames against 20 ms monotonic deadlines without accumulating callback drift", async () => {
    const time = deterministicClock();
    const pacer = new AudioFramePacer(20, time.clock);
    const sentAt: number[] = [];
    const frames = Array.from({ length: 4 }, () => new Uint8Array(160));

    const sent = await pacer.play(frames, async () => {
      sentAt.push(time.now());
      // Simulate a callback that takes time; the next deadline stays on the original clock.
      time.advance(7);
    });

    expect(sent).toBe(4);
    expect(sentAt).toEqual([0, 20, 40, 60]);
    expect(time.delays).toEqual([0, 13, 13, 13]);
  });

  it("flushes a pending frame wait and does not send the queued frame", async () => {
    let markWaiting: (() => void) | undefined;
    const waiting = new Promise<void>((resolve) => { markWaiting = resolve; });
    const clock: PacerClock = {
      now: () => 0,
      sleep: (milliseconds, signal) => new Promise((resolve) => {
        if (milliseconds <= 0) {
          resolve();
          return;
        }
        markWaiting?.();
        signal.addEventListener("abort", () => resolve(), { once: true });
      }),
    };
    const pacer = new AudioFramePacer(20, clock);
    let sent = 0;
    const playback = pacer.play([new Uint8Array([1]), new Uint8Array([2])], () => { sent += 1; });

    await waiting;
    pacer.flush();

    expect(await playback).toBe(1);
    expect(sent).toBe(1);
  });

  it("rejects invalid frame intervals", () => {
    expect(() => new AudioFramePacer(0)).toThrow("frameIntervalMs must be a positive number");
  });
});
