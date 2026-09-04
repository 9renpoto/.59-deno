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
import { getTranslator, type Locale, type Translator } from "../i18n.ts";
import type { AuthRepository } from "./repository.ts";
import {
  clearSessionCookie,
  createSession,
  currentUser,
  revokeSession,
} from "./session.ts";

const CEREMONY_LIFETIME_MS = 5 * 60 * 1000;

export interface AppEnv {
  Variables: {
    locale: Locale;
    t: Translator;
  };
}

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
) {
  const routes = new Hono<AppEnv>();

  routes.use("*", async (context, next) => {
    const { locale, t } = getTranslator(
      context.req.header("accept-language"),
      context.req.query("lang"),
    );
    context.set("locale", locale);
    context.set("t", t);
    await next();
  });

  return routes.post("/register/options", async (context) => {
    const t = context.get("t");
    const body = await readJson(context);
    const username = normalizeUsername(body?.username);
    const displayName = normalizeDisplayName(body?.displayName);
    if (!username || !displayName) {
      return context.json(
        { error: t("invalidInput") },
        400,
      );
    }
    if (await repository.findUserByUsername(username)) {
      return context.json({ error: t("usernameTaken") }, 409);
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
  })
    .post("/register/verify", async (context) => {
      const t = context.get("t");
      const body = await readJson(context) as RegistrationBody | null;
      if (!body?.ceremonyId || !body.response) {
        return context.json({ error: t("invalidRegistrationResponse") }, 400);
      }
      const ceremony = await repository.consumeCeremony(
        body.ceremonyId,
        "registration",
      );
      if (!ceremony?.userId || !ceremony.username || !ceremony.displayName) {
        return context.json({ error: t("registrationExpired") }, 400);
      }
      if (await repository.findUserByUsername(ceremony.username)) {
        return context.json({ error: t("usernameTaken") }, 409);
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
          return context.json({ error: t("passkeyVerificationFailed") }, 400);
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
        return context.json({ error: safeVerificationError(error, t) }, 400);
      }
    })
    .post("/login/options", async (context) => {
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
    })
    .post("/login/verify", async (context) => {
      const t = context.get("t");
      const body = await readJson(context) as AuthenticationBody | null;
      if (!body?.ceremonyId || !body.response?.id) {
        return context.json({ error: t("invalidAuthenticationResponse") }, 400);
      }
      const ceremony = await repository.consumeCeremony(
        body.ceremonyId,
        "authentication",
      );
      if (!ceremony) {
        return context.json(
          { error: t("loginExpired") },
          400,
        );
      }
      const passkey = await repository.findPasskey(body.response.id);
      if (!passkey) {
        return context.json({ error: t("passkeyNotFound") }, 400);
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
          return context.json({ error: t("passkeyVerificationFailed") }, 400);
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
        return context.json({ error: safeVerificationError(error, t) }, 400);
      }
    })
    .get("/me", async (context) => {
      const t = context.get("t");
      const user = await currentUser(context, repository);
      return user
        ? context.json({ user: publicUser(user) }, 200)
        : context.json({ error: t("unauthorized") }, 401);
    })
    .post("/logout", async (context) => {
      await revokeSession(context, repository);
      context.header("Set-Cookie", clearSessionCookie());
      return context.json({ ok: true });
    });
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

function safeVerificationError(error: unknown, t: Translator): string {
  console.error("WebAuthn verification failed", error);
  return t("passkeyVerificationError");
}
