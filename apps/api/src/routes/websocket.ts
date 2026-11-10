import "@fastify/websocket";
import { createHmac, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ClientEventSchema, DemoScenarioSchema, type ClientEvent, type ServerEvent } from "@vaani/protocol";
import { createCallSnapshot, getDemoScript, redactPii } from "@vaani/orchestrator";
import { getAuthenticatedUser } from "../auth/session.js";
import type { ApiContext, LiveCallSession, SessionSubscriber } from "../types.js";
import {
  advanceScript,
  beginPrivateSession,
  handleEnd,
  handleWhisper,
  handleWhisperAudio,
  patchIn,
  startScenario,
} from "../services/session-runner.js";

function sameOriginRequest(request: { headers: Record<string, string | string[] | undefined> }): boolean {
  const originHeader = request.headers.origin;
  if (typeof originHeader !== "string") return false;
  const fetchSite = request.headers["sec-fetch-site"];
  if (typeof fetchSite === "string" && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  try {
    const origin = new URL(originHeader);
    const localHttp = origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname);
    if (origin.protocol !== "https:" && !localHttp) return false;
    if (process.env.PUBLIC_APP_ORIGIN && origin.origin !== process.env.PUBLIC_APP_ORIGIN) return false;
    return true;
  } catch {
    return false;
  }
}

function createSession(userId: string | null, taskId: string | null, objective: string, toNumberHash: string | null, scenario: "clinic_appointment" | "three_level_ivr" | "ivr_loop" | "hangup" | "hold_timeout" | "otp_request", isPublicDemo: boolean): LiveCallSession {
  return {
    snapshot: createCallSnapshot(),
    userId,
    taskId,
    objective,
    toNumberHash,
    scenario,
    script: getDemoScript(scenario),
    scriptIndex: 0,
    resumeState: null,
    timer: null,
    createdAt: Date.now(),
    isPublicDemo,
    started: false,
    finished: false,
    lastAudioAckAt: 0,
    lastAudioSeq: -1,
  };
}

function send(socket: { readyState: number; send(data: string): void }, event: ServerEvent): void {
  if (socket.readyState === 1) socket.send(JSON.stringify(event));
}

