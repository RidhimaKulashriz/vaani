import { describe, expect, it } from "vitest";
import { CALL_STATES } from "@vaani/protocol";
import { createCallSnapshot, isAllowedTransition, transitionCall } from "./state-machine.js";

describe("call state machine", () => {
  it("defines the ten required states", () => {
    expect(CALL_STATES).toHaveLength(10);
  });

  it("records each transition with timestamps and triggers", () => {
    const call = createCallSnapshot(1_000);
    const event = transitionCall(call, "IVR_NAVIGATING", "menu_detected", 1_020);
    expect(event).toMatchObject({ from_state: "INITIATED", to_state: "IVR_NAVIGATING", trigger: "menu_detected", ts: 1_020 });
    expect(call.state).toBe("IVR_NAVIGATING");
  });

  it("rejects unsafe direct transitions and changes after termination", () => {
    const call = createCallSnapshot();
    expect(isAllowedTransition("INITIATED", "PATCHED_IN")).toBe(false);
    expect(() => transitionCall(call, "PATCHED_IN", "bypass")).toThrow("Invalid transition");
    transitionCall(call, "ENDING", "user_end");
    transitionCall(call, "ENDED", "hangup");
    expect(call.endedAt).not.toBeNull();
    expect(() => transitionCall(call, "AGENT_SPEAKING", "late_plan")).toThrow("Invalid transition");
  });
});
