# Fresh project

Your new Fresh project is ready to go. You can follow the Fresh "Getting
Started" guide here: https://fresh.deno.dev/docs/getting-started

### Usage

Make sure to install Deno: https://deno.land/manual/getting_started/installation

Then start the project:

```
deno task start
```

This will watch the project directory and restart as necessary.

### Typed API client

Use the Hono RPC client from Fresh server handlers:

```ts
import { createApiClient } from "../lib/api.ts";

const api = createApiClient("http://localhost:8000");
const response = await api.health.$get();
const health = await response.json();
console.log(health.status, health.timestamp);
```

Pass the API base URL for your environment. Browser calls across origins require
CORS configuration on the API; server handlers can call it directly.

Route and response types are inferred from `AppType` in `@myapp/api`, imported
as a type so server code is not bundled into the client. Add API routes to the
method chain in `apps/api/main.ts` to preserve inference. Hono dependencies are
defined in the root `deno.json` to keep the server and client versions aligned.

Run `deno task test` from the workspace root to check types and test the client
against the API in memory.
