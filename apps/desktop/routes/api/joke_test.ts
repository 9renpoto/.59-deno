import { assertEquals } from "jsr:@std/assert@^1.0.11";
import { handler } from "./joke.ts";
import { FreshContext } from "$fresh/server.ts";

Deno.test("GET /api/joke returns joke text", async () => {
  const req = new Request("http://localhost/api/joke");
  const ctx = {} as FreshContext;
  const res = await handler(req, ctx);
  assertEquals(res.status, 200);
  const text = await res.text();
  assertEquals(typeof text, "string");
  assertEquals(text.length > 0, true);
});
