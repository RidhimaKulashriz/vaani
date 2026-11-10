const BIAS = 0x84;
const CLIP = 32635;

export function linearToMuLaw(sample: number): number {
  if (!Number.isFinite(sample)) throw new TypeError("PCM sample must be finite");
  let pcm = Math.max(-32768, Math.min(32767, Math.trunc(sample)));
  const sign = pcm < 0 ? 0x80 : 0;
  if (pcm < 0) pcm = -pcm;
  pcm = Math.min(pcm, CLIP) + BIAS;

  let exponent = 7;
  for (let mask = 0x4000; exponent > 0 && (pcm & mask) === 0; mask >>= 1) exponent -= 1;
  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}

export function muLawToLinear(encoded: number): number {
  if (!Number.isInteger(encoded) || encoded < 0 || encoded > 255) {
    throw new RangeError("μ-law byte must be an integer between 0 and 255");
  }
  const value = (~encoded) & 0xff;
  const sign = value & 0x80;
  const exponent = (value >> 4) & 0x07;
  const mantissa = value & 0x0f;
  let sample = ((mantissa << 3) + BIAS) << exponent;
  sample -= BIAS;
  return sign ? -sample : sample;
}

export function encodeMuLaw(samples: Int16Array): Uint8Array {
  const encoded = new Uint8Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) encoded[index] = linearToMuLaw(samples[index] ?? 0);
  return encoded;
}

export function decodeMuLaw(bytes: Uint8Array): Int16Array {
  const decoded = new Int16Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) decoded[index] = muLawToLinear(bytes[index] ?? 0xff);
  return decoded;
}
