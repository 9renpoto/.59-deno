import type { AppType } from "@myapp/api";
import { hc } from "hono/client";

/** Create a typed client for the API's base URL. */
export const createApiClient = (...args: Parameters<typeof hc>) =>
  hc<AppType>(...args);
