import { Head } from "$fresh/runtime.ts";

export default function Error404() {
  return (
    <>
      <Head>
        <title>404 - Page not found</title>
      </Head>
      <main class="app-shell">
        <div
          class="auth-card"
          style={{ textAlign: "center", alignItems: "center" }}
        >
          <img
            style={{ marginBlock: "var(--space-lg)" }}
            src="/logo.svg"
            width="128"
            height="128"
            alt="the Fresh logo: a sliced lemon dripping with juice"
          />
          <h1 class="title">404 - Page not found</h1>
          <p class="muted-text">
            The page you were looking for doesn't exist.
          </p>
          <a href="/" style={{ color: "var(--color-text-eyebrow)" }}>
            Go back home
          </a>
        </div>
      </main>
    </>
  );
}
