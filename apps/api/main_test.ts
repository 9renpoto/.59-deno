import { assertEquals } from "jsr:@std/assert@^1.0.11";
import worker, { app } from "./main.ts";

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

Deno.test("worker fetch applies environment configuration", async () => {
  const response = await worker.fetch(
    new Request("https://api.example/health"),
    {
      WEBAUTHN_RP_NAME: "Example",
      WEBAUTHN_RP_ID: "example.com",
      WEBAUTHN_ORIGIN: "https://example.com",
      ALLOWED_ORIGIN: "https://app.example.com",
    },
  );
  assertEquals(response.status, 200);
  assertEquals((await response.json()).status, "ok");
});
