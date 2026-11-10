import type { CallState, DemoScenario, Speaker } from "@vaani/protocol";

export const JOURNEY_STEPS = [
  { id: "dial", label: "Dial", detail: "A task is confirmed before the mock call begins." },
  { id: "ivr", label: "IVR", detail: "The agent listens to the menu and sends a simulated DTMF choice." },
  { id: "hold", label: "Hold", detail: "The agent waits quietly through simulated hold music." },
  { id: "human", label: "Human", detail: "The agent explains that it is an AI and asks for routine help." },
  { id: "whisper", label: "Whisper", detail: "The user can correct the plan privately in a simulation." },
  { id: "patch-in", label: "Patch-in", detail: "A mock bridge hands sensitive steps to the user." },
  { id: "summary", label: "Summary", detail: "The call closes with a short simulated outcome." },
] as const;

export interface DemoScriptStep {
  state?: CallState;
  speaker?: Speaker;
  text?: string;
  trigger: string;
  delayMs: number;
}

const scripts: Record<DemoScenario, DemoScriptStep[]> = {
  clinic_appointment: [
    { state: "IVR_NAVIGATING", speaker: "IVR", text: "For appointments, press 1. For opening hours, press 2.", trigger: "ivr_detected", delayMs: 700 },
    { speaker: "Agent→Callee", text: "[DTMF 1 sent in simulation]", trigger: "send_dtmf_1", delayMs: 600 },
    { state: "ON_HOLD", speaker: "IVR", text: "Please hold. An associate will be with you shortly.", trigger: "hold_detected", delayMs: 800 },
    { state: "CALLEE_SPEAKING", speaker: "Callee", text: "Hello, this is the appointments desk. How can I help?", trigger: "human_answered", delayMs: 1_000 },
    { state: "AGENT_SPEAKING", speaker: "Agent→Callee", text: "Hello, I am an AI calling on the user's behalf. Could you share the next available routine appointment?", trigger: "ai_disclosure", delayMs: 750 },
    { state: "CALLEE_SPEAKING", speaker: "Callee", text: "There is a morning slot available next week. I can reserve it after the person confirms.", trigger: "availability_shared", delayMs: 1_000 },
    { state: "ENDING", speaker: "Agent→Callee", text: "Thank you. I will confirm the details with the user.", trigger: "end_requested", delayMs: 700 },
    { state: "ENDED", speaker: "Agent→You", text: "The clinic shared a possible morning slot next week. No appointment was booked in this simulation.", trigger: "mock_summary", delayMs: 400 },
  ],
  three_level_ivr: [
    { state: "IVR_NAVIGATING", speaker: "IVR", text: "Welcome. Press 1 for services.", trigger: "ivr_level_1", delayMs: 600 },
    { speaker: "Agent→Callee", text: "[DTMF 1 sent in simulation]", trigger: "send_dtmf_1", delayMs: 500 },
    { speaker: "IVR", text: "Press 2 for appointments.", trigger: "ivr_level_2", delayMs: 600 },
    { speaker: "Agent→Callee", text: "[DTMF 2 sent in simulation]", trigger: "send_dtmf_2", delayMs: 500 },
    { speaker: "IVR", text: "Press 3 to speak with reception.", trigger: "ivr_level_3", delayMs: 600 },
    { state: "CALLEE_SPEAKING", speaker: "Callee", text: "Reception is available. This is a simulated menu path.", trigger: "ivr_exit", delayMs: 700 },
    { state: "AGENT_SPEAKING", speaker: "Agent→Callee", text: "Hello, I am an AI calling on the user's behalf.", trigger: "ai_disclosure", delayMs: 700 },
    { state: "ENDING", trigger: "end_requested", delayMs: 500 },
    { state: "ENDED", speaker: "Agent→You", text: "The three-level menu was navigated in simulation. No telephone call occurred.", trigger: "mock_summary", delayMs: 300 },
  ],
  ivr_loop: [
    { state: "IVR_NAVIGATING", speaker: "IVR", text: "Press 1 for appointments.", trigger: "ivr_level_1", delayMs: 600 },
    { speaker: "Agent→Callee", text: "[DTMF 1 sent in simulation]", trigger: "send_dtmf_1", delayMs: 500 },
    { speaker: "IVR", text: "Press 1 for appointments.", trigger: "ivr_loop_detected", delayMs: 700 },
    { state: "ENDING", speaker: "Agent→You", text: "The menu repeated. I am stopping instead of looping indefinitely.", trigger: "loop_guard", delayMs: 500 },
    { state: "ENDED", speaker: "Agent→You", text: "The IVR loop guard ended the simulated call safely.", trigger: "mock_summary", delayMs: 300 },
  ],
  hangup: [
    { state: "IVR_NAVIGATING", speaker: "IVR", text: "Please choose an option.", trigger: "ivr_detected", delayMs: 600 },
    { state: "ENDING", speaker: "Agent→You", text: "The far end disconnected in this scenario.", trigger: "remote_hangup", delayMs: 700 },
    { state: "ENDED", speaker: "Agent→You", text: "The simulated line disconnected before the task completed.", trigger: "mock_summary", delayMs: 300 },
  ],
  hold_timeout: [
    { state: "IVR_NAVIGATING", speaker: "IVR", text: "All associates are busy. Please hold.", trigger: "hold_prompt", delayMs: 600 },
    { state: "ON_HOLD", speaker: "IVR", text: "[Hold music — the agent stays quiet in this simulation]", trigger: "hold_detected", delayMs: 800 },
    { state: "ENDING", speaker: "Agent→You", text: "The three-minute hold limit is reached in the mock scenario.", trigger: "hold_timeout", delayMs: 900 },
    { state: "ENDED", speaker: "Agent→You", text: "The simulated call ended after the hold-time guard.", trigger: "mock_summary", delayMs: 300 },
  ],
  otp_request: [
    { state: "IVR_NAVIGATING", speaker: "IVR", text: "For verification, please speak to reception.", trigger: "ivr_detected", delayMs: 600 },
    { state: "CALLEE_SPEAKING", speaker: "Callee", text: "I need a one-time verification code to continue.", trigger: "otp_requested", delayMs: 800 },
    { state: "PATCHING_IN", speaker: "Agent→You", text: "A sensitive step was detected. The simulation is handing control to you.", trigger: "safety_handoff", delayMs: 600 },
    { state: "PATCHED_IN", speaker: "Agent→You", text: "[Mock bridge ready — no real phone line is connected]", trigger: "mock_bridge_ready", delayMs: 500 },
    { state: "ENDING", trigger: "user_completed_step", delayMs: 600 },
    { state: "ENDED", speaker: "Agent→You", text: "The sensitive step was handed to the user. No code was requested or stored.", trigger: "mock_summary", delayMs: 300 },
  ],
};

export function getDemoScript(scenario: DemoScenario): readonly DemoScriptStep[] {
  return scripts[scenario];
}

export function getScenarioTitle(scenario: DemoScenario): string {
  const titles: Record<DemoScenario, string> = {
    clinic_appointment: "Clinic appointment",
    three_level_ivr: "Three-level IVR",
    ivr_loop: "IVR loop guard",
    hangup: "Remote hangup",
    hold_timeout: "Hold timeout",
    otp_request: "Sensitive-step handoff",
  };
  return titles[scenario];
}
