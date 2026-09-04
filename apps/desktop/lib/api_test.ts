import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { assertType, type IsExact } from "$std/testing/types.ts";
import { app } from "@myapp/api";
import { createApiClient } from "./api.ts";

const client = createApiClient("http://localhost", {
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    app.request(input, init),
});

Deno.test("RPC client preserves the health response type and payload", async () => {
  const response = await client.health.$get();
  const data = await response.json();

  assertType<IsExact<typeof data, { status: string; timestamp: string }>>(true);
  assertEquals(response.status, 200);
  assertEquals(data.status, "ok");
  assertEquals(new Date(data.timestamp).toISOString(), data.timestamp);
});

Deno.test("RPC client can call the root route", async () => {
  const response = await client.index.$get();
  assertEquals(response.status, 200);
  assertEquals(await response.text(), "Hello Hono!");
});
