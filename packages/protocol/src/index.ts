import { z } from "zod";

export const CALL_STATES = [
  "INITIATED",
  "IVR_NAVIGATING",
  "ON_HOLD",
  "CALLEE_SPEAKING",
  "AGENT_SPEAKING",
  "USER_WHISPERING",
  "PATCHING_IN",
  "PATCHED_IN",
  "ENDING",
  "ENDED",
] as const;

export const CallStateSchema = z.enum(CALL_STATES);
export type CallState = z.infer<typeof CallStateSchema>;

export const SPEAKERS = ["IVR", "Callee", "Agent→Callee", "Agent→You", "You"] as const;
export type Speaker = (typeof SPEAKERS)[number];
export const DemoScenarioSchema = z.enum([
  "clinic_appointment",
  "three_level_ivr",
  "ivr_loop",
  "hangup",
  "hold_timeout",
  "otp_request",
]);
export type DemoScenario = z.infer<typeof DemoScenarioSchema>;

const safeText = (max: number) => z.string().trim().min(1).max(max);
const normalizedPhone = z.string().trim().regex(/^\+?[0-9() .-]{7,24}$/).optional();

export const ClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("task.create"), taskId: z.string().uuid().optional(), objective: safeText(600), toNumber: normalizedPhone }),
  z.object({ type: z.literal("task.confirm"), taskId: z.string().uuid(), confirmed: z.boolean() }),
  z.object({ type: z.literal("whisper.audio"), seq: z.number().int().nonnegative(), pcm16: z.string().min(1).max(40_000) }),
  z.object({ type: z.literal("whisper.text"), text: safeText(240) }),
  z.object({ type: z.literal("action.patch_in") }),
  z.object({ type: z.literal("action.end") }),
  z.object({ type: z.literal("demo.start"), scenario: DemoScenarioSchema.default("clinic_appointment"), objective: safeText(240).optional() }),
  z.object({ type: z.literal("demo.advance") }),
  z.object({ type: z.literal("demo.whisper"), text: safeText(240) }),
  z.object({ type: z.literal("ping") }),
]);
export type ClientEvent = z.infer<typeof ClientEventSchema>;

export const ServerEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.ready"), mode: z.literal("mock"), callId: z.string().uuid().optional() }),
  z.object({ type: z.literal("state"), value: CallStateSchema, t: z.number().int().nonnegative(), trigger: z.string().max(80).optional() }),
  z.object({ type: z.literal("transcript"), speaker: z.enum(SPEAKERS), text: safeText(1200), final: z.boolean(), lang: z.string().max(24).optional() }),
  z.object({ type: z.literal("agent.say"), text: safeText(1200), to: z.enum(["callee", "user"]) }),
  z.object({ type: z.literal("whisper.ack"), audio: z.boolean(), text: z.string().max(300).optional() }),
  z.object({ type: z.literal("patch.ready"), joinToken: z.string().min(8).max(128), simulated: z.literal(true) }),
  z.object({ type: z.literal("summary"), text: safeText(1000), simulated: z.literal(true) }),
  z.object({ type: z.literal("task.created"), taskId: z.string().uuid(), restatement: safeText(700) }),
  z.object({ type: z.literal("task.confirmed"), taskId: z.string().uuid(), confirmed: z.boolean() }),
  z.object({ type: z.literal("audio.ack"), seq: z.number().int().nonnegative(), captured: z.boolean() }),
  z.object({ type: z.literal("error"), code: z.string().max(64), message: safeText(300) }),
  z.object({ type: z.literal("pong"), t: z.number().int().nonnegative() }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;

export interface CallEventRecord {
  id: string;
  callId: string;
  ts: number;
  from_state: CallState;
  to_state: CallState;
  trigger: string;
}

export interface TranscriptRecord {
  id: string;
  callId: string;
  ts: number;
  speaker: Speaker;
  text: string;
  confidence: number | null;
  lang: string | null;
}

export function safeParseClientEvent(value: unknown) {
  return ClientEventSchema.safeParse(value);
}
