"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Line = { speaker: string; text: string };
type DemoScenario = "clinic_appointment" | "three_level_ivr" | "otp_request";
const INITIAL_LINE: Line = { speaker: "SYSTEM", text: "Demo ready. This is a scripted simulation; no real call is placed." };
const SENSITIVE_TASK = /\b(otp|one[ -]?time (?:code|password)|password|passcode|cvv|cvc|upi pin|card number|bank pin|payment details|kyc|consent|medical history|diagnosis|prescription|symptoms)\b|\b\d{4,8}\b/i;
const SCENARIO_LABELS: Record<DemoScenario, string> = {
  clinic_appointment: "clinic appointment",
  three_level_ivr: "three-level IVR",
  otp_request: "sensitive-step handoff",
};

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

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
  const [micActive, setMicActive] = useState(false);
  const [micStatus, setMicStatus] = useState("Microphone is off. Audio is never recorded.");
  const [started, setStarted] = useState(false);
  const [version, setVersion] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const muteNodeRef = useRef<GainNode | null>(null);
  const micActiveRef = useRef(false);
  const audioSequenceRef = useRef(0);
  const micStatusUpdateRef = useRef(0);

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
    socket.onclose = () => { if (active) setConnected(false); };
    socket.onerror = () => {
      if (active) {
        setConnected(false);
        setLines((previous) => [...previous, { speaker: "SYSTEM", text: "Could not connect to the demo API. Check that the app server is running, then reset." }]);
      }
    };
    return () => {
      active = false;
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [scenario, version]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const send = useCallback((type: string, extra: Record<string, unknown> = {}) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLines((previous) => [...previous, { speaker: "SYSTEM", text: "The demo is not connected yet. Wait for ‘Connected’ or reset to retry." }]);
      return false;
    }
    socket.send(JSON.stringify({ type, ...extra }));
    return true;
  }, []);

  const stopMicrophone = useCallback(() => {
    micActiveRef.current = false;
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.port.close();
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    muteNodeRef.current?.disconnect();
    muteNodeRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") void audioContext.close().catch(() => undefined);
    setMicActive(false);
    setMicStatus("Microphone stopped. Audio frames were not recorded.");
  }, []);

  async function startMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setMicStatus("Microphone capture requires a secure browser context and microphone permission.");
      return;
    }
    setMicStatus("Requesting microphone permission. No audio will be saved.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      mediaStreamRef.current = stream;
      const audioContext = new AudioContext({ latencyHint: "interactive" });
      audioContextRef.current = audioContext;
      await audioContext.audioWorklet.addModule("/pcm16-capture.worklet.js");
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const worklet = new AudioWorkletNode(audioContext, "vaani-pcm16-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: "explicit",
      });
      workletNodeRef.current = worklet;
      const mute = audioContext.createGain();
      mute.gain.value = 0;
      muteNodeRef.current = mute;

      worklet.port.onmessage = (message: MessageEvent<{ pcm16?: ArrayBuffer; rms?: number }>) => {
        if (!micActiveRef.current || !message.data.pcm16 || (message.data.rms ?? 0) < 0.018) return;
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({
          type: "whisper.audio",
          seq: audioSequenceRef.current,
          pcm16: bufferToBase64(message.data.pcm16),
        }));
        audioSequenceRef.current += 1;
        const now = Date.now();
        if (now - micStatusUpdateRef.current > 1_000) {
          micStatusUpdateRef.current = now;
          setMicStatus("Voice activity detected; 20 ms PCM16 frames are reaching the mock service. Speech recognition is off.");
        }
      };
      source.connect(worklet);
      worklet.connect(mute);
      mute.connect(audioContext.destination);
      await audioContext.resume();
      audioSequenceRef.current = 0;
      micActiveRef.current = true;
      setMicActive(true);
      setMicStatus("Microphone active. Local RMS voice gate sends speech-like frames only; no transcription or recording.");
    } catch {
      stopMicrophone();
      setMicStatus("Microphone unavailable. Check browser permission and try again; no audio was saved.");
    }
  }

  useEffect(() => () => stopMicrophone(), [stopMicrophone]);

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
  useEffect(() => {
    if (!canControl && micActiveRef.current) stopMicrophone();
  }, [canControl, stopMicrophone]);

  return (
    <main className="console-page">
      <header className="nav">
        <Link href="/" className="brand"><span className="brand-icon">व</span> VAANI·DALAL</Link>
        <span className="eyebrow">INTERACTIVE SIMULATION</span>
        <Link href="/">← BACK TO SITE</Link>
      </header>
      <section className="console-wrap">
        <div className="console-intro">
          <span className="eyebrow"><i className="pulse" /> SANDBOX · NO REAL CALLS</span>
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
