import { Hono } from "hono";

export const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

if (import.meta.main) {
  Deno.serve({ port: 8000 }, app.fetch);
}

export default app;
