import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { Hono } from "hono";
import type { AuthRepository } from "./repository.ts";
import {
  clearSessionCookie,
  createSession,
  currentUser,
  revokeSession,
} from "./session.ts";

const CEREMONY_LIFETIME_MS = 5 * 60 * 1000;

export interface WebAuthnConfig {
  rpName: string;
  rpID: string;
  origin: string;
}

export interface WebAuthnDependencies {
  verifyRegistration: typeof verifyRegistrationResponse;
  verifyAuthentication: typeof verifyAuthenticationResponse;
}

const defaultWebAuthnDependencies: WebAuthnDependencies = {
  verifyRegistration: verifyRegistrationResponse,
  verifyAuthentication: verifyAuthenticationResponse,
};

interface RegistrationBody {
  ceremonyId: string;
  response: RegistrationResponseJSON;
}

interface AuthenticationBody {
  ceremonyId: string;
  response: AuthenticationResponseJSON;
}

export function authRoutes(
  repository: AuthRepository,
  config: WebAuthnConfig,
  webauthn = defaultWebAuthnDependencies,
): Hono {
  const routes = new Hono();

  routes.post("/register/options", async (context) => {
    const body = await readJson(context);
    const username = normalizeUsername(body?.username);
    const displayName = normalizeDisplayName(body?.displayName);
    if (!username || !displayName) {
      return context.json(
        { error: "ユーザー名と表示名を入力してください" },
        400,
      );
    }
    if (await repository.findUserByUsername(username)) {
      return context.json({ error: "このユーザー名は使用されています" }, 409);
    }

    const userId = crypto.randomUUID();
    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userID: new TextEncoder().encode(userId),
      userName: username,
      userDisplayName: displayName,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
    });
    const ceremonyId = crypto.randomUUID();
    await repository.saveCeremony({
      id: ceremonyId,
      kind: "registration",
      challenge: options.challenge,
      userId,
      username,
      displayName,
      expiresAt: Date.now() + CEREMONY_LIFETIME_MS,
    });
    return context.json({ ceremonyId, options });
  });

  routes.post("/register/verify", async (context) => {
    const body = await readJson(context) as RegistrationBody | null;
    if (!body?.ceremonyId || !body.response) {
      return context.json({ error: "登録レスポンスが不正です" }, 400);
    }
    const ceremony = await repository.consumeCeremony(
      body.ceremonyId,
      "registration",
    );
    if (!ceremony?.userId || !ceremony.username || !ceremony.displayName) {
      return context.json({ error: "登録操作の有効期限が切れています" }, 400);
    }
    if (await repository.findUserByUsername(ceremony.username)) {
      return context.json({ error: "このユーザー名は使用されています" }, 409);
    }

    try {
      const verification = await webauthn.verifyRegistration({
        response: body.response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: config.origin,
        expectedRPID: config.rpID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return context.json({ error: "パスキーを検証できませんでした" }, 400);
      }

      const now = Date.now();
      const { credential, credentialBackedUp, credentialDeviceType } =
        verification.registrationInfo;
      await repository.createUser({
        id: ceremony.userId,
        username: ceremony.username,
        displayName: ceremony.displayName,
        createdAt: now,
      });
      await repository.createPasskey({
        id: credential.id,
        userId: ceremony.userId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
        createdAt: now,
      });
      const session = await createSession(
        repository,
        ceremony.userId,
        config.origin.startsWith("https://"),
      );
      context.header("Set-Cookie", session.cookie);
      return context.json({ verified: true });
    } catch (error) {
      return context.json({ error: safeVerificationError(error) }, 400);
    }
  });

  routes.post("/login/options", async (context) => {
    const options = await generateAuthenticationOptions({
      rpID: config.rpID,
      userVerification: "required",
    });
    const ceremonyId = crypto.randomUUID();
    await repository.saveCeremony({
      id: ceremonyId,
      kind: "authentication",
      challenge: options.challenge,
      userId: null,
      username: null,
      displayName: null,
      expiresAt: Date.now() + CEREMONY_LIFETIME_MS,
    });
    return context.json({ ceremonyId, options });
  });

  routes.post("/login/verify", async (context) => {
    const body = await readJson(context) as AuthenticationBody | null;
    if (!body?.ceremonyId || !body.response?.id) {
      return context.json({ error: "認証レスポンスが不正です" }, 400);
    }
    const ceremony = await repository.consumeCeremony(
      body.ceremonyId,
      "authentication",
    );
    if (!ceremony) {
      return context.json(
        { error: "ログイン操作の有効期限が切れています" },
        400,
      );
    }
    const passkey = await repository.findPasskey(body.response.id);
    if (!passkey) {
      return context.json({ error: "パスキーを確認できません" }, 400);
    }

    try {
      const verification = await webauthn.verifyAuthentication({
        response: body.response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: config.origin,
        expectedRPID: config.rpID,
        requireUserVerification: true,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports as AuthenticatorTransportFuture[],
        },
      });
      if (!verification.verified) {
        return context.json({ error: "パスキーを検証できませんでした" }, 400);
      }
      await repository.updatePasskeyCounter(
        passkey.id,
        verification.authenticationInfo.newCounter,
      );
      const session = await createSession(
        repository,
        passkey.userId,
        config.origin.startsWith("https://"),
      );
      context.header("Set-Cookie", session.cookie);
      return context.json({ verified: true });
    } catch (error) {
      return context.json({ error: safeVerificationError(error) }, 400);
    }
  });

  routes.get("/me", async (context) => {
    const user = await currentUser(context, repository);
    return user
      ? context.json({ user: publicUser(user) })
      : context.json({ error: "ログインが必要です" }, 401);
  });

  routes.post("/logout", async (context) => {
    await revokeSession(context, repository);
    context.header("Set-Cookie", clearSessionCookie());
    return context.json({ ok: true });
  });

  return routes;
}

async function readJson(
  context: { req: { json(): Promise<unknown> } },
): Promise<Record<string, unknown> | null> {
  try {
    const value = await context.req.json();
    return typeof value === "object" && value !== null
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim().toLocaleLowerCase("en-US");
  return /^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) ? username : null;
}

function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const displayName = value.trim();
  return displayName.length >= 1 && displayName.length <= 80
    ? displayName
    : null;
}

function publicUser(
  user: { id: string; username: string; displayName: string },
) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
}

function safeVerificationError(error: unknown): string {
  console.error("WebAuthn verification failed", error);
  return "パスキーを検証できませんでした。もう一度お試しください";
}
