import { Hono } from "hono";
import { D1AuthRepository, type D1Database } from "./auth/d1_repository.ts";
import {
  type AuthRepository,
  MemoryAuthRepository,
} from "./auth/repository.ts";
import { authRoutes, type WebAuthnConfig } from "./auth/routes.ts";

interface Bindings {
  DB?: D1Database;
  WEBAUTHN_RP_NAME?: string;
  WEBAUTHN_RP_ID?: string;
  WEBAUTHN_ORIGIN?: string;
  ALLOWED_ORIGIN?: string;
}

const localConfig: WebAuthnConfig = {
  rpName: Deno.env.get("WEBAUTHN_RP_NAME") ?? "Passkey Starter",
  rpID: Deno.env.get("WEBAUTHN_RP_ID") ?? "localhost",
  origin: Deno.env.get("WEBAUTHN_ORIGIN") ?? "http://localhost:8001",
};
const localRepository = new MemoryAuthRepository();

export function createApp(
  repository: AuthRepository,
  config: WebAuthnConfig,
  allowedOrigin = config.origin,
): Hono {
  const application = new Hono();

  application.use("*", async (context, next) => {
    const origin = context.req.header("origin");
    if (origin === allowedOrigin) {
      context.header("Access-Control-Allow-Origin", origin);
      context.header("Access-Control-Allow-Credentials", "true");
      context.header("Vary", "Origin");
    }
    context.header("Access-Control-Allow-Headers", "Content-Type");
    context.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (context.req.method === "OPTIONS") return context.body(null, 204);
    await next();
  });

  application.get("/health", (context) => {
    return context.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  application.get("/", (context) => context.text("Passkey API"));
  application.route("/auth", authRoutes(repository, config));
  return application;
}

export const app = createApp(localRepository, localConfig);

const worker = {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const config: WebAuthnConfig = {
      rpName: env.WEBAUTHN_RP_NAME ?? "Passkey Starter",
      rpID: env.WEBAUTHN_RP_ID ?? "localhost",
      origin: env.WEBAUTHN_ORIGIN ?? "http://localhost:8001",
    };
    const repository = env.DB ? new D1AuthRepository(env.DB) : localRepository;
    return await createApp(
      repository,
      config,
      env.ALLOWED_ORIGIN ?? config.origin,
    )
      .fetch(
        request,
        env,
      );
  },
};

if (import.meta.main) {
  Deno.serve({ port: 8000 }, app.fetch);
}

export default worker;
