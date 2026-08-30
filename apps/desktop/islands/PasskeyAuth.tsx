import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { useEffect, useState } from "preact/hooks";

interface PublicUser {
  id: string;
  username: string;
  displayName: string;
}
interface OptionsResponse<T> {
  ceremonyId: string;
  options: T;
}

export default function PasskeyAuth() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => void loadSession(), []);
  async function loadSession() {
    const response = await fetch("/api/auth/me");
    if (response.ok) setUser((await response.json()).user);
  }
  async function register(event: Event) {
    event.preventDefault();
    await run(async () => {
      const payload = await api<
        OptionsResponse<Parameters<typeof startRegistration>[0]["optionsJSON"]>
      >("/api/auth/register/options", { username, displayName });
      const response = await startRegistration({
        optionsJSON: payload.options,
      });
      await api("/api/auth/register/verify", {
        ceremonyId: payload.ceremonyId,
        response,
      });
      await loadSession();
      setStatus("パスキーを登録しました");
    });
  }
  async function login() {
    await run(async () => {
      const payload = await api<
        OptionsResponse<
          Parameters<typeof startAuthentication>[0]["optionsJSON"]
        >
      >("/api/auth/login/options");
      const response = await startAuthentication({
        optionsJSON: payload.options,
      });
      await api("/api/auth/login/verify", {
        ceremonyId: payload.ceremonyId,
        response,
      });
      await loadSession();
      setStatus("ログインしました");
    });
  }
  async function logout() {
    await run(async () => {
      await api("/api/auth/logout");
      setUser(null);
      setStatus("ログアウトしました");
    });
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (error) {
      setStatus(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "パスキーの操作がキャンセルされました"
          : error instanceof Error
          ? error.message
          : "操作に失敗しました",
      );
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <section class="auth-card signed-in" aria-live="polite">
        <div class="success-mark" aria-hidden="true">✓</div>
        <p class="eyebrow">SIGNED IN</p>
        <h2>{user.displayName}</h2>
        <p class="muted">@{user.username}</p>
        <button
          class="secondary-button"
          type="button"
          disabled={busy}
          onClick={logout}
        >
          ログアウト
        </button>
        {status && <p class="status">{status}</p>}
      </section>
    );
  }

  return (
    <div class="auth-grid">
      <section class="auth-card">
        <p class="eyebrow">NEW ACCOUNT</p>
        <h2>パスキーを登録</h2>
        <p class="muted">パスワードは必要ありません。</p>
        <form onSubmit={register}>
          <label>
            表示名<input
              value={displayName}
              onInput={(event) => setDisplayName(event.currentTarget.value)}
              autocomplete="name"
              maxlength={80}
              required
            />
          </label>
          <label>
            ユーザー名<input
              value={username}
              onInput={(event) => setUsername(event.currentTarget.value)}
              autocomplete="username"
              minlength={3}
              maxlength={64}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,63}"
              required
            />
          </label>
          <button class="primary-button" disabled={busy} type="submit">
            {busy ? "処理中…" : "パスキーを作成"}
          </button>
        </form>
      </section>
      <section class="auth-card login-card">
        <p class="eyebrow">WELCOME BACK</p>
        <h2>パスキーでログイン</h2>
        <p class="muted">端末の生体認証またはPINを使います。</p>
        <button
          class="primary-button"
          disabled={busy}
          type="button"
          onClick={login}
        >
          {busy ? "処理中…" : "ログイン"}
        </button>
        <p class="privacy-note">ユーザー名の入力も不要です</p>
      </section>
      {status && <p class="status global-status" role="status">{status}</p>}
    </div>
  );
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "操作に失敗しました");
  return payload;
}
