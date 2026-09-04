# Passkey API

WebAuthn registration and username-less authentication backed by Cloudflare D1.

## Local development

The API uses an in-memory repository when no D1 binding is available. Start the
API on port 8000 and the Fresh app on port 8001:

```sh
deno task --cwd apps/api start
deno task --cwd apps/desktop start
```

Local defaults are `RP ID=localhost` and `origin=http://localhost:8001`.

## Cloudflare D1

Create a D1 database, apply `migrations/0001_passkeys.sql`, and bind it to the
Worker as `DB`. Configure these Worker variables:

| Variable           | Example               | Purpose                                        |
| ------------------ | --------------------- | ---------------------------------------------- |
| `WEBAUTHN_RP_NAME` | `Example`             | Name shown by the authenticator                |
| `WEBAUTHN_RP_ID`   | `example.com`         | Effective domain, without scheme or port       |
| `WEBAUTHN_ORIGIN`  | `https://example.com` | Exact browser origin, without a trailing slash |
| `ALLOWED_ORIGIN`   | `https://example.com` | Browser origin allowed by CORS                 |

The Fresh server can proxy `/api/auth/*` to the Worker by setting `AUTH_API_URL`
to the API's base URL.

Production must use HTTPS. Changing the RP ID later makes existing passkeys
unusable, so choose the production domain before launch.
