"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMockMicrophone } from "../use-mock-microphone";

type Line = { speaker: string; text: string };
type DemoScenario = "clinic_appointment" | "three_level_ivr" | "otp_request";
const INITIAL_LINE: Line = { speaker: "SYSTEM", text: "Demo ready. This is a scripted simulation; no real call is placed." };
const SENSITIVE_TASK = /\b(otp|one[ -]?time (?:code|password)|password|passcode|cvv|cvc|upi pin|card number|bank pin|payment details|kyc|consent|medical history|diagnosis|prescription|symptoms)\b|\b\d{4,8}\b/i;
const SCENARIO_LABELS: Record<DemoScenario, string> = {
  clinic_appointment: "clinic appointment",
  three_level_ivr: "three-level IVR",
  otp_request: "sensitive-step handoff",
};

export default function Demo() {
  const [state, setState] = useState("INITIATED");
  const [lines, setLines] = useState<Line[]>([INITIAL_LINE]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [scenario, setScenario] = useState<DemoScenario>("clinic_appointment");
  const [objective, setObjective] = useState("Book a dermatologist appointment at Apollo Clinic, Saturday morning.");
  const [objectiveError, setObjectiveError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [whisper, setWhisper] = useState("");
  const [started, setStarted] = useState(false);
  const [version, setVersion] = useState(0);
  const [localMode, setLocalMode] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const localModeRef = useRef(false);
  const localTimersRef = useRef<number[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${scheme}://${location.host}/api/demo-call?scenario=${scenario}&v=${version}`);
    socketRef.current = socket;
    socket.onmessage = (message) => {
      if (!active) return;
      try {
        const event = JSON.parse(String(message.data)) as Record<string, unknown>;
        if (event.type === "session.ready") {
          setConnected(true);
          setLines((previous) => [...previous, { speaker: "SYSTEM", text: "Secure demo session connected. Mock call only." }]);
        } else if (event.type === "state" && typeof event.value === "string") {
          setState(event.value);
        } else if (event.type === "transcript" && typeof event.speaker === "string" && typeof event.text === "string") {
          setLines((previous) => [...previous, { speaker: event.speaker as string, text: event.text as string }]);
        } else if (event.type === "agent.say" && typeof event.text === "string") {
          setLines((previous) => [...previous, { speaker: event.to === "user" ? "AGENT → YOU" : "AGENT → BUSINESS", text: event.text as string }]);
        } else if (event.type === "whisper.ack" && event.audio === true && typeof event.text === "string") {
          setMicStatus(event.text as string);
        } else if (event.type === "whisper.ack" && typeof event.text === "string") {
          setLines((previous) => [...previous, { speaker: "PRIVATE WHISPER", text: event.text as string }]);
        } else if (event.type === "summary" && typeof event.text === "string") {
          setLines((previous) => [...previous, { speaker: "SUMMARY", text: event.text as string }]);
        } else if (event.type === "patch.ready") {
          setLines((previous) => [...previous, { speaker: "SYSTEM", text: "Mock patch-in bridge is ready. No real call was connected." }]);
        } else if (event.type === "error" && typeof event.message === "string") {
          if (event.code === "sensitive_detail_not_allowed") {
            setStarted(false);
            setConfirmed(false);
            setReviewed(true);
          }
          setLines((previous) => [...previous, { speaker: "SYSTEM", text: event.message as string }]);
        }
      } catch {
        setLines((previous) => [...previous, { speaker: "SYSTEM", text: "The demo sent an unreadable event. Reset to reconnect." }]);
      }
    };
    socket.onclose = () => { if (active && !localModeRef.current) setConnected(false); };
    socket.onerror = () => {
      if (active) {
        localModeRef.current = true;
        setLocalMode(true);
        setConnected(true);
        setLines((previous) => [...previous, { speaker: "SYSTEM", text: "Local browser simulation enabled. No backend or real call is required." }]);
      }
    };
    return () => {
      active = false;
      socket.close();
      localTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      localTimersRef.current = [];
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [scenario, version]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const playLocalScript = useCallback(() => {
    const script: [string, string][] = scenario === "three_level_ivr"
      ? [
          ["IVR", "Welcome. Press 1 for services."],
          ["Agent→Callee", "[DTMF 1 sent in simulation]"],
          ["IVR", "Press 2 for appointments."],
          ["Agent→Callee", "[DTMF 2 sent in simulation]"],
          ["Callee", "Reception is available. This is a simulated menu path."],
          ["Agent→You", "The three-level menu was navigated in simulation. No telephone call occurred."],
        ]
      : scenario === "otp_request"
        ? [
            ["IVR", "For verification, please speak to reception."],
            ["Callee", "I need a one-time verification code to continue."],
            ["Agent→You", "A sensitive step was detected. The simulation is handing control to you."],
            ["Agent→You", "[Mock bridge ready — no real phone line is connected]"],
            ["Agent→You", "The sensitive step was handed to the user. No code was requested or stored."],
          ]
        : [
            ["IVR", "For appointments, press 1. For opening hours, press 2."],
            ["Agent→Callee", "[DTMF 1 sent in simulation]"],
            ["IVR", "Please hold. An associate will be with you shortly."],
            ["Callee", "Hello, this is the appointments desk. How can I help?"],
            ["Agent→Callee", "Hello, I am an AI calling on the user's behalf. Could you share the next available routine appointment?"],
            ["Callee", "There is a morning slot available next week. I can reserve it after the person confirms."],
            ["Agent→You", "The clinic shared a possible morning slot next week. No appointment was booked in this simulation."],
          ];
    let delay = 250;
    localTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    localTimersRef.current = script.map(([speaker, text]) => {
      const timer = window.setTimeout(() => {
        setLines((previous) => [...previous, { speaker, text }]);
        if (speaker === "IVR") setState("IVR_NAVIGATING");
        if (speaker === "Callee") setState("CALLEE_SPEAKING");
        if (speaker === "Agent→Callee") setState("AGENT_SPEAKING");
        if (speaker === "Agent→You" && text.includes("No telephone")) setState("ENDED");
        if (speaker === "Agent→You" && text.includes("No appointment")) setState("ENDED");
        if (speaker === "Agent→You" && text.includes("No code")) setState("ENDED");
      }, delay += 700);
      return timer;
    });
  }, [scenario]);

  const send = useCallback((type: string, extra: Record<string, unknown> = {}) => {
    if (localModeRef.current) {
      if (type === "demo.start") {
        setState("DIALING");
        playLocalScript();
      } else if (type === "demo.whisper") {
        setLines((previous) => [...previous, { speaker: "PRIVATE WHISPER", text: `Heard privately: ${String(extra.text ?? "")}` }]);
      } else if (type === "action.patch_in") {
        setState("PATCHED_IN");
        setLines((previous) => [...previous, { speaker: "SYSTEM", text: "Mock patch-in bridge is ready. No real call was connected." }]);
      } else if (type === "action.end") {
        setState("ENDED");
        setLines((previous) => [...previous, { speaker: "SUMMARY", text: "The local browser simulation ended safely. No telephone call was placed." }]);
      }
      return true;
    }
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLines((previous) => [...previous, { speaker: "SYSTEM", text: "The demo is not connected yet. Wait for ‘Connected’ or reset to retry." }]);
      return false;
    }
    socket.send(JSON.stringify({ type, ...extra }));
    return true;
  }, [playLocalScript]);

  const { active: micActive, status: micStatus, start: startMicrophone, stop: stopMicrophone, setStatus: setMicStatus } = useMockMicrophone({
    enabled: connected && started && state !== "ENDED",
    onFrame: (frame) => send("whisper.audio", frame),
  });

  function reviewTask() {
    const task = objective.trim();
    if (task.length < 4) {
      setObjectiveError("Describe a routine task in at least four characters.");
      setReviewed(false);
      return;
    }
    if (SENSITIVE_TASK.test(task)) {
      setObjectiveError("Personal, medical, verification, and payment details are not accepted in this demo.");
      setReviewed(false);
      return;
    }
    setObjectiveError("");
    setReviewed(true);
    setConfirmed(false);
  }

  function start() {
    if (!connected || !reviewed || started || busy) return;
    setBusy(true);
    if (send("demo.start", { scenario, objective: objective.trim() })) {
      setStarted(true);
      setConfirmed(true);
      setReviewed(false);
    }
    window.setTimeout(() => setBusy(false), 500);
  }

  function submitWhisper() {
    const text = whisper.trim();
    if (!connected || !started || !text || state === "ENDED") return;
    if (send("demo.whisper", { text })) setWhisper("");
  }

  function act(kind: "whisper" | "patch" | "end") {
    if (!connected || !started || state === "ENDED") return;
    if (kind === "whisper") return submitWhisper();
    send(kind === "patch" ? "action.patch_in" : "action.end");
  }

  function reset() {
    stopMicrophone();
    localModeRef.current = false;
    setLocalMode(false);
    setConnected(false);
    setState("INITIATED");
    setStarted(false);
    setConfirmed(false);
    setReviewed(false);
    setObjectiveError("");
    setBusy(false);
    setWhisper("");
    setLines([INITIAL_LINE]);
    setVersion((value) => value + 1);
  }

  const canControl = connected && started && state !== "ENDED";

  return (
    <main className="console-page">
      <header className="nav">
        <Link href="/" className="brand"><span className="brand-icon">व</span> VAANI·DALAL</Link>
        <span className="eyebrow">INTERACTIVE SIMULATION</span>
        <Link href="/">← BACK TO SITE</Link>
      </header>
      <section className="console-wrap">
        <div className="console-intro">
          <span className="eyebrow"><i className="pulse" /> SANDBOX · {localMode ? "BROWSER SIMULATION" : "NO REAL CALLS"}</span>
          <h1>Try the<br /><i>conversation.</i></h1>
          <p>Enter a routine request, review the mock agent’s restatement, and confirm before the scripted call starts. The demo never contacts a business.</p>
          <label htmlFor="objective">YOUR ROUTINE TASK
            <textarea id="objective" value={objective} maxLength={240} onChange={(event) => { setObjective(event.target.value); setReviewed(false); setObjectiveError(""); }} disabled={started} />
          </label>
          {objectiveError && <p className="task-error" role="alert">{objectiveError}</p>}
          <p className="task-privacy">Task text is used only by this in-memory mock session. Do not enter personal, medical, verification, or payment details.</p>
          <label htmlFor="scenario">SCENARIO
            <select id="scenario" value={scenario} disabled={started} onChange={(event) => {
              setScenario(event.target.value as DemoScenario);
              setConnected(false); setStarted(false); setConfirmed(false); setReviewed(false); setState("INITIATED"); setLines([INITIAL_LINE]);
            }}>
              <option value="clinic_appointment">Clinic appointment</option>
              <option value="three_level_ivr">Three-level IVR</option>
              <option value="otp_request">Sensitive request → transfer</option>
            </select>
          </label>
          {!reviewed && !started && <button className="button dark" onClick={reviewTask} disabled={!connected || busy}>
            {!connected ? "Connecting…" : "Review task"} <span>→</span>
          </button>}
          {reviewed && !started && <div className="task-review" role="group" aria-label="Review and confirm mock task">
            <span className="eyebrow">MOCK AGENT RESTATEMENT</span>
            <p>I’ll run the {SCENARIO_LABELS[scenario]} script to demonstrate this routine request: “{objective.trim()}”. No business will be called and no reservation will be made.</p>
            <button className="button dark" onClick={start} disabled={!connected || busy}>
              {busy ? "Starting…" : "Confirm task and start simulation"} <span>→</span>
            </button>
          </div>}
          {confirmed && <p className="confirmation-note" aria-live="polite">Task confirmed. The scripted mock call is running; no real call was placed.</p>}
          <button className="reset" onClick={reset}>Reset demo</button>
        </div>
        <div className="console" aria-label="Scripted mock call">
          <div className="console-head">
            <div><span className="live-dot" /> SIMULATED CALL <small>MOCK ONLY</small></div>
            <span className={`state-pill ${connected ? "is-connected" : ""}`} role="status">{connected ? state.replaceAll("_", " ") : "CONNECTING"}</span>
          </div>
          <div className="console-contact">
            <div className="call-avatar">व</div>
            <div><b>Apollo Clinic</b><small>Indiranagar · mock endpoint</small></div>
            <div className="wave" aria-hidden="true">{Array.from({ length: 26 }, (_, index) => <i key={index} style={{ height: `${8 + (index * 17 % 30)}px` }} />)}</div>
          </div>
          <div className="console-lines" aria-live="polite" aria-relevant="additions text" ref={transcriptRef}>
            {lines.map((line, index) => <article key={`${index}-${line.speaker}`}><b>{line.speaker}</b><p>{line.text}</p></article>)}
          </div>
          <div className="whisper-box">
            <label htmlFor="whisper">PRIVATE WHISPER · ONLY YOUR AGENT HEARS THIS</label>
            <form onSubmit={(event) => { event.preventDefault(); submitWhisper(); }}>
              <input id="whisper" value={whisper} onChange={(event) => setWhisper(event.target.value)} placeholder="e.g. Saturday morning, not evening" disabled={!canControl} />
              <button type="submit" disabled={!canControl || !whisper.trim()}>Send whisper ↗</button>
            </form>
          </div>
          <div className="mic-controls">
            <button type="button" onClick={() => { if (micActive) stopMicrophone(); else void startMicrophone(); }} disabled={!canControl}>
              {micActive ? "Stop microphone" : "Start microphone frame test"}
            </button>
            <p className="mic-status" aria-live="polite">{micStatus}</p>
            <small>16 kHz mono PCM16 · 20 ms frames · local RMS gate · mock only</small>
          </div>
          <div className="console-actions">
            <button onClick={() => act("whisper")} disabled={!canControl || !whisper.trim()}>◉ Whisper</button>
            <button onClick={() => act("patch")} disabled={!canControl}>↗ Patch in</button>
            <button onClick={() => act("end")} disabled={!canControl}>× End call</button>
          </div>
        </div>
      </section>
      <p className="demo-disclaimer">DEMO ONLY · Scripted content · No telephony provider connected · Never enter personal or payment information</p>
    </main>
  );
}
