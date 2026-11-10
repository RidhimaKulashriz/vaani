import { describe, expect, it } from "vitest";
import { SequenceJitterBuffer } from "./jitter-buffer.js";

describe("SequenceJitterBuffer", () => {
  it("holds out-of-order frames until the missing sequence arrives", () => {
    const buffer = new SequenceJitterBuffer(4);
    expect(buffer.push(10, new Uint8Array([10])).ready.map((frame) => frame.sequence)).toEqual([10]);
    expect(buffer.push(12, new Uint8Array([12])).ready).toEqual([]);

    const result = buffer.push(11, new Uint8Array([11]));
    expect(result.ready.map((frame) => frame.sequence)).toEqual([11, 12]);
    expect(result.ready.map((frame) => frame.payload[0])).toEqual([11, 12]);
    expect(buffer.pendingFrames).toBe(0);
  });

  it("drops duplicates and frames older than the expected sequence", () => {
    const buffer = new SequenceJitterBuffer(4);
    buffer.push(2, new Uint8Array([2]));
    expect(buffer.push(2, new Uint8Array([99])).dropped).toBe(true);
    expect(buffer.push(1, new Uint8Array([1])).dropped).toBe(true);
  });

  it("reports a sequence-window overflow and resumes from the earliest buffered frame", () => {
    const buffer = new SequenceJitterBuffer(3);
    buffer.push(0, new Uint8Array([0]));
    buffer.push(2, new Uint8Array([2]));

    const result = buffer.push(4, new Uint8Array([4]));
    expect(result.overflowed).toBe(true);
    expect(result.ready.map((frame) => frame.sequence)).toEqual([2]);
    expect(buffer.pendingFrames).toBe(1);
  });

  it("resets the next expected sequence when requested", () => {
    const buffer = new SequenceJitterBuffer(4);
    buffer.push(5, new Uint8Array([5]));
    buffer.reset(20);
    expect(buffer.pendingFrames).toBe(0);
    expect(buffer.push(20, new Uint8Array([20])).ready.map((frame) => frame.sequence)).toEqual([20]);
  });
});
