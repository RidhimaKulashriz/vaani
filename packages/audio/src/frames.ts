export const TELEPHONY_SAMPLE_RATE = 8_000;
export const TELEPHONY_FRAME_MS = 20;
export const TELEPHONY_SAMPLES_PER_FRAME = (TELEPHONY_SAMPLE_RATE * TELEPHONY_FRAME_MS) / 1_000;
export const MULAW_BYTES_PER_FRAME = TELEPHONY_SAMPLES_PER_FRAME;

export const WHISPER_SAMPLE_RATE = 16_000;
export const PCM16_FRAME_MS = 20;
export const PCM16_SAMPLES_PER_FRAME = (WHISPER_SAMPLE_RATE * PCM16_FRAME_MS) / 1_000;
export const PCM16_BYTES_PER_FRAME = PCM16_SAMPLES_PER_FRAME * 2;

export function splitBytesIntoFrames(input: Uint8Array, frameBytes = MULAW_BYTES_PER_FRAME): Uint8Array[] {
  if (!Number.isInteger(frameBytes) || frameBytes < 1) throw new RangeError("frameBytes must be a positive integer");
  const frames: Uint8Array[] = [];
  for (let offset = 0; offset + frameBytes <= input.length; offset += frameBytes) {
    frames.push(input.slice(offset, offset + frameBytes));
  }
  return frames;
}

export function isExactTelephonyFrame(frame: Uint8Array): boolean {
  return frame.byteLength === MULAW_BYTES_PER_FRAME;
}
