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
