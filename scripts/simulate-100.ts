import { getDemoScript } from "@vaani/orchestrator";
import { createCallSnapshot, transitionCall } from "@vaani/orchestrator";
import type { DemoScenario } from "@vaani/protocol";

const scenarios: DemoScenario[] = ["clinic_appointment", "three_level_ivr", "ivr_loop", "hangup", "hold_timeout", "otp_request"];
const runs = Number(process.env.SIMULATION_RUNS ?? 100);
let transitions = 0;
for (let run = 0; run < runs; run += 1) {
  const scenario = scenarios[run % scenarios.length]!;
  const call = createCallSnapshot(1_000 + run * 10_000);
  const steps = getDemoScript(scenario);
  for (const step of steps) {
    if (step.state && step.state !== call.state) {
      transitionCall(call, step.state, step.trigger, call.startedAt + call.events.length + 1);
      transitions += 1;
    }
  }
  if (call.state !== "ENDED") throw new Error(`${scenario} finished in ${call.state}, expected ENDED`);
}
console.log(JSON.stringify({ mode: "deterministic-script-state-smoke", realCalls: 0, runs, scenarios: [...new Set(Array.from({length:runs}, (_,i)=>scenarios[i%scenarios.length]!))], acceptedTransitions: transitions, successRate: 1 }));
