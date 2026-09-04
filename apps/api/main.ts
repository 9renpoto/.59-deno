import { Hono } from "hono";

// Chain routes so their schemas are preserved for the RPC client.
export const app = new Hono()
  .get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
  })
  .get("/", (c) => {
    return c.text("Hello Hono!");
  });

export type AppType = typeof app;

if (import.meta.main) {
  Deno.serve({ port: 8000 }, app.fetch);
}

export default app;
