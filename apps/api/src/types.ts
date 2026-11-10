import type { DemoScenario, ServerEvent } from "@vaani/protocol";
import type { CallSnapshot, DemoScriptStep } from "@vaani/orchestrator";
import type { SqlStore } from "@vaani/storage";
import type { MetricsRegistry } from "./services/metrics.js";
import type { RuntimeStore } from "./services/runtime-store.js";

export interface LiveCallSession {
  snapshot: CallSnapshot;
  userId: string | null;
  taskId: string | null;
  objective: string;
  toNumberHash: string | null;
  scenario: DemoScenario;
  script: readonly DemoScriptStep[];
  scriptIndex: number;
  resumeState: CallSnapshot["state"] | null;
  timer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
  isPublicDemo: boolean;
  started: boolean;
  finished: boolean;
  lastAudioAckAt: number;
}

export interface ApiContext {
  store: SqlStore;
  runtime: RuntimeStore;
  metrics: MetricsRegistry;
  sessions: SessionHub;
}

export type SessionSubscriber = (event: ServerEvent) => void;

export class SessionHub {
  private readonly calls = new Map<string, LiveCallSession>();
  private readonly subscribers = new Map<string, Set<SessionSubscriber>>();
  private readonly userCalls = new Map<string, string>();

  add(session: LiveCallSession): boolean {
    if (session.userId && this.activeForUser(session.userId)) return false;
    this.calls.set(session.snapshot.id, session);
    if (session.userId) this.userCalls.set(session.userId, session.snapshot.id);
    return true;
  }

  get(callId: string): LiveCallSession | null { return this.calls.get(callId) ?? null; }

  activeForUser(userId: string): LiveCallSession | null {
    const callId = this.userCalls.get(userId);
    const session = callId ? this.get(callId) : null;
    return session && session.snapshot.state !== "ENDED" ? session : null;
  }

  subscribe(callId: string, subscriber: SessionSubscriber): () => void {
    const listeners = this.subscribers.get(callId) ?? new Set<SessionSubscriber>();
    listeners.add(subscriber);
    this.subscribers.set(callId, listeners);
    return () => {
      listeners.delete(subscriber);
      if (listeners.size === 0) this.subscribers.delete(callId);
    };
  }

  emit(callId: string, event: ServerEvent): void {
    for (const subscriber of this.subscribers.get(callId) ?? []) subscriber(event);
  }

  finish(callId: string): void {
    const session = this.calls.get(callId);
    if (session?.userId && this.userCalls.get(session.userId) === callId) this.userCalls.delete(session.userId);
  }

  remove(callId: string): void {
    const session = this.calls.get(callId);
    if (session?.timer) clearTimeout(session.timer);
    this.finish(callId);
    this.subscribers.delete(callId);
    this.calls.delete(callId);
  }

  activeCount(): number {
    return [...this.calls.values()].filter((call) => call.snapshot.state !== "ENDED").length;
  }
}
