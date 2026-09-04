import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { useEffect, useState } from "preact/hooks";
import { Button } from "../components/Button.tsx";

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
      <section
        class="auth-card"
        data-state="signed-in"
        aria-live="polite"
      >
        <div class="success-badge" aria-hidden="true">✓</div>
        <p class="eyebrow">SIGNED IN</p>
        <h2 class="title">{user.displayName}</h2>
        <p class="muted-text">@{user.username}</p>
        <Button
          variant="secondary"
          type="button"
          disabled={busy}
          data-state={busy ? "busy" : "idle"}
          onClick={logout}
        >
          ログアウト
        </Button>
        {status && (
          <p class="status-message" role="status">
            {status}
          </p>
        )}
      </section>
    );
  }

  return (
    <div class="auth-layout">
      <section class="auth-card" data-variant="register">
        <p class="eyebrow">NEW ACCOUNT</p>
        <h2 class="title">パスキーを登録</h2>
        <p class="muted-text">パスワードは必要ありません。</p>
        <form class="auth-form" onSubmit={register}>
          <label class="field">
            表示名
            <input
              class="input-control"
              value={displayName}
              onInput={(event) => setDisplayName(event.currentTarget.value)}
              autocomplete="name"
              maxlength={80}
              required
            />
          </label>
          <label class="field">
            ユーザー名
            <input
              class="input-control"
              value={username}
              onInput={(event) => setUsername(event.currentTarget.value)}
              autocomplete="username"
              minlength={3}
              maxlength={64}
              pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,63}"
              required
            />
          </label>
          <Button
            class="submit-button"
            variant="primary"
            disabled={busy}
            data-state={busy ? "busy" : "idle"}
            type="submit"
          >
            {busy ? "処理中…" : "パスキーを作成"}
          </Button>
        </form>
      </section>
      <section class="auth-card" data-variant="login">
        <p class="eyebrow">WELCOME BACK</p>
        <h2 class="title">パスキーでログイン</h2>
        <p class="muted-text">端末の生体認証またはPINを使います。</p>
        <Button
          variant="primary"
          disabled={busy}
          data-state={busy ? "busy" : "idle"}
          type="button"
          onClick={login}
        >
          {busy ? "処理中…" : "ログイン"}
        </Button>
        <p class="note">ユーザー名の入力も不要です</p>
      </section>
      {status && (
        <p class="status-message" data-variant="global" role="status">
          {status}
        </p>
      )}
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
