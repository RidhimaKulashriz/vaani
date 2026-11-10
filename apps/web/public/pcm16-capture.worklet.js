/* global AudioWorkletProcessor, sampleRate, registerProcessor */
class Pcm16FrameCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = [];
    this.bufferStart = 0;
    this.totalInput = 0;
    this.outputIndex = 0;
    this.frame = new Int16Array(320);
    this.frameIndex = 0;
    this.sourceSamplesPerOutput = sampleRate / 16000;
  }

  process(inputs, outputs) {
    const output = outputs[0]?.[0];
    if (output) output.fill(0);
    const input = inputs[0]?.[0];
    if (!input) return true;

    for (let index = 0; index < input.length; index += 1) {
      this.samples.push(input[index] ?? 0);
      this.totalInput += 1;
    }

    while (true) {
      const position = this.outputIndex * this.sourceSamplesPerOutput;
      const leftIndex = Math.floor(position);
      if (leftIndex + 1 >= this.totalInput) break;
      const left = this.samples[leftIndex - this.bufferStart] ?? 0;
      const right = this.samples[leftIndex + 1 - this.bufferStart] ?? left;
      const fraction = position - leftIndex;
      const value = Math.max(-1, Math.min(1, left + (right - left) * fraction));
      this.frame[this.frameIndex] = Math.round(value < 0 ? value * 32768 : value * 32767);
      this.frameIndex += 1;
      this.outputIndex += 1;

      if (this.frameIndex === 320) {
        const buffer = new ArrayBuffer(640);
        const view = new DataView(buffer);
        let sumSquares = 0;
        for (let sampleIndex = 0; sampleIndex < this.frame.length; sampleIndex += 1) {
          const sample = this.frame[sampleIndex] ?? 0;
          view.setInt16(sampleIndex * 2, sample, true);
          const normalized = sample / 32768;
          sumSquares += normalized * normalized;
        }
        this.port.postMessage({ pcm16: buffer, rms: Math.sqrt(sumSquares / 320) }, [buffer]);
        this.frame = new Int16Array(320);
        this.frameIndex = 0;
      }
    }

    const keepFrom = Math.max(0, Math.floor(this.outputIndex * this.sourceSamplesPerOutput) - 1);
    const discard = Math.min(this.samples.length, Math.max(0, keepFrom - this.bufferStart));
    if (discard > 0) {
      this.samples.splice(0, discard);
      this.bufferStart += discard;
    }
    return true;
  }
}

registerProcessor("vaani-pcm16-capture", Pcm16FrameCapture);
