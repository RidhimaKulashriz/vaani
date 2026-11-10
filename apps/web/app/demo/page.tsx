"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Line = { speaker: string; text: string };
type DemoScenario = "clinic_appointment" | "three_level_ivr" | "otp_request";
const INITIAL_LINE: Line = { speaker: "SYSTEM", text: "Demo ready. This is a scripted simulation; no real call is placed." };

export default function Demo() {
  const [state, setState] = useState("INITIATED");
  const [lines, setLines] = useState<Line[]>([INITIAL_LINE]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [scenario, setScenario] = useState<DemoScenario>("clinic_appointment");
  const [whisper, setWhisper] = useState("");
  const [started, setStarted] = useState(false);
  const [version, setVersion] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
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
        } else if (event.type === "whisper.ack" && typeof event.text === "string") {
          setLines((previous) => [...previous, { speaker: "PRIVATE WHISPER", text: event.text as string }]);
        } else if (event.type === "summary" && typeof event.text === "string") {
          setLines((previous) => [...previous, { speaker: "SUMMARY", text: event.text as string }]);
        } else if (event.type === "patch.ready") {
          setLines((previous) => [...previous, { speaker: "SYSTEM", text: "Mock patch-in bridge is ready. No real call was connected." }]);
        } else if (event.type === "error" && typeof event.message === "string") {
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

  function start() {
    if (!connected || started || busy) return;
    setBusy(true);
    if (send("demo.start", { scenario })) setStarted(true);
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
    setConnected(false);
    setState("INITIATED");
    setStarted(false);
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
          <span className="eyebrow"><i className="pulse" /> SANDBOX · NO REAL CALLS</span>
          <h1>Try the<br /><i>conversation.</i></h1>
          <p>Control a scripted appointment call. Whisper privately, patch in, or end the session at any time.</p>
          <label htmlFor="scenario">SCENARIO
            <select id="scenario" value={scenario} onChange={(event) => {
              setScenario(event.target.value as DemoScenario);
              setConnected(false); setStarted(false); setState("INITIATED"); setLines([INITIAL_LINE]);
            }}>
              <option value="clinic_appointment">Clinic appointment</option>
              <option value="three_level_ivr">Three-level IVR</option>
              <option value="otp_request">Sensitive request → transfer</option>
            </select>
          </label>
          <button className="button dark" onClick={start} disabled={!connected || started || busy}>
            {!connected ? "Connecting…" : started ? "Simulation running" : busy ? "Starting…" : "Start simulation"} <span>→</span>
          </button>
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
