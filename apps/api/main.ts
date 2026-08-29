import { Hono } from "hono";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@^12.0.0";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "npm:@simplewebauthn/types@^12.0.0";

export const app = new Hono();

const rpName = "Passkey App";
const rpID = "localhost";
const expectedOrigin = [
  "http://localhost:8000",
  "http://localhost:3000",
  "http://localhost:8001",
];

export interface PasskeyDevice {
  credentialID: string;
  credentialPublicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

// In-memory data store for demonstration/template purposes
export interface User {
  id: string;
  username: string;
  devices: PasskeyDevice[];
  currentChallenge?: string;
}

export const users: Map<string, User> = new Map();

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

// Passkey registration options endpoint
app.post("/auth/register/options", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = body.username || "user@example.com";

  let user = Array.from(users.values()).find((u) => u.username === username);
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      username,
      devices: [],
    };
    users.set(user.id, user);
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.username,
    userDisplayName: user.username,
    attestationType: "none",
    excludeCredentials: user.devices.map((dev) => ({
      id: dev.credentialID,
      type: "public-key",
      transports: dev.transports,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  user.currentChallenge = options.challenge;

  return c.json({ options, userId: user.id });
});
app.post(
  "/api/auth/register/options",
  (c) => c.redirect("/auth/register/options", 307),
);

// Passkey registration verify endpoint
app.post("/auth/register/verify", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { userId, credential } = body as {
    userId: string;
    credential: RegistrationResponseJSON;
  };

  if (!userId || !credential) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const user = users.get(userId);
  if (!user || !user.currentChallenge) {
    return c.json({ error: "User or challenge not found" }, 400);
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: user.currentChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      const newDevice: PasskeyDevice = {
        credentialID: credential.id,
        credentialPublicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports,
      };
      user.devices.push(newDevice);
      user.currentChallenge = undefined;
      return c.json({ verified: true });
    }

    return c.json({ verified: false, error: "Verification failed" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ verified: false, error: message }, 400);
  }
});
app.post(
  "/api/auth/register/verify",
  (c) => c.redirect("/auth/register/verify", 307),
);

// Passkey login options endpoint
app.post("/auth/login/options", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = body.username;

  let user: User | undefined;
  if (username) {
    user = Array.from(users.values()).find((u) => u.username === username);
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: user?.devices.map((dev) => ({
      id: dev.credentialID,
      type: "public-key",
      transports: dev.transports,
    })),
    userVerification: "preferred",
  });

  if (user) {
    user.currentChallenge = options.challenge;
  }

  return c.json({ options, challenge: options.challenge });
});
app.post(
  "/api/auth/login/options",
  (c) => c.redirect("/auth/login/options", 307),
);

// Passkey login verify endpoint
app.post("/auth/login/verify", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { username, credential, challenge } = body as {
    username?: string;
    credential: AuthenticationResponseJSON;
    challenge?: string;
  };

  if (!credential) {
    return c.json({ error: "Missing credential response" }, 400);
  }

  // Find device matching credential.id
  let user: User | undefined;
  let device: PasskeyDevice | undefined;

  if (username) {
    user = Array.from(users.values()).find((u) => u.username === username);
    if (user) {
      device = user.devices.find((d) => d.credentialID === credential.id);
    }
  } else {
    for (const u of users.values()) {
      const d = u.devices.find((dev) => dev.credentialID === credential.id);
      if (d) {
        user = u;
        device = d;
        break;
      }
    }
  }

  if (!user || !device) {
    return c.json({ error: "Authenticator device not found" }, 400);
  }

  const expectedChallenge = user.currentChallenge || challenge;
  if (!expectedChallenge) {
    return c.json({ error: "Challenge not found" }, 400);
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: device.credentialID,
        publicKey: device.credentialPublicKey,
        counter: device.counter,
        transports: device.transports,
      },
    });

    if (verification.verified) {
      device.counter = verification.authenticationInfo.newCounter;
      user.currentChallenge = undefined;
      return c.json({
        verified: true,
        user: { id: user.id, username: user.username },
      });
    }

    return c.json({ verified: false, error: "Verification failed" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ verified: false, error: message }, 400);
  }
});
app.post(
  "/api/auth/login/verify",
  (c) => c.redirect("/auth/login/verify", 307),
);

if (import.meta.main) {
  Deno.serve({ port: 8000 }, app.fetch);
}

export default app;
