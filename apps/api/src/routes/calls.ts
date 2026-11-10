import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { redactPii } from "@vaani/orchestrator";
import { getAuthenticatedUser } from "../auth/session.js";
import type { ApiContext } from "../types.js";
import { handleEnd } from "../services/session-runner.js";

const CallParamsSchema = z.object({ callId: z.string().uuid() });
const LimitSchema = z.coerce.number().int().min(1).max(100).default(50);

export function registerCallRoutes(server: FastifyInstance, context: ApiContext): void {
  server.get("/api/calls", async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) return reply.code(401).send({ error: "authentication_required", message: "Sign in to view call history." });
    const query = z.object({ limit: LimitSchema }).safeParse(request.query);
    const limit = query.success ? query.data.limit : 50;
    const calls = await context.store.listCalls(user.id, limit);
    return calls.map(({ id, task_id, objective, state, outcome, started_at, ended_at }) => ({
      id,
      taskId: task_id,
      objective: redactPii(objective),
      state,
      outcome: outcome ? redactPii(outcome) : null,
      startedAt: started_at,
      endedAt: ended_at,
      simulated: true,
    }));
  });

  server.get("/api/calls/:callId", async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) return reply.code(401).send({ error: "authentication_required", message: "Sign in to view call details." });
    const params = CallParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_call_id", message: "The call identifier is not valid." });
    const call = await context.store.getCall(user.id, params.data.callId);
    if (!call) return reply.code(404).send({ error: "call_not_found", message: "The call was not found." });
    const [events, transcript] = await Promise.all([
      context.store.listCallEvents(user.id, call.id),
      context.store.listTranscript(user.id, call.id),
    ]);
    return {
      id: call.id,
      taskId: call.task_id,
      objective: redactPii(call.objective),
      state: call.state,
      outcome: call.outcome ? redactPii(call.outcome) : null,
      startedAt: call.started_at,
      endedAt: call.ended_at,
      simulated: true,
      events: events.map((event) => ({ ts: event.ts, from: event.fromState, to: event.toState, trigger: event.trigger })),
      transcript: transcript.map((segment) => ({ ts: segment.ts, speaker: segment.speaker, text: redactPii(segment.text), lang: segment.lang })),
    };
  });

  server.post("/api/calls/:callId/end", async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) return reply.code(401).send({ error: "authentication_required", message: "Sign in to end a call." });
    const params = CallParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_call_id", message: "The call identifier is not valid." });
    const call = context.sessions.get(params.data.callId);
    if (!call || call.userId !== user.id) return reply.code(404).send({ error: "active_call_not_found", message: "The active mock call was not found." });
    await handleEnd(context, call);
    return { ok: true, simulated: true, state: "ENDED" };
  });
}
