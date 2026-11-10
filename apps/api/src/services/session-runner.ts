import { MockPlannerAdapter, MockTelephonyAdapter } from "@vaani/adapters";
import type { CallState, DemoScenario, ServerEvent, Speaker } from "@vaani/protocol";
import { getDemoScript, isAllowedTransition, bumpGeneration, transitionCall } from "@vaani/orchestrator";
import { redactPii } from "@vaani/orchestrator";
import type { ApiContext, LiveCallSession, SessionSubscriber } from "../types.js";

const planner = new MockPlannerAdapter();
const telephony = new MockTelephonyAdapter();
const PRIVATE_SENSITIVE_PATTERN = /\b(otp|one[ -]?time (?:code|password)|password|passcode|cvv|cvc|upi pin|card number|bank pin|payment details|kyc|consent)\b|\b\d{4,8}\b/i;
const DEMO_OBJECTIVE_SENSITIVE_PATTERN = /\b(otp|one[ -]?time (?:code|password)|password|passcode|cvv|cvc|upi pin|card number|bank pin|payment details|kyc|consent|medical history|diagnosis|prescription|symptoms)\b|\b\d{4,8}\b/i;

function emit(context: ApiContext, session: LiveCallSession, event: ServerEvent): void {
  context.sessions.emit(session.snapshot.id, event);
  void context.runtime.publish(`call:${session.snapshot.id}`, event);
}

function schedule(context: ApiContext, session: LiveCallSession, delayMs: number): void {
  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(() => {
    session.timer = null;
    void advanceScript(context, session).catch(() => {
      void finishCall(context, session, "The simulation stopped after an internal error. No real call occurred.");
    });
  }, Math.max(150, Math.min(delayMs, 3_000)));
  (session.timer as NodeJS.Timeout).unref?.();
}

export async function transitionLiveCall(
  context: ApiContext,
  session: LiveCallSession,
  next: CallState,
  trigger: string,
): Promise<void> {
  if (session.snapshot.state === next) return;
  const event = transitionCall(session.snapshot, next, trigger);
  context.metrics.transition(event.from_state, event.to_state);
  emit(context, session, { type: "state", value: event.to_state, t: event.ts, trigger: event.trigger });

  if (session.userId) {
    try {
      await context.store.appendEvent({
        id: event.id,
        callId: event.callId,
        ts: event.ts,
        fromState: event.from_state,
        toState: event.to_state,
        trigger: event.trigger,
      });
      await context.store.updateCall(session.snapshot.id, session.userId, next, null, next === "ENDED" ? event.ts : null);
    } catch {
      emit(context, session, {
        type: "error",
        code: "history_write_failed",
        message: "This simulation could not save a complete call history.",
      });
    }
  }
  await context.runtime.setJson("call", session.snapshot.id, {
    state: session.snapshot.state,
    startedAt: session.snapshot.startedAt,
    generationId: session.snapshot.generationId,
  }, 24 * 60 * 60);
}

export async function addTranscript(
  context: ApiContext,
  session: LiveCallSession,
  speaker: Speaker,
  rawText: string,
): Promise<string> {
  const text = redactPii(rawText).slice(0, 1_200);
  const ts = Date.now();
  emit(context, session, { type: "transcript", speaker, text, final: true, lang: "en-IN" });
  if (speaker === "Agent→Callee") emit(context, session, { type: "agent.say", text, to: "callee" });
  if (speaker === "Agent→You") emit(context, session, { type: "agent.say", text, to: "user" });
  if (session.userId && !session.isPublicDemo) {
    try {
      await context.store.appendTranscript({
        id: crypto.randomUUID(),
        callId: session.snapshot.id,
        ts,
        speaker,
        text,
        confidence: null,
        lang: "en-IN",
      });
    } catch {
      emit(context, session, {
        type: "error",
        code: "transcript_write_failed",
        message: "The simulation transcript could not be saved completely.",
      });
    }
  }
  return text;
}

