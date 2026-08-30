import {
  assertEquals,
  assertExists,
  assertMatch,
} from "jsr:@std/assert@^1.0.11";
import { createApp } from "../main.ts";
import { MemoryAuthRepository } from "./repository.ts";

const config = {
  rpName: "Passkey Test",
  rpID: "localhost",
  origin: "http://localhost:8001",
};

Deno.test("registration options create a one-time ceremony", async () => {
  const repository = new MemoryAuthRepository();
  const app = createApp(repository, config);
  const response = await app.request("/auth/register/options", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "alice", displayName: "Alice" }),
  });

  assertEquals(response.status, 200);
  const body = await response.json();
  assertExists(body.ceremonyId);
  assertEquals(body.options.rp.id, "localhost");
  assertEquals(body.options.user.name, "alice");
  assertEquals(body.options.authenticatorSelection.residentKey, "required");
  assertEquals(repository.ceremonies.size, 1);
});

Deno.test("registration rejects invalid and duplicate usernames", async () => {
  const repository = new MemoryAuthRepository();
  const app = createApp(repository, config);
  const invalid = await app.request("/auth/register/options", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "x", displayName: "Alice" }),
  });
  assertEquals(invalid.status, 400);

  await repository.createUser({
    id: crypto.randomUUID(),
    username: "alice",
    displayName: "Alice",
    createdAt: Date.now(),
  });
  const duplicate = await app.request("/auth/register/options", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "ALICE", displayName: "Other Alice" }),
  });
  assertEquals(duplicate.status, 409);
});

Deno.test("authentication options support username-less login", async () => {
  const repository = new MemoryAuthRepository();
  const app = createApp(repository, config);
  const response = await app.request("/auth/login/options", { method: "POST" });
  const body = await response.json();

  assertEquals(response.status, 200);
  assertExists(body.ceremonyId);
  assertMatch(body.options.challenge, /^[A-Za-z0-9_-]+$/);
  assertEquals(body.options.allowCredentials, undefined);
  assertEquals(body.options.userVerification, "required");
});

Deno.test("me requires a valid session", async () => {
  const app = createApp(new MemoryAuthRepository(), config);
  const response = await app.request("/auth/me");
  assertEquals(response.status, 401);
});
