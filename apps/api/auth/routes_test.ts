import {
  assertEquals,
  assertExists,
  assertMatch,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.11";
import { createApp } from "../main.ts";
import { MemoryAuthRepository } from "./repository.ts";
import type { WebAuthnDependencies } from "./routes.ts";

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

Deno.test("registration verification creates user, passkey, and session", async () => {
  const repository = new MemoryAuthRepository();
  const app = createApp(repository, config, config.origin, fakeWebAuthn());
  const options = await post(app, "/auth/register/options", {
    username: "alice",
    displayName: "Alice",
  });
  const response = await postResponse(app, "/auth/register/verify", {
    ceremonyId: options.ceremonyId,
    response: { id: "key-1" },
  });
  assertEquals(response.status, 200);
  assertEquals((await response.json()).verified, true);
  assertEquals(
    (await repository.findUserByUsername("alice"))?.displayName,
    "Alice",
  );
  assertEquals((await repository.findPasskey("key-1"))?.counter, 2);
  const cookie = response.headers.get("set-cookie");
  assertExists(cookie);
  assertStringIncludes(cookie, "passkey_session=");
  assertEquals(cookie.includes("Secure"), false);
  const me = await app.request("/auth/me", { headers: { cookie } });
  assertEquals((await me.json()).user.username, "alice");
});

Deno.test("authentication verification updates counter and supports logout", async () => {
  const repository = new MemoryAuthRepository();
  await repository.createUser({
    id: "user-1",
    username: "alice",
    displayName: "Alice",
    createdAt: 1,
  });
  await repository.createPasskey({
    id: "key-1",
    userId: "user-1",
    publicKey: new Uint8Array([1]),
    counter: 2,
    deviceType: "multiDevice",
    backedUp: true,
    transports: [],
    createdAt: 2,
  });
  const app = createApp(
    repository,
    { ...config, origin: "https://localhost" },
    config.origin,
    fakeWebAuthn(),
  );
  const options = await post(app, "/auth/login/options");
  const response = await postResponse(app, "/auth/login/verify", {
    ceremonyId: options.ceremonyId,
    response: { id: "key-1" },
  });
  assertEquals(response.status, 200);
  assertEquals((await repository.findPasskey("key-1"))?.counter, 7);
  const cookie = response.headers.get("set-cookie")!;
  assertStringIncludes(cookie, "Secure");
  const logout = await app.request("/auth/logout", {
    method: "POST",
    headers: { cookie },
  });
  assertEquals(logout.status, 200);
  assertStringIncludes(logout.headers.get("set-cookie")!, "Max-Age=0");
  assertEquals(
    (await app.request("/auth/me", { headers: { cookie } })).status,
    401,
  );
});

Deno.test("verification endpoints reject malformed, expired, and unknown credentials", async () => {
  const repository = new MemoryAuthRepository();
  const app = createApp(repository, config, config.origin, fakeWebAuthn());
  assertEquals(
    (await app.request("/auth/register/verify", { method: "POST", body: "{" }))
      .status,
    400,
  );
  assertEquals(
    (await postResponse(app, "/auth/register/verify", {
      ceremonyId: "missing",
      response: {},
    })).status,
    400,
  );
  assertEquals(
    (await app.request("/auth/login/verify", { method: "POST", body: "{}" }))
      .status,
    400,
  );
  assertEquals(
    (await postResponse(app, "/auth/login/verify", {
      ceremonyId: "missing",
      response: { id: "key" },
    })).status,
    400,
  );
  const options = await post(app, "/auth/login/options");
  assertEquals(
    (await postResponse(app, "/auth/login/verify", {
      ceremonyId: options.ceremonyId,
      response: { id: "unknown" },
    })).status,
    400,
  );
});

Deno.test("verification failures are sanitized and ceremonies cannot be reused", async () => {
  const repository = new MemoryAuthRepository();
  const failing = fakeWebAuthn();
  failing.verifyRegistration =
    (() => Promise.reject(new Error("sensitive"))) as WebAuthnDependencies[
      "verifyRegistration"
    ];
  const app = createApp(repository, config, config.origin, failing);
  const options = await post(app, "/auth/register/options", {
    username: "alice",
    displayName: "Alice",
  });
  const first = await postResponse(app, "/auth/register/verify", {
    ceremonyId: options.ceremonyId,
    response: { id: "key" },
  });
  assertEquals(first.status, 400);
  assertEquals((await first.json()).error.includes("sensitive"), false);
  assertEquals(
    (await postResponse(app, "/auth/register/verify", {
      ceremonyId: options.ceremonyId,
      response: { id: "key" },
    })).status,
    400,
  );
});

Deno.test("CORS preflight only reflects the configured origin", async () => {
  const app = createApp(new MemoryAuthRepository(), config);
  const allowed = await app.request("/auth/me", {
    method: "OPTIONS",
    headers: { origin: config.origin },
  });
  assertEquals(allowed.status, 204);
  assertEquals(
    allowed.headers.get("access-control-allow-origin"),
    config.origin,
  );
  const denied = await app.request("/auth/me", {
    method: "OPTIONS",
    headers: { origin: "https://evil.example" },
  });
  assertEquals(denied.headers.get("access-control-allow-origin"), null);
});

function fakeWebAuthn(): WebAuthnDependencies {
  return {
    verifyRegistration: (() =>
      Promise.resolve({
        verified: true,
        registrationInfo: {
          credential: {
            id: "key-1",
            publicKey: new Uint8Array([1, 2]),
            counter: 2,
            transports: ["internal"],
          },
          credentialDeviceType: "multiDevice",
          credentialBackedUp: true,
        },
      })) as unknown as WebAuthnDependencies["verifyRegistration"],
    verifyAuthentication: (() =>
      Promise.resolve({
        verified: true,
        authenticationInfo: { newCounter: 7 },
      })) as unknown as WebAuthnDependencies["verifyAuthentication"],
  };
}

async function post(
  app: ReturnType<typeof createApp>,
  path: string,
  body?: unknown,
) {
  return await (await postResponse(app, path, body)).json();
}

function postResponse(
  app: ReturnType<typeof createApp>,
  path: string,
  body?: unknown,
) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
