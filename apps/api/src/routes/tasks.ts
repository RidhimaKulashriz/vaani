import { createHmac, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MockTelephonyAdapter } from "@vaani/adapters";
import { getDemoScript } from "@vaani/orchestrator";
import { createCallSnapshot, redactPii } from "@vaani/orchestrator";
import { getAuthenticatedUser } from "../auth/session.js";
import type { ApiContext, LiveCallSession } from "../types.js";

const CreateTaskSchema = z.object({
  objective: z.string().trim().min(4).max(600),
  toNumber: z.string().trim().regex(/^\+?[0-9() .-]{7,24}$/).optional(),
});
const ConfirmTaskSchema = z.object({ confirmed: z.boolean() });
const TaskParamsSchema = z.object({ taskId: z.string().uuid() });
const SENSITIVE_TASK_PATTERN = /\b(otp|one[ -]?time (?:code|password)|password|passcode|cvv|cvc|upi pin|card number|bank pin|payment details)\b/i;

function numberHash(toNumber: string): string | null {
  const secret = process.env.PII_HASH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(toNumber.replace(/[^0-9+]/g, "")).digest("hex");
}

export function registerTaskRoutes(server: FastifyInstance, context: ApiContext): void {
  server.post("/api/tasks", async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) return reply.code(401).send({ error: "authentication_required", message: "Sign in before creating an app task." });
    const body = CreateTaskSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_task", message: "Enter a routine task in your own words." });
    if (SENSITIVE_TASK_PATTERN.test(body.data.objective)) {
      return reply.code(400).send({ error: "sensitive_detail_not_allowed", message: "Do not include OTPs, passwords, payment details or verification codes. Handle those directly with the business." });
    }
    if (body.data.toNumber && !process.env.PII_HASH_SECRET) {
      return reply.code(503).send({ error: "number_storage_unavailable", message: "This environment is not configured to protect a destination number. The mock call can run without one." });
    }

    const safeObjective = redactPii(body.data.objective).slice(0, 600);
    const id = randomUUID();
    const hashedNumber = body.data.toNumber ? numberHash(body.data.toNumber) : null;
    try {
      await context.store.upsertUser({ id: user.id, email: user.email, createdAt: Date.now() });
      await context.store.createTask({ id, userId: user.id, objective: safeObjective, toNumberHash: hashedNumber, createdAt: Date.now() });
      return reply.code(201).send({
        taskId: id,
        restatement: `I will make a simulated call to: ${safeObjective}. I will identify as an AI and ask you to take over sensitive steps. Confirm before the mock call begins.`,
        simulatedOnly: true,
      });
    } catch {
      request.log.error("Task persistence failed; task contents were not logged.");
      return reply.code(503).send({ error: "task_unavailable", message: "The task could not be saved. Try again later." });
    }
  });

  server.post("/api/tasks/:taskId/confirm", async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) return reply.code(401).send({ error: "authentication_required", message: "Sign in before confirming an app task." });
    const params = TaskParamsSchema.safeParse(request.params);
    const body = ConfirmTaskSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: "invalid_confirmation", message: "The task confirmation was not valid." });
    if (!body.data.confirmed) return { taskId: params.data.taskId, confirmed: false };
    const changed = await context.store.confirmTask(params.data.taskId, user.id, Date.now());
    if (!changed) {
      const existing = await context.store.getTask(user.id, params.data.taskId);
      if (existing?.status === "confirmed") return { taskId: existing.id, confirmed: true, alreadyConfirmed: true };
      return reply.code(existing ? 409 : 404).send({ error: existing ? "task_not_confirmable" : "task_not_found", message: "This task could not be confirmed." });
    }
    return { taskId: params.data.taskId, confirmed: true };
  });

  server.post("/api/tasks/:taskId/start", async (request, reply) => {
    const user = await getAuthenticatedUser(request);
    if (!user) return reply.code(401).send({ error: "authentication_required", message: "Sign in before starting an app task." });
    if (process.env.EXTERNAL_CALLS_ENABLED === "true") {
      return reply.code(503).send({ error: "live_call_path_unavailable", message: "This build has no live telephony adapter. Real calls remain disabled." });
    }
    const params = TaskParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_task_id", message: "The task identifier is not valid." });
    const task = await context.store.getTask(user.id, params.data.taskId);
    if (!task) return reply.code(404).send({ error: "task_not_found", message: "The task was not found." });
    if (task.status !== "confirmed") return reply.code(409).send({ error: "confirmation_required", message: "Confirm the task before starting the simulated call." });
    if (context.sessions.activeForUser(user.id)) return reply.code(409).send({ error: "active_call_exists", message: "End the active mock call before starting another." });

    const day = new Date().toISOString().slice(0, 10);
    if (!(await context.runtime.allow("calls-per-user-day", `${user.id}:${day}`, 10, 48 * 60 * 60))) {
      return reply.code(429).send({ error: "daily_call_limit", message: "The limit of 10 simulated calls per user per day has been reached." });
    }

    const callId = randomUUID();
    const leased = await context.runtime.acquireLease("active-call", user.id, callId, 60 * 60);
    if (!leased) return reply.code(409).send({ error: "active_call_exists", message: "An active call is already assigned to this user." });

    try {
      const telephony = new MockTelephonyAdapter();
      const dial = await telephony.dial({ scenario: "clinic_appointment", destinationHash: task.to_number_hash, consentRecorded: false });
      const snapshot = createCallSnapshot();
      snapshot.id = callId;
      const session: LiveCallSession = {
        snapshot,
        userId: user.id,
        taskId: task.id,
        objective: task.objective,
        toNumberHash: task.to_number_hash,
        scenario: "clinic_appointment",
        script: getDemoScript("clinic_appointment"),
        scriptIndex: 0,
        resumeState: null,
        timer: null,
        createdAt: Date.now(),
        isPublicDemo: false,
        started: false,
        finished: false,
        lastAudioAckAt: 0,
        lastAudioSeq: -1,
      };
      await context.store.createCall({
        id: session.snapshot.id,
        userId: user.id,
        taskId: task.id,
        toNumberHash: task.to_number_hash,
        objective: task.objective,
        state: "INITIATED",
        startedAt: session.snapshot.startedAt,
      });
      if (!context.sessions.add(session)) {
        await context.runtime.releaseLease("active-call", user.id, session.snapshot.id);
        return reply.code(409).send({ error: "active_call_exists", message: "An active call is already assigned to this user." });
      }
      await context.runtime.setJson("call", session.snapshot.id, { state: "INITIATED", startedAt: session.snapshot.startedAt }, 24 * 60 * 60);
      context.metrics.setActiveMockSessions(context.sessions.activeCount());
      return reply.code(201).send({ callId: session.snapshot.id, state: "INITIATED", simulated: dial.simulated, realCallStarted: false });
    } catch {
      await context.runtime.releaseLease("active-call", user.id, callId);
      request.log.error("Mock call setup failed; task details were not logged.");
      return reply.code(503).send({ error: "mock_call_unavailable", message: "The mock call could not be started." });
    }
  });
}