function parseMessage(data: unknown): ClientEvent | null {
  try {
    const raw = typeof data === "string" ? data : (data as { toString(): string }).toString();
    const parsed: unknown = JSON.parse(raw);
    const result = ClientEventSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function createAudioFrameGate(reply: SessionSubscriber): () => boolean {
  let windowStartedAt = Date.now();
  let frameCount = 0;
  let notified = false;
  return () => {
    const now = Date.now();
    if (now - windowStartedAt >= 1_000) {
      windowStartedAt = now;
      frameCount = 0;
      notified = false;
    }
    if (frameCount >= 60) {
      if (!notified) {
        notified = true;
        reply({ type: "error", code: "audio_rate_limited", message: "Too many microphone frames arrived. Pause briefly and try again." });
      }
      return false;
    }
    frameCount += 1;
    return true;
  };
}

function wireTaskEvents(context: ApiContext, userId: string, event: ClientEvent, reply: SessionSubscriber): Promise<void> {
  if (event.type === "task.create") {
    const sensitive = /\b(otp|one[ -]?time (?:code|password)|password|passcode|cvv|cvc|upi pin|card number|payment details)\b/i.test(event.objective);
    if (sensitive) {
      reply({ type: "error", code: "sensitive_detail_not_allowed", message: "Do not send codes or payment details. Handle those directly with the business." });
      return Promise.resolve();
    }
    if (event.toNumber && !process.env.PII_HASH_SECRET) {
      reply({ type: "error", code: "number_storage_unavailable", message: "This environment cannot safely store a destination number." });
      return Promise.resolve();
    }
    const safeObjective = redactPii(event.objective).slice(0, 600);
    const id = event.taskId ?? randomUUID();
    const toNumberHash = event.toNumber && process.env.PII_HASH_SECRET
      ? createHmac("sha256", process.env.PII_HASH_SECRET).update(event.toNumber.replace(/[^0-9+]/g, "")).digest("hex")
      : null;
    return context.store.upsertUser({ id: userId, email: null, createdAt: Date.now() })
      .then(() => context.store.createTask({ id, userId, objective: safeObjective, toNumberHash, createdAt: Date.now() }))
      .then(() => reply({ type: "task.created", taskId: id, restatement: `I will make a simulated call to: ${safeObjective}. Confirm before starting.` }));
  }
  if (event.type === "task.confirm") {
    if (!event.confirmed) {
      reply({ type: "task.confirmed", taskId: event.taskId, confirmed: false });
      return Promise.resolve();
    }
    return context.store.confirmTask(event.taskId, userId, Date.now()).then(async (changed) => {
      const existing = changed ? null : await context.store.getTask(userId, event.taskId);
      if (!changed && existing?.status !== "confirmed") {
        reply({ type: "error", code: "task_not_found", message: "The task could not be confirmed." });
        return;
      }
      reply({ type: "task.confirmed", taskId: event.taskId, confirmed: true });
    });
  }
  return Promise.resolve();
}

function handleSessionMessage(
  context: ApiContext,
  session: LiveCallSession,
  userId: string | null,
  event: ClientEvent,
  replyOnlyToThisSocket: SessionSubscriber,
): Promise<void> {
  switch (event.type) {
    case "ping":
      replyOnlyToThisSocket({ type: "pong", t: Date.now() });
      return Promise.resolve();
    case "task.create":
    case "task.confirm":
      return userId ? wireTaskEvents(context, userId, event, replyOnlyToThisSocket) : Promise.resolve();
    case "whisper.audio":
      handleWhisperAudio(session, event.seq, event.pcm16, replyOnlyToThisSocket);
      return Promise.resolve();
    case "whisper.text":
    case "demo.whisper":
      return handleWhisper(context, session, event.text, replyOnlyToThisSocket);
    case "action.patch_in":
      return patchIn(context, session);
    case "action.end":
      return handleEnd(context, session);
    case "demo.advance":
      if (session.timer) clearTimeout(session.timer);
      session.timer = null;
      return advanceScript(context, session);
    case "demo.start":
      if (!session.isPublicDemo) {
        replyOnlyToThisSocket({ type: "error", code: "demo_only", message: "Choose a scenario on the public demo route." });
        return Promise.resolve();
      }
      return startScenario(context, session, event.scenario, event.objective);
  }
}

export function registerWebSocketRoutes(server: FastifyInstance, context: ApiContext): void {
  server.get("/api/demo-call", { websocket: true }, (socket, request) => {
    if (!sameOriginRequest(request)) {
      socket.close(1008, "Same-origin demo connection required");
      return;
    }
    const ip = request.ip ?? "unknown";
    void context.runtime.allow("demo-ws", ip, 20, 60).then((allowed) => {
      if (!allowed) {
        socket.close(1013, "Demo connection limit reached");
        return;
      }
      const query = DemoScenarioSchema.optional().safeParse((request.query as { scenario?: unknown }).scenario);
      const scenario = query.success && query.data ? query.data : "clinic_appointment";
      const session = createSession(null, null, "Public mock demonstration", null, scenario, true);
      if (!context.sessions.add(session)) {
        socket.close(1011, "Could not create demo session");
        return;
      }
      context.metrics.setActiveMockSessions(context.sessions.activeCount());
      const replyOnlyToThisSocket: SessionSubscriber = (event) => send(socket, event);
      const allowAudioFrame = createAudioFrameGate(replyOnlyToThisSocket);
      const unsubscribe = context.sessions.subscribe(session.snapshot.id, replyOnlyToThisSocket);
      replyOnlyToThisSocket({ type: "session.ready", mode: "mock", callId: session.snapshot.id });
      replyOnlyToThisSocket({ type: "state", value: "INITIATED", t: session.snapshot.startedAt, trigger: "session_ready" });
      socket.on("message", (data: Buffer) => {
        const event = parseMessage(data);
        if (!event) {
          replyOnlyToThisSocket({ type: "error", code: "invalid_event", message: "The event was not valid." });
          return;
        }
        if (event.type === "whisper.audio" && !allowAudioFrame()) return;
        void handleSessionMessage(context, session, null, event, replyOnlyToThisSocket).catch(() => {
          replyOnlyToThisSocket({ type: "error", code: "demo_event_failed", message: "The mock demo could not complete that action." });
        });
      });
      socket.on("close", () => {
        if (session.timer) clearTimeout(session.timer);
        unsubscribe();
        context.sessions.remove(session.snapshot.id);
        context.metrics.setActiveMockSessions(context.sessions.activeCount());
      });
    }).catch(() => socket.close(1011, "Demo service unavailable"));
  });

  server.get("/api/session", { websocket: true }, async (socket, request) => {
    if (!sameOriginRequest(request)) {
      socket.close(1008, "Same-origin session connection required");
      return;
    }
    const user = await getAuthenticatedUser(request);
    if (!user) {
      socket.close(1008, "Sign-in required");
      return;
    }
    const query = z.object({ callId: z.string().uuid() }).safeParse(request.query);
    const session = query.success ? context.sessions.get(query.data.callId) : null;
    if (!session || session.userId !== user.id) {
      socket.close(1008, "Active call session not found");
      return;
    }
    const replyOnlyToThisSocket: SessionSubscriber = (event) => send(socket, event);
    const allowAudioFrame = createAudioFrameGate(replyOnlyToThisSocket);
    const unsubscribe = context.sessions.subscribe(session.snapshot.id, replyOnlyToThisSocket);
    replyOnlyToThisSocket({ type: "session.ready", mode: "mock", callId: session.snapshot.id });
    replyOnlyToThisSocket({ type: "state", value: session.snapshot.state, t: Date.now(), trigger: "session_resume" });
    beginPrivateSession(context, session);

    socket.on("message", (data: Buffer) => {
      const event = parseMessage(data);
      if (!event) {
        replyOnlyToThisSocket({ type: "error", code: "invalid_event", message: "The event was not valid." });
        return;
      }
      if (event.type === "whisper.audio" && !allowAudioFrame()) return;
      void handleSessionMessage(context, session, user.id, event, replyOnlyToThisSocket).catch(() => {
        replyOnlyToThisSocket({ type: "error", code: "session_event_failed", message: "The mock session could not complete that action." });
      });
    });
    socket.on("close", unsubscribe);
  });
}
