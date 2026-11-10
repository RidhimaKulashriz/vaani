import "@fastify/cookie";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SqlStore } from "@vaani/storage";
import {
  authCookieOptions,
  getAuthenticatedUser,
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  signAccountSession,
} from "./session.js";

const OAuthStateSchema = z.object({ nonce: z.string().min(32).max(128), redirectUri: z.string().url() });
const TokenSchema = z.object({ accessToken: z.string().min(1), expiresIn: z.number().int().positive() });
const AccountSchema = z.object({
  openId: z.string().min(1).max(300),
  email: z.string().email().nullable().optional(),
  name: z.string().max(300).optional(),
  platforms: z.array(z.string()).optional(),
});

function getOAuthConfig() {
  const projectId = process.env.MANUS_PROJECT_ID;
  const portal = process.env.MANUS_OAUTH_PORTAL_URL;
  const api = process.env.MANUS_OAUTH_API_URL;
  return projectId && portal && api ? { projectId, portal, api } : null;
}

function stateDigest(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

function stateMatches(state: string, supplied: string | undefined): boolean {
  if (!supplied || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  const expected = Buffer.from(stateDigest(state), "hex");
  const actual = Buffer.from(supplied, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function callbackOrigin(originHeader: string | undefined, fetchSite: string | undefined): string | null {
  if (!originHeader || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")) return null;
  try {
    const origin = new URL(originHeader);
    const localHttp = origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname);
    if (origin.protocol !== "https:" && !localHttp) return null;
    if (origin.pathname !== "/" || origin.search || origin.hash) return null;
    return origin.origin;
  } catch {
    return null;
  }
}

export function registerAuthRoutes(server: FastifyInstance, store: SqlStore): void {
  server.get("/api/auth/me", async (request) => {
    const user = await getAuthenticatedUser(request);
    return user ? { authenticated: true, user } : { authenticated: false, user: null };
  });

  server.post("/api/auth/start", async (request, reply) => {
    const config = getOAuthConfig();
    if (!config) return reply.code(503).send({ error: "oauth_unavailable", message: "Account sign-in is not configured in this environment." });
    const origin = callbackOrigin(request.headers.origin, request.headers["sec-fetch-site"]);
    if (!origin) return reply.code(403).send({ error: "origin_rejected", message: "Start sign-in from this application page." });

    const redirectUri = new URL("/api/auth/callback", origin).toString();
    const state = Buffer.from(JSON.stringify({ nonce: randomBytes(24).toString("base64url"), redirectUri })).toString("base64url");
    reply.setCookie(OAUTH_STATE_COOKIE_NAME, stateDigest(state), authCookieOptions(300, "/api/auth/callback"));

    const authorization = new URL("/app-auth", config.portal);
    authorization.searchParams.set("appId", config.projectId);
    authorization.searchParams.set("redirectUri", redirectUri);
    authorization.searchParams.set("state", state);
    authorization.searchParams.set("responseType", "code");
    return { authorizationUrl: authorization.toString() };
  });

  server.get("/api/auth/callback", async (request, reply) => {
    const config = getOAuthConfig();
    if (!config) return reply.code(503).send({ error: "oauth_unavailable", message: "Account sign-in is not configured in this environment." });
    const query = z.object({ code: z.string().min(1).max(4_096), state: z.string().min(1).max(4_096) }).safeParse(request.query);
    if (!query.success || !stateMatches(query.data.state, request.cookies?.[OAUTH_STATE_COOKIE_NAME])) {
      return reply.code(400).send({ error: "oauth_state_invalid", message: "The sign-in request expired or could not be verified. Start again." });
    }

    let stateValue: z.infer<typeof OAuthStateSchema>;
    try {
      const decoded: unknown = JSON.parse(Buffer.from(query.data.state, "base64url").toString("utf8"));
      const parsedState = OAuthStateSchema.safeParse(decoded);
      if (!parsedState.success) throw new Error("invalid state");
      stateValue = parsedState.data;
    } catch {
      return reply.code(400).send({ error: "oauth_state_invalid", message: "The sign-in request could not be verified." });
    }

    const redirect = new URL(stateValue.redirectUri);
    if (redirect.pathname !== "/api/auth/callback" || (redirect.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(redirect.hostname))) {
      return reply.code(400).send({ error: "oauth_redirect_invalid", message: "The sign-in return address is not allowed." });
    }

    try {
      const base = config.api.replace(/\/$/, "");
      const tokenResponse = await fetch(`${base}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId: config.projectId,
          grantType: "authorization_code",
          code: query.data.code,
          redirectUri: stateValue.redirectUri,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenResponse.ok) return reply.code(502).send({ error: "oauth_exchange_failed", message: "The account sign-in could not be completed. Start again." });
      const tokenData = TokenSchema.safeParse(await tokenResponse.json());
      if (!tokenData.success) return reply.code(502).send({ error: "oauth_exchange_invalid", message: "The account sign-in response could not be validated." });

      const accountResponse = await fetch(`${base}/webdev.v1.WebDevAuthPublicService/GetUserInfo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken: tokenData.data.accessToken }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!accountResponse.ok) return reply.code(502).send({ error: "account_lookup_failed", message: "The signed-in account could not be validated." });
      const accountData = AccountSchema.safeParse(await accountResponse.json());
      if (!accountData.success) return reply.code(502).send({ error: "account_lookup_invalid", message: "The signed-in account response could not be validated." });

      const user = { id: accountData.data.openId, email: accountData.data.email ?? null };
      await store.upsertUser({ ...user, createdAt: Date.now() });
      const ttl = Math.min(tokenData.data.expiresIn, 60 * 60 * 24 * 30);
      const appSession = await signAccountSession(user, ttl);
      reply.clearCookie(OAUTH_STATE_COOKIE_NAME, authCookieOptions(0, "/api/auth/callback"));
      reply.setCookie(SESSION_COOKIE_NAME, appSession, authCookieOptions(ttl));
      return reply.code(302).redirect(new URL("/app?auth=connected", redirect.origin).toString());
    } catch {
      request.log.warn("Account sign-in exchange failed; credentials were not logged.");
      return reply.code(502).send({ error: "oauth_failed", message: "Account sign-in could not be completed. Start again." });
    }
  });

  server.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, authCookieOptions(0));
    return { ok: true };
  });
}
