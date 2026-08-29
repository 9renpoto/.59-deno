import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.11";
import { app, users } from "./main.ts";

Deno.test("GET /health returns 200 OK", async () => {
  const res = await app.request("/health");
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.status, "ok");
});

Deno.test("GET / returns Hello Hono!", async () => {
  const res = await app.request("/");
  assertEquals(res.status, 200);
  const text = await res.text();
  assertEquals(text, "Hello Hono!");
});

Deno.test("POST /auth/register/options returns registration options", async () => {
  const res = await app.request("/auth/register/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "testuser@example.com" }),
  });
  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.options);
  assertExists(data.userId);
  assertEquals(data.options.rp.name, "Passkey App");
  assertEquals(data.options.user.name, "testuser@example.com");

  const user = users.get(data.userId);
  assertExists(user);
  assertEquals(user.currentChallenge, data.options.challenge);
});

Deno.test("POST /api/auth/register/options redirects to /auth/register/options", async () => {
  const res = await app.request("/api/auth/register/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "redirectuser@example.com" }),
  });
  assertEquals(res.status, 307);
  assertEquals(res.headers.get("location"), "/auth/register/options");
});

Deno.test("POST /auth/register/verify handles missing parameters", async () => {
  const res = await app.request("/auth/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.error, "Missing required fields");
});

Deno.test("POST /auth/register/verify handles user or challenge not found", async () => {
  const res = await app.request("/auth/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "non-existent-id",
      credential: { id: "test" },
    }),
  });
  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.error, "User or challenge not found");
});

Deno.test("POST /auth/register/verify handles invalid credential format", async () => {
  const userRes = await app.request("/auth/register/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "verifyuser@example.com" }),
  });
  const userData = await userRes.json();

  const res = await app.request("/auth/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: userData.userId,
      credential: { id: "invalid" },
    }),
  });
  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.verified, false);
});

Deno.test("POST /api/auth/register/verify redirects to /auth/register/verify", async () => {
  const res = await app.request("/api/auth/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 307);
  assertEquals(res.headers.get("location"), "/auth/register/verify");
});

Deno.test("POST /auth/login/options returns authentication options", async () => {
  const res = await app.request("/auth/login/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "testuser@example.com" }),
  });
  assertEquals(res.status, 200);
  const data = await res.json();
  assertExists(data.options);
  assertExists(data.challenge);
  assertEquals(data.options.rpId, "localhost");
});

Deno.test("POST /api/auth/login/options redirects to /auth/login/options", async () => {
  const res = await app.request("/api/auth/login/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "testuser@example.com" }),
  });
  assertEquals(res.status, 307);
  assertEquals(res.headers.get("location"), "/auth/login/options");
});

Deno.test("POST /auth/login/verify handles missing credential", async () => {
  const res = await app.request("/auth/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.error, "Missing credential response");
});

Deno.test("POST /auth/login/verify handles device not found", async () => {
  const res = await app.request("/auth/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: { id: "non-existent-device-id" } }),
  });
  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.error, "Authenticator device not found");
});

Deno.test("POST /auth/login/verify handles device not found with username", async () => {
  const res = await app.request("/auth/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "testuser@example.com",
      credential: { id: "non-existent-device-id" },
    }),
  });
  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.error, "Authenticator device not found");
});

Deno.test("POST /auth/login/verify handles missing challenge", async () => {
  // Add a user with a dummy device
  const userId = crypto.randomUUID();
  const dummyDevice = {
    credentialID: "dummy-cred-id",
    credentialPublicKey: new Uint8Array([1, 2, 3]),
    counter: 0,
  };
  users.set(userId, {
    id: userId,
    username: "deviceuser@example.com",
    devices: [dummyDevice],
    currentChallenge: undefined,
  });

  const res = await app.request("/auth/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "deviceuser@example.com",
      credential: { id: "dummy-cred-id" },
    }),
  });
  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.error, "Challenge not found");
});

Deno.test("POST /auth/login/verify handles invalid verification response", async () => {
  const userId = crypto.randomUUID();
  const dummyDevice = {
    credentialID: "dummy-cred-id-2",
    credentialPublicKey: new Uint8Array([1, 2, 3]),
    counter: 0,
  };
  users.set(userId, {
    id: userId,
    username: "deviceuser2@example.com",
    devices: [dummyDevice],
    currentChallenge: "test-challenge",
  });

  const res = await app.request("/auth/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "deviceuser2@example.com",
      credential: {
        id: "dummy-cred-id-2",
        rawId: "dummy",
        response: {},
        type: "public-key",
      },
    }),
  });
  assertEquals(res.status, 400);
  const data = await res.json();
  assertEquals(data.verified, false);
});

Deno.test("POST /api/auth/login/verify redirects to /auth/login/verify", async () => {
  const res = await app.request("/api/auth/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 307);
  assertEquals(res.headers.get("location"), "/auth/login/verify");
});
