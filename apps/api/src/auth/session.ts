import "@fastify/cookie";
import type { FastifyRequest } from "fastify";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "webdev_app_session";
export const OAUTH_STATE_COOKIE_NAME = "vd_oauth_state";

export interface AuthUser {
  id: string;
  email: string | null;
}

function signingKey(): Uint8Array | null {
  const secret = process.env.MANUS_JWT_SECRET;
  return secret ? new TextEncoder().encode(secret) : null;
}

export function authCookieOptions(maxAge: number, path = "/") {
  const sameSite = process.env.SESSION_COOKIE_SAMESITE?.toLowerCase() === "lax" ? "lax" as const : "none" as const;
  return {
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE !== "false",
    sameSite,
    path,
    maxAge,
  };
}

export async function signAccountSession(user: AuthUser, expiresInSeconds: number): Promise<string> {
  const key = signingKey();
  const projectId = process.env.MANUS_PROJECT_ID;
  if (!key || !projectId) throw new Error("Account session signing is not configured");
  const ttl = Math.max(60, Math.min(expiresInSeconds, 60 * 60 * 24 * 30));
  return new SignJWT({ appId: projectId, openId: user.id, email: user.email ?? undefined })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(key);
}

export async function getAuthenticatedUser(request: FastifyRequest): Promise<AuthUser | null> {
  const token = request.cookies?.[SESSION_COOKIE_NAME];
  const key = signingKey();
  const projectId = process.env.MANUS_PROJECT_ID;
  if (!token || !key || !projectId) return null;
  try {
    const { payload, protectedHeader } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (protectedHeader.alg !== "HS256" || payload.appId !== projectId) return null;
    if (typeof payload.openId !== "string" || !payload.openId || typeof payload.exp !== "number" || payload.exp <= Date.now() / 1_000) return null;
    return { id: payload.openId, email: typeof payload.email === "string" ? payload.email : null };
  } catch {
    return null;
  }
}
