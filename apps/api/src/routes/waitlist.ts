import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ApiContext } from "../types.js";

const WaitlistSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(80).optional(),
  consent: z.literal(true),
});

export function registerWaitlistRoutes(server: FastifyInstance, context: ApiContext): void {
  server.post("/api/waitlist", async (request, reply) => {
    const body = WaitlistSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_waitlist_input", message: "Enter a valid email and confirm the privacy notice." });
    }
    const email = body.data.email.toLowerCase();
    const identity = `${request.ip ?? "unknown"}:${email}`;
    if (!(await context.runtime.allow("waitlist", identity, 5, 60 * 60))) {
      return reply.code(429).send({ error: "rate_limited", message: "Please wait before trying again." });
    }
    try {
      const created = await context.store.addWaitlist({ email, name: body.data.name?.trim() || null, createdAt: Date.now() });
      return reply.code(created ? 201 : 200).send({
        ok: true,
        duplicate: !created,
        message: created ? "You're on the list. This prototype will not send follow-up email." : "That address is already on the list.",
      });
    } catch {
      request.log.error("Waitlist write failed; submitted contact details were not logged.");
      return reply.code(503).send({ error: "waitlist_unavailable", message: "The list is temporarily unavailable. Please try again later." });
    }
  });
}
