"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type User = { id: string; email: string | null };
type CallRow = { id: string; taskId: string; objective: string; state: string; outcome: string | null; startedAt: number; endedAt: number | null; simulated: true };
type TranscriptLine = { speaker: string; text: string };
type CallDetail = CallRow & {
  events: { ts: number; from: string; to: string; trigger: string }[];
  transcript: { ts: number; speaker: string; text: string; lang: string }[];
};
type ApiError = { message?: string };

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const body = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status}).`);
  return body;
}

export default function AppPage() {
  const [authState, setAuthState] = useState<"loading" | "logged-out" | "ready" | "error">("loading");
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");
  const [objective, setObjective] = useState("");
  const [task, setTask] = useState<{ taskId: string; restatement: string; simulatedOnly: true } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);
  const [activeCallId, setActiveCallId] = useState("");
  const [callState, setCallState] = useState("INITIATED");
  const [liveLines, setLiveLines] = useState<TranscriptLine[]>([]);
  const [whisper, setWhisper] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let current = true;
    void apiRequest<{ authenticated: boolean; user: User | null }>("/api/auth/me")
      .then((result) => {
        if (!current) return;
        if (result.authenticated && result.user) {
          setUser(result.user);
          setAuthState("ready");
        } else setAuthState("logged-out");
      })
      .catch(() => { if (current) setAuthState("error"); });
    return () => { current = false; };
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const history = await apiRequest<CallRow[]>("/api/calls?limit=50");
      setCalls(history);
      const active = history.find((call) => call.state !== "ENDED" && call.state !== "ENDING");
      if (active) {
        setActiveCallId((existing) => existing || active.id);
        setCallState(active.state);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Call history is unavailable.");
    }
  }, []);

  useEffect(() => {
    if (authState === "ready") void refreshHistory();
  }, [authState, refreshHistory]);

  useEffect(() => {
    if (!activeCallId || authState !== "ready") return;
    let active = true;
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${scheme}://${location.host}/api/session?callId=${encodeURIComponent(activeCallId)}`);
    socketRef.current = socket;
    socket.onmessage = (message) => {
      if (!active) return;
      try {
        const event = JSON.parse(String(message.data)) as Record<string, unknown>;
        if (event.type === "state" && typeof event.value === "string") {
          setCallState(event.value);
          if (event.value === "ENDED") void refreshHistory();
        } else if (event.type === "transcript" && typeof event.speaker === "string" && typeof event.text === "string") {
          setLiveLines((prior) => [...prior, { speaker: event.speaker as string, text: event.text as string }]);
        } else if (event.type === "summary" && typeof event.text === "string") {
          setLiveLines((prior) => [...prior, { speaker: "SUMMARY", text: event.text as string }]);
          void refreshHistory();
        } else if (event.type === "patch.ready") {
          setNotice("Mock patch-in is ready. No real telephone line is connected.");
        } else if (event.type === "error" && typeof event.message === "string") {
          setError(event.message as string);
        }
      } catch {
        setError("The session sent an unreadable update. Refresh call history to reconnect.");
      }
    };
    socket.onerror = () => { if (active) setError("Could not connect to this authenticated mock session."); };
    return () => {
      active = false;
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [activeCallId, authState, refreshHistory]);

  async function signIn() {
    setWorking(true);
    setAuthError("");
    try {
      const result = await apiRequest<{ authorizationUrl: string }>("/api/auth/start", { method: "POST" });
      window.location.assign(result.authorizationUrl);
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : "Sign-in is not available.");
    } finally {
      setWorking(false);
    }
  }

  async function signOut() {
    await apiRequest<{ ok: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setAuthState("logged-out");
    setActiveCallId("");
    setCalls([]);
    setTask(null);
    setConfirmed(false);
    setLiveLines([]);
    setSelectedCall(null);
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (objective.trim().length < 4) return;
    setWorking(true); setError(""); setNotice(""); setTask(null); setConfirmed(false);
    try {
      const result = await apiRequest<{ taskId: string; restatement: string; simulatedOnly: true }>("/api/tasks", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ objective: objective.trim() }),
      });
      setTask(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task creation failed.");
    } finally { setWorking(false); }
  }

  async function confirmTask() {
    if (!task) return;
    setWorking(true); setError("");
    try {
      const result = await apiRequest<{ confirmed: boolean }>(`/api/tasks/${task.taskId}/confirm`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmed: true }),
      });
      setConfirmed(result.confirmed);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Task confirmation failed."); }
    finally { setWorking(false); }
  }

  async function startCall() {
    if (!task || !confirmed) return;
    setWorking(true); setError(""); setNotice(""); setLiveLines([]);
    try {
      const result = await apiRequest<{ callId: string; state: string; simulated: boolean; realCallStarted: boolean }>(`/api/tasks/${task.taskId}/start`, { method: "POST" });
      if (!result.simulated || result.realCallStarted) throw new Error("The app refused an unexpected non-mock call response.");
      setActiveCallId(result.callId);
      setCallState(result.state);
      setNotice("Simulated call created. No phone call was placed.");
      setTask(null); setConfirmed(false); setObjective("");
      await refreshHistory();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The simulated call could not start."); }
    finally { setWorking(false); }
  }

  function sendControl(type: string, extra: Record<string, unknown> = {}) {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("The mock session is reconnecting. Wait for it to connect before using controls.");
      return false;
    }
    socket.send(JSON.stringify({ type, ...extra }));
    return true;
  }

  async function openCall(callId: string) {
    setSelectedCall(null); setError("");
    try {
      const detail = await apiRequest<CallDetail>(`/api/calls/${callId}`);
      setSelectedCall(detail);
      if (detail.state !== "ENDED" && detail.state !== "ENDING") setActiveCallId(detail.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Call details are unavailable."); }
  }

  async function logout() { await signOut(); }

  return (
    <main className="console-page app-page">
      <header className="nav">
        <Link href="/" className="brand"><span className="brand-icon">व</span> VAANI·DALAL</Link>
        <span className="eyebrow">PRIVATE APP · MOCK MODE</span>
        {user ? <button className="app-signout" onClick={() => void logout()}>Sign out</button> : <Link href="/demo">Public demo ↗</Link>}
      </header>
      {authState === "loading" && <section className="app-auth-state" role="status">Checking your sign-in…</section>}
      {(authState === "logged-out" || authState === "error") && <section className="app-auth-state">
        <span className="eyebrow">PRIVATE APP · SIGN-IN REQUIRED</span>
        <h1>Your calls,<br /><i>your control.</i></h1>
        <p>Sign in with your configured account to create routine tasks, confirm a restatement, run a simulated call, and view your private history. No synthetic user or public login bypass is available.</p>
        {authError && <p className="app-error" role="alert">{authError}</p>}
        {authState === "error" && <p className="app-error" role="alert">Could not check sign-in status. Refresh the page and try again.</p>}
        <button className="button dark" onClick={() => void signIn()} disabled={working}>{working ? "Connecting…" : "Sign in with account"} <span>→</span></button>
        <p className="app-auth-note">If sign-in is not configured for this deployment, the server will say so. Explore the scripted public simulation without signing in.</p>
        <Link className="app-demo-link" href="/demo">Open public mock demo ↗</Link>
      </section>}
      {authState === "ready" && user && <section className="app-dashboard">
        <div className="app-heading">
          <div><span className="eyebrow">SIGNED-IN ACCOUNT · MOCK CALLS ONLY</span><h1>Your calls,<br /><i>your control.</i></h1></div>
          <p>{user.email ?? "Authenticated account"}<br /><span>Real calling is disabled in this build.</span></p>
        </div>
        {error && <p className="app-error" role="alert">{error}</p>}
        {notice && <p className="app-notice" role="status">{notice}</p>}
        {!activeCallId && <section className="app-card">
          <h2>Create a routine task</h2>
          <p>Describe a non-sensitive request. A real destination number is not collected by this app flow.</p>
          <form onSubmit={(event) => void createTask(event)}>
            <label htmlFor="app-objective">TASK OBJECTIVE</label>
            <textarea id="app-objective" value={objective} onChange={(event) => setObjective(event.target.value)} maxLength={600} minLength={4} required placeholder="For example: Ask the clinic about its routine appointment hours." />
            <button className="button dark" disabled={working || objective.trim().length < 4}>{working ? "Saving…" : "Review task"} <span>→</span></button>
          </form>
          {task && <div className="app-task-review" aria-live="polite">
            <span className="eyebrow">AGENT RESTATEMENT · SIMULATED ONLY</span>
            <p>{task.restatement}</p>
            {!confirmed ? <button className="button dark" onClick={() => void confirmTask()} disabled={working}>Confirm task <span>→</span></button>
              : <div><p className="app-notice">Confirmed. Starting will create a scripted mock call only.</p><button className="button dark" onClick={() => void startCall()} disabled={working}>{working ? "Starting mock…" : "Start simulated call"} <span>→</span></button></div>}
          </div>}
        </section>}
        {activeCallId && <section className="app-card app-live-call">
          <div className="app-live-heading"><div><span className="eyebrow">SIMULATED CALL · NO PHONE NETWORK</span><h2>Live mock session</h2></div><span className="state-pill is-connected" role="status">{callState.replaceAll("_", " ")}</span></div>
          <div className="app-live-transcript" aria-live="polite" aria-relevant="additions text">
            {liveLines.length === 0 ? <p className="app-muted">Connecting to the private mock session…</p> : liveLines.map((line, index) => <article key={`${index}-${line.speaker}`}><b>{line.speaker}</b><p>{line.text}</p></article>)}
          </div>
          <form className="app-whisper" onSubmit={(event) => { event.preventDefault(); if (sendControl("whisper.text", { text: whisper.trim() })) setWhisper(""); }}>
            <label htmlFor="app-whisper">PRIVATE TEXT WHISPER · MOCK ONLY</label>
            <div><input id="app-whisper" value={whisper} onChange={(event) => setWhisper(event.target.value)} maxLength={240} placeholder="Routine correction for the mock agent" disabled={callState === "ENDED"} /><button disabled={!whisper.trim() || callState === "ENDED"}>Send</button></div>
          </form>
          <div className="app-call-actions">
            <button onClick={() => sendControl("action.patch_in")} disabled={callState === "ENDED"}>Patch in</button>
            <button onClick={() => sendControl("action.end")} disabled={callState === "ENDED"}>End simulated call</button>
          </div>
          {callState === "ENDED" && <button className="app-history-refresh" onClick={() => { setActiveCallId(""); void refreshHistory(); }}>Back to history</button>}
        </section>}
        <section className="app-card app-history">
          <div className="app-live-heading"><div><span className="eyebrow">PRIVATE · AUTHENTICATED ACCOUNT</span><h2>Call history</h2></div><button className="app-history-refresh" onClick={() => void refreshHistory()}>Refresh</button></div>
          {calls.length === 0 ? <p className="app-muted">No simulated calls yet.</p> : <ul>{calls.map((call) => <li key={call.id}>
            <div><b>{call.objective}</b><span>{call.state.replaceAll("_", " ")} · {new Date(call.startedAt).toLocaleString()}</span></div>
            <button onClick={() => void openCall(call.id)}>View detail</button>
          </li>)}</ul>}
          {selectedCall && <div className="app-detail" aria-live="polite"><h3>Call detail · {selectedCall.state.replaceAll("_", " ")}</h3><p>{selectedCall.outcome ?? selectedCall.objective}</p>
            <h4>Transcript</h4>{selectedCall.transcript.length ? selectedCall.transcript.map((line, index) => <article key={`${line.ts}-${index}`}><b>{line.speaker}</b><p>{line.text}</p></article>) : <p className="app-muted">No transcript segments are saved for this call.</p>}
            <h4>State events</h4>{selectedCall.events.map((event, index) => <p className="app-event" key={`${event.ts}-${index}`}>{event.from} → {event.to} · {event.trigger}</p>)}
          </div>}
        </section>
      </section>}
      <p className="demo-disclaimer">PRIVATE APP · SIMULATED CALLS ONLY · NO REAL TELEPHONY · DO NOT ENTER PERSONAL, MEDICAL OR PAYMENT DETAILS</p>
    </main>
  );
}
