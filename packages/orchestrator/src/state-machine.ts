import { randomUUID } from "node:crypto";
import { CALL_STATES, type CallEventRecord, type CallState } from "@vaani/protocol";

export const ALLOWED_TRANSITIONS: Record<CallState, readonly CallState[]> = {
  INITIATED: ["IVR_NAVIGATING", "CALLEE_SPEAKING", "ENDING"],
  IVR_NAVIGATING: ["ON_HOLD", "CALLEE_SPEAKING", "USER_WHISPERING", "PATCHING_IN", "ENDING"],
  ON_HOLD: ["IVR_NAVIGATING", "CALLEE_SPEAKING", "USER_WHISPERING", "PATCHING_IN", "ENDING"],
  CALLEE_SPEAKING: ["AGENT_SPEAKING", "USER_WHISPERING", "PATCHING_IN", "ENDING"],
  AGENT_SPEAKING: ["CALLEE_SPEAKING", "ON_HOLD", "USER_WHISPERING", "PATCHING_IN", "ENDING"],
  USER_WHISPERING: ["IVR_NAVIGATING", "ON_HOLD", "CALLEE_SPEAKING", "AGENT_SPEAKING", "PATCHING_IN", "ENDING"],
  PATCHING_IN: ["PATCHED_IN", "ENDING"],
  PATCHED_IN: ["CALLEE_SPEAKING", "AGENT_SPEAKING", "ENDING"],
  ENDING: ["ENDED"],
  ENDED: [],
};

export interface CallSnapshot {
  id: string;
  state: CallState;
  startedAt: number;
  endedAt: number | null;
  events: CallEventRecord[];
  generationId: number;
}

export function createCallSnapshot(now = Date.now()): CallSnapshot {
  return {
    id: randomUUID(),
    state: "INITIATED",
    startedAt: now,
    endedAt: null,
    events: [],
    generationId: 0,
  };
}

export function transitionCall(call: CallSnapshot, next: CallState, trigger: string, now = Date.now()): CallEventRecord {
  if (!CALL_STATES.includes(next)) throw new Error(`Unknown call state: ${next}`);
  if (!ALLOWED_TRANSITIONS[call.state].includes(next)) {
    throw new Error(`Invalid transition ${call.state} → ${next}`);
  }
  const event: CallEventRecord = {
    id: randomUUID(),
    callId: call.id,
    ts: now,
    from_state: call.state,
    to_state: next,
    trigger: trigger.slice(0, 80),
  };
  call.state = next;
  if (next === "ENDED") call.endedAt = now;
  call.events.push(event);
  return event;
}

export function bumpGeneration(call: CallSnapshot): number {
  call.generationId += 1;
  return call.generationId;
}

export function isAllowedTransition(from: CallState, to: CallState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
