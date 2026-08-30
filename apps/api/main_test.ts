import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { app } from "./main.ts";

Deno.test("GET /health returns 200 OK", async () => {
  const res = await app.request("/health");
  assertEquals(res.status, 200);
  const data = await res.json();
  assertEquals(data.status, "ok");
});

Deno.test("GET / identifies the passkey API", async () => {
  const res = await app.request("/");
  assertEquals(res.status, 200);
  const text = await res.text();
  assertEquals(text, "Passkey API");
});