export async function startScenario(context: ApiContext, session: LiveCallSession, scenario: DemoScenario, objective?: string): Promise<void> {
  if (!session.isPublicDemo || session.started || session.snapshot.state !== "INITIATED") {
    emit(context, session, { type: "error", code: "scenario_already_started", message: "This mock scenario has already started." });
    return;
  }
  if (objective && DEMO_OBJECTIVE_SENSITIVE_PATTERN.test(objective)) {
    emit(context, session, { type: "error", code: "sensitive_detail_not_allowed", message: "Do not enter personal, medical, verification, or payment details. They are not accepted by this demo." });
    return;
  }
  if (objective) session.objective = redactPii(objective).slice(0, 240);
  session.scenario = scenario;
  session.script = getDemoScript(scenario);
  session.scriptIndex = 0;
  session.started = true;
  schedule(context, session, 400);
}

export function beginPrivateSession(context: ApiContext, session: LiveCallSession): void {
  if (session.isPublicDemo || session.finished || session.started) return;
  session.started = true;
  schedule(context, session, 350);
}

export async function advanceScript(context: ApiContext, session: LiveCallSession): Promise<void> {
  if (session.finished || !session.started) return;
  const step = session.script[session.scriptIndex];
  if (!step) {
    await finishCall(context, session, "The simulated call ended. No real telephone call occurred.");
    return;
  }
  session.scriptIndex += 1;
  if (step.state && step.state !== session.snapshot.state) {
    await transitionLiveCall(context, session, step.state, step.trigger);
  }
  if (step.speaker && step.text) await addTranscript(context, session, step.speaker, step.text);

  if (step.state === "PATCHED_IN") {
    const bridge = await telephony.patchIn(session.snapshot.id);
    emit(context, session, { type: "patch.ready", joinToken: bridge.joinToken, simulated: true });
  }
  if (step.state === "ENDED") {
    await finishCall(context, session, step.text ?? "The mock call ended. No real telephone call occurred.");
    return;
  }
  schedule(context, session, step.delayMs);
}

export async function finishCall(context: ApiContext, session: LiveCallSession, summary: string): Promise<void> {
  if (session.finished) return;
  if (session.timer) clearTimeout(session.timer);
  session.timer = null;
  if (session.snapshot.state !== "ENDING" && session.snapshot.state !== "ENDED" && isAllowedTransition(session.snapshot.state, "ENDING")) {
    await transitionLiveCall(context, session, "ENDING", "user_end");
  }
  if (session.snapshot.state === "ENDING") await transitionLiveCall(context, session, "ENDED", "hangup_complete");
  session.finished = true;
  const safeSummary = redactPii(summary).slice(0, 1_000);
  emit(context, session, { type: "summary", text: safeSummary, simulated: true });
  if (session.userId) {
    try {
      await context.store.updateCall(session.snapshot.id, session.userId, "ENDED", safeSummary, session.snapshot.endedAt);
    } catch { /* State transitions already contain the durable best-effort record. */ }
    await context.runtime.releaseLease("active-call", session.userId, session.snapshot.id);
  }
  context.sessions.finish(session.snapshot.id);
  context.metrics.setActiveMockSessions(context.sessions.activeCount());
  const cleanup = setTimeout(() => context.sessions.remove(session.snapshot.id), 30 * 60 * 1_000);
  (cleanup as NodeJS.Timeout).unref?.();
}

export async function patchIn(context: ApiContext, session: LiveCallSession): Promise<void> {
  if (session.finished || !isAllowedTransition(session.snapshot.state, "PATCHING_IN")) {
    emit(context, session, { type: "error", code: "patch_unavailable", message: "Patch-in is not available in this call state." });
    return;
  }
  if (session.timer) clearTimeout(session.timer);
  session.timer = null;
  await transitionLiveCall(context, session, "PATCHING_IN", "user_takeover");
  const bridge = await telephony.patchIn(session.snapshot.id);
  await transitionLiveCall(context, session, "PATCHED_IN", "mock_bridge_ready");
  emit(context, session, { type: "patch.ready", joinToken: bridge.joinToken, simulated: true });
}

