import { describe, expect, it } from "vitest";
import {
  decodeMuLaw,
  encodeMuLaw,
  isExactTelephonyFrame,
  linearToMuLaw,
  muLawToLinear,
  MULAW_BYTES_PER_FRAME,
  PCM16_BYTES_PER_FRAME,
  splitBytesIntoFrames,
} from "./index.js";

describe("G.711 μ-law helpers", () => {
  it("encodes and decodes silence", () => {
    const encoded = linearToMuLaw(0);
    expect(encoded).toBe(0xff);
    expect(muLawToLinear(encoded)).toBe(0);
  });

  it("round-trips representative signed samples within companding tolerance", () => {
    const samples = new Int16Array([-30_000, -12_000, -1_000, -64, 0, 64, 1_000, 12_000, 30_000]);
    const decoded = decodeMuLaw(encodeMuLaw(samples));
    for (let index = 0; index < samples.length; index += 1) {
      expect(Math.abs((decoded[index] ?? 0) - (samples[index] ?? 0))).toBeLessThan(2_100);
    }
  });

  it("produces exact 20 ms narrowband and browser PCM frames", () => {
    expect(MULAW_BYTES_PER_FRAME).toBe(160);
    expect(PCM16_BYTES_PER_FRAME).toBe(640);
    const frames = splitBytesIntoFrames(new Uint8Array(335));
    expect(frames.map((frame) => frame.length)).toEqual([160, 160]);
    expect(isExactTelephonyFrame(frames[0] ?? new Uint8Array())).toBe(true);
  });
});
