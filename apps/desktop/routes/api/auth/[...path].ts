import type { Handlers } from "$fresh/server.ts";

const handler: Handlers = {
  GET: (request, context) => proxy(request, context.params.path),
  POST: (request, context) => proxy(request, context.params.path),
  OPTIONS: (request, context) => proxy(request, context.params.path),
};

async function proxy(request: Request, path: string): Promise<Response> {
  const apiBase = Deno.env.get("AUTH_API_URL") ?? "http://localhost:8000";
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("origin");
  const response = await fetch(`${apiBase}/auth/${path}`, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD"
      ? undefined
      : request.body,
  });
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export { handler };
