import type { Context } from "hono";
import type { AuthRepository } from "./repository.ts";
import type { User } from "./types.ts";

export const SESSION_COOKIE = "passkey_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

export async function createSession(
  repository: AuthRepository,
  userId: string,
  secure: boolean,
): Promise<{ cookie: string; token: string }> {
  const token = randomToken();
  await repository.createSession({
    tokenHash: await hashToken(token),
    userId,
    expiresAt: Date.now() + SESSION_LIFETIME_SECONDS * 1000,
  });
  return { token, cookie: sessionCookie(token, secure) };
}

export async function currentUser(
  context: Context,
  repository: AuthRepository,
): Promise<User | null> {
  const token = readCookie(context.req.header("cookie"), SESSION_COOKIE);
  if (!token) return null;
  const session = await repository.findSession(await hashToken(token));
  if (!session) return null;
  return await repository.findUserById(session.userId);
}

export async function revokeSession(
  context: Context,
  repository: AuthRepository,
): Promise<void> {
  const token = readCookie(context.req.header("cookie"), SESSION_COOKIE);
  if (token) await repository.deleteSession(await hashToken(token));
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_LIFETIME_SECONDS}${
    secure ? "; Secure" : ""
  }`;
}

export function readCookie(
  header: string | undefined,
  name: string,
): string | null {
  for (const part of header?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return encodeHex(new Uint8Array(digest));
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll(
    "/",
    "_",
  )
    .replaceAll("=", "");
}

function encodeHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}
