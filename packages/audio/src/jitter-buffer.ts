export interface SequencedFrame {
  sequence: number;
  payload: Uint8Array;
}

export interface JitterPushResult {
  ready: SequencedFrame[];
  dropped: boolean;
  overflowed: boolean;
}

/** Reorders a small window of 20 ms frames; callers choose the 40–80 ms window. */
export class SequenceJitterBuffer {
  private readonly frames = new Map<number, Uint8Array>();
  private expected: number | null = null;

  constructor(private readonly capacityFrames = 4) {
    if (!Number.isInteger(capacityFrames) || capacityFrames < 2 || capacityFrames > 8) {
      throw new RangeError("capacityFrames must be between 2 and 8");
    }
  }

  push(sequence: number, payload: Uint8Array): JitterPushResult {
    if (!Number.isInteger(sequence) || sequence < 0) throw new RangeError("sequence must be a non-negative integer");
    if (this.expected === null) this.expected = sequence;
    if (sequence < this.expected || this.frames.has(sequence)) {
      return { ready: [], dropped: true, overflowed: false };
    }

    let overflowed = false;
    if (sequence - this.expected >= this.capacityFrames || this.frames.size >= this.capacityFrames) {
      const oldest = Math.min(...this.frames.keys(), sequence);
      this.expected = Math.max(this.expected, oldest);
      overflowed = true;
    }
    this.frames.set(sequence, payload.slice());

    const ready: SequencedFrame[] = [];
    while (this.expected !== null) {
      const next = this.frames.get(this.expected);
      if (!next) break;
      ready.push({ sequence: this.expected, payload: next });
      this.frames.delete(this.expected);
      this.expected += 1;
    }
    return { ready, dropped: false, overflowed };
  }

  reset(nextSequence: number | null = null): void {
    this.frames.clear();
    this.expected = nextSequence;
  }

  get pendingFrames(): number {
    return this.frames.size;
  }
}
