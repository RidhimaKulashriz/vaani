import type { DemoScenario } from "@vaani/protocol";
import { encodeMuLaw } from "@vaani/audio";

export type ProviderId = "gnani-prisma" | "gnani-evon" | "gnani-timbre" | "twilio" | "exotel" | "plivo";
export type AudioCodec = "pcm_s16le" | "g711_mulaw";

export interface AudioStreamConfig {
  sampleRate: 8_000 | 16_000;
  channels: 1;
  codec: AudioCodec;
  language: string;
}

export interface SpeechSegment {
  text: string | null;
  confidence: number | null;
  language: string | null;
  final: boolean;
}

export interface SttAdapter {
  readonly provider: "mock" | "gnani-prisma";
  openStream(config: AudioStreamConfig): Promise<void>;
  pushFrame(frame: Uint8Array): Promise<SpeechSegment>;
  close(): Promise<void>;
}

export type PlannerTool =
  | { name: "speak_to_callee"; text: string }
  | { name: "speak_to_user"; text: string }
  | { name: "send_dtmf"; digits: string }
  | { name: "wait"; seconds: number }
  | { name: "patch_in_user" }
  | { name: "end_call" };

export interface PlannerRequest {
  generationId: number;
  objective: string;
  transcript: string;
  currentState: string;
  safetyFlags: string[];
}

export interface PlannerAdapter {
  readonly provider: "mock" | "gnani-evon";
  plan(request: PlannerRequest): Promise<PlannerTool[]>;
  cancel(generationId: number): void;
}

export interface TtsAdapter {
  readonly provider: "mock" | "gnani-timbre";
  synthesize(text: string): AsyncIterable<Uint8Array>;
}

export interface DialRequest {
  scenario: DemoScenario;
  destinationHash: string | null;
  consentRecorded: boolean;
}

export interface TelephonyAdapter {
  readonly provider: "mock" | "twilio" | "exotel" | "plivo";
  dial(request: DialRequest): Promise<{ callId: string; simulated: boolean }>;
  sendDtmf(callId: string, digits: string): Promise<void>;
  patchIn(callId: string): Promise<{ joinToken: string; simulated: boolean }>;
  hangup(callId: string): Promise<void>;
}

export class MockSttAdapter implements SttAdapter {
  readonly provider = "mock" as const;
  private config: AudioStreamConfig | null = null;
  async openStream(config: AudioStreamConfig): Promise<void> { this.config = config; }
  async pushFrame(frame: Uint8Array): Promise<SpeechSegment> {
    void frame;
    if (!this.config) throw new Error("STT stream is not open");
    return { text: null, confidence: null, language: this.config.language, final: false };
  }
  async close(): Promise<void> { this.config = null; }
}

export class MockPlannerAdapter implements PlannerAdapter {
  readonly provider = "mock" as const;
  private readonly cancelled = new Set<number>();
  async plan(request: PlannerRequest): Promise<PlannerTool[]> {
    await Promise.resolve();
    if (this.cancelled.has(request.generationId)) return [];
    if (request.safetyFlags.some((flag) => ["otp", "password", "payment", "kyc", "consent"].includes(flag))) {
      return [{ name: "patch_in_user" }];
    }
    if (/\b(stop|cancel|do not continue|don't continue)\b/i.test(request.transcript)) {
      return [
        { name: "speak_to_user", text: "Understood. I will stop this task." },
        { name: "end_call" },
      ];
    }
    if (/user whisper:/i.test(request.transcript)) {
      return [{ name: "speak_to_user", text: "I heard your direction and will adjust the next step." }];
    }
    return [
      { name: "speak_to_callee", text: "Hello, I am an AI assistant calling on the user's behalf. I can help with a routine request." },
      { name: "wait", seconds: 1 },
      { name: "end_call" },
    ];
  }
  cancel(generationId: number): void { this.cancelled.add(generationId); }
}

export class MockTtsAdapter implements TtsAdapter {
  readonly provider = "mock" as const;
  async *synthesize(text: string): AsyncIterable<Uint8Array> {
    void text;
    const silence = new Uint8Array(160).fill(0xff);
    for (let frame = 0; frame < 10; frame += 1) yield silence.slice();
  }
}

export class MockTelephonyAdapter implements TelephonyAdapter {
  readonly provider = "mock" as const;
  private readonly ended = new Set<string>();
  async dial(request: DialRequest): Promise<{ callId: string; simulated: boolean }> {
    void request;
    return { callId: crypto.randomUUID(), simulated: true };
  }
  async sendDtmf(callId: string, digits: string): Promise<void> {
    if (this.ended.has(callId)) throw new Error("Simulated call has ended");
    if (!/^[0-9*#]{1,8}$/.test(digits)) throw new Error("Invalid DTMF digits");
  }
  async patchIn(callId: string): Promise<{ joinToken: string; simulated: boolean }> {
    if (this.ended.has(callId)) throw new Error("Simulated call has ended");
    return { joinToken: `mock-${crypto.randomUUID()}`, simulated: true };
  }
  async hangup(callId: string): Promise<void> { this.ended.add(callId); }
}

export function createMockAdapters() {
  return {
    stt: new MockSttAdapter(),
    planner: new MockPlannerAdapter(),
    tts: new MockTtsAdapter(),
    telephony: new MockTelephonyAdapter(),
    encodeTelephonySilence(): Uint8Array { return encodeMuLaw(new Int16Array(160)); },
  };
}

export const LIVE_CALLS_DISABLED_NOTICE =
  "Real telephony is disabled. Configure and review a provider integration and consenting test-number policy before enabling any live call.";