export async function handleWhisper(
  context: ApiContext,
  session: LiveCallSession,
  text: string,
  replyOnlyToThisUser: SessionSubscriber,
): Promise<void> {
  if (session.finished) {
    replyOnlyToThisUser({ type: "error", code: "call_ended", message: "This mock call has ended." });
    return;
  }
  if (session.timer) clearTimeout(session.timer);
  session.timer = null;
  const priorState = session.resumeState ?? session.snapshot.state;
  if (session.snapshot.state !== "USER_WHISPERING") {
    if (!isAllowedTransition(session.snapshot.state, "USER_WHISPERING")) {
      replyOnlyToThisUser({ type: "error", code: "whisper_unavailable", message: "Whisper is unavailable in this call state." });
      return;
    }
    session.resumeState = session.snapshot.state;
    await transitionLiveCall(context, session, "USER_WHISPERING", "user_whisper");
  }

  const oldGeneration = session.snapshot.generationId;
  planner.cancel(oldGeneration);
  session.snapshot.generationId = bumpGeneration(session.snapshot);
  const sharedGeneration = await context.runtime.bumpGeneration(session.snapshot.id);
  session.snapshot.generationId = Math.max(session.snapshot.generationId, sharedGeneration);

  if (PRIVATE_SENSITIVE_PATTERN.test(text)) {
    replyOnlyToThisUser({ type: "whisper.ack", audio: false, text: "Sensitive details are not repeated or stored. Enter them yourself directly with the business." });
    replyOnlyToThisUser({ type: "agent.say", to: "user", text: "I will pause here. You can handle that sensitive step directly." });
  } else {
    // The whisper is passed only to the local mock planner, is never logged or persisted, and is discarded after replanning.
    const transientTranscript = `User whisper: ${text.slice(0, 240)}`;
    const plan = await planner.plan({
      generationId: session.snapshot.generationId,
      objective: session.objective,
      transcript: transientTranscript,
      currentState: session.snapshot.state,
      safetyFlags: [],
    });
    replyOnlyToThisUser({ type: "whisper.ack", audio: false, text: "Your direction was received privately in this simulation." });
    for (const tool of plan) {
      if (tool.name === "speak_to_user") replyOnlyToThisUser({ type: "agent.say", to: "user", text: tool.text });
      if (tool.name === "end_call") {
        await finishCall(context, session, "The user asked to stop the simulated call.");
        return;
      }
    }
  }

  const restore = (): void => {
    if (session.finished || session.snapshot.state !== "USER_WHISPERING") return;
    const next = session.resumeState ?? priorState;
    session.resumeState = null;
    void transitionLiveCall(context, session, next, "whisper_replanned")
      .then(() => schedule(context, session, 500))
      .catch(() => finishCall(context, session, "The simulated call stopped after a replan error."));
  };
  session.timer = setTimeout(restore, 500);
  (session.timer as NodeJS.Timeout).unref?.();
}

export function handleWhisperAudio(
  session: LiveCallSession,
  sequence: number,
  pcm16Base64: string,
  sendToThisUser: SessionSubscriber,
): void {
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence <= session.lastAudioSeq) {
    sendToThisUser({ type: "error", code: "audio_sequence_invalid", message: "The microphone frame sequence was stale or invalid." });
    return;
  }
  if (session.finished || !/^[A-Za-z0-9+/]+={0,2}$/.test(pcm16Base64)) {
    sendToThisUser({ type: "error", code: "audio_frame_invalid", message: "The microphone frame could not be accepted." });
    return;
  }
  const frame = Buffer.from(pcm16Base64, "base64");
  if (frame.length < 2 || frame.length > 1_280 || frame.length % 2 !== 0) {
    sendToThisUser({ type: "error", code: "audio_frame_invalid", message: "Expected a short 16 kHz mono PCM16 frame." });
    return;
  }
  session.lastAudioSeq = sequence;
  const now = Date.now();
  if (now - session.lastAudioAckAt > 1_000) {
    session.lastAudioAckAt = now;
    sendToThisUser({
      type: "whisper.ack",
      audio: true,
      text: "Audio reached the mock client path; it was not transcribed, sent to a provider, or recorded.",
    });
  }
}

export async function handleEnd(context: ApiContext, session: LiveCallSession): Promise<void> {
  await finishCall(context, session, "The user ended the simulated call. No real telephone call occurred.");
}
