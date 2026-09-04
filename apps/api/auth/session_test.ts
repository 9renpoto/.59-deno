import {
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.11";
import { Hono } from "hono";
import { MemoryAuthRepository } from "./repository.ts";
import {
  clearSessionCookie,
  createSession,
  currentUser,
  hashToken,
  readCookie,
  revokeSession,
} from "./session.ts";

Deno.test("session helpers create, resolve, and revoke a secure session", async () => {
  const repository = new MemoryAuthRepository();
  const user = {
    id: "user-1",
    username: "alice",
    displayName: "Alice",
    createdAt: 1,
  };
  await repository.createUser(user);
  const session = await createSession(repository, user.id, true);
  assertMatch(session.token, /^[A-Za-z0-9_-]{43}$/);
  assertStringIncludes(session.cookie, "HttpOnly");
  assertStringIncludes(session.cookie, "SameSite=Lax");
  assertStringIncludes(session.cookie, "Secure");
  assertNotEquals(await hashToken(session.token), session.token);

  const app = new Hono();
  app.get(
    "/me",
    async (context) =>
      context.json({ user: await currentUser(context, repository) }),
  );
  app.post("/logout", async (context) => {
    await revokeSession(context, repository);
    return context.text("ok");
  });
  const cookie = session.cookie.split(";", 1)[0];
  const me = await app.request("/me", { headers: { cookie } });
  assertEquals((await me.json()).user, user);
  await app.request("/logout", { method: "POST", headers: { cookie } });
  const afterLogout = await app.request("/me", { headers: { cookie } });
  assertEquals((await afterLogout.json()).user, null);
});

Deno.test("session helpers handle absent and malformed cookies", async () => {
  const repository = new MemoryAuthRepository();
  const app = new Hono();
  app.get(
    "/",
    async (context) =>
      context.json({ user: await currentUser(context, repository) }),
  );
  app.post("/", async (context) => {
    await revokeSession(context, repository);
    return context.text("ok");
  });
  assertEquals((await (await app.request("/")).json()).user, null);
  assertEquals((await app.request("/", { method: "POST" })).status, 200);
  assertEquals(readCookie("other=a; wanted=b=c", "wanted"), "b=c");
  assertEquals(readCookie(undefined, "wanted"), null);
  assertStringIncludes(clearSessionCookie(), "Max-Age=0");
  assertEquals(
    (await createSession(repository, "user", false)).cookie.includes("Secure"),
    false,
  );
});
