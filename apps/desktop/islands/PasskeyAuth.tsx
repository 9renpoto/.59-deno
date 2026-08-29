import { useSignal } from "@preact/signals";
import {
  startAuthentication,
  startRegistration,
} from "npm:@simplewebauthn/browser@^12.0.0";

export default function PasskeyAuth() {
  const username = useSignal("user@example.com");
  const message = useSignal("");
  const error = useSignal("");
  const loading = useSignal(false);

  const handleRegister = async () => {
    message.value = "";
    error.value = "";
    loading.value = true;
    try {
      const optRes = await fetch("/api/auth/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.value }),
      });
      const optData = await optRes.json();
      if (!optRes.ok || !optData.options) {
        throw new Error(optData.error || "Failed to get registration options");
      }

      const credential = await startRegistration({
        optionsJSON: optData.options,
      });

      const verifyRes = await fetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: optData.userId,
          credential,
        }),
      });

      const verifyData = await verifyRes.json();
      if (verifyRes.ok && verifyData.verified) {
        message.value =
          "パスキーの登録が完了しました！ (Passkey registered successfully!)";
      } else {
        throw new Error(verifyData.error || "Registration verification failed");
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : "Registration error";
    } finally {
      loading.value = false;
    }
  };

  const handleLogin = async () => {
    message.value = "";
    error.value = "";
    loading.value = true;
    try {
      const optRes = await fetch("/api/auth/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.value }),
      });
      const optData = await optRes.json();
      if (!optRes.ok || !optData.options) {
        throw new Error(optData.error || "Failed to get login options");
      }

      const credential = await startAuthentication({
        optionsJSON: optData.options,
      });

      const verifyRes = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.value,
          credential,
          challenge: optData.challenge,
        }),
      });

      const verifyData = await verifyRes.json();
      if (verifyRes.ok && verifyData.verified) {
        message.value = `ログイン成功！ ようこそ ${
          verifyData.user?.username || username.value
        } さん (Logged in successfully!)`;
      } else {
        throw new Error(verifyData.error || "Login verification failed");
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : "Authentication error";
    } finally {
      loading.value = false;
    }
  };

  return (
    <div class="p-4 border rounded-lg bg-white shadow-sm max-w-md w-full my-4">
      <h2 class="text-xl font-bold mb-4 text-center">
        パスキー認証 (Passkey Auth)
      </h2>

      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">
          ユーザー名 / ユーザーID:
        </label>
        <input
          type="text"
          class="w-full px-3 py-2 border rounded-md"
          value={username.value}
          onInput={(
            e,
          ) => (username.value = (e.target as HTMLInputElement).value)}
          disabled={loading.value}
        />
      </div>

      <div class="flex gap-3 justify-center mb-4">
        <button
          type="button"
          onClick={handleRegister}
          disabled={loading.value}
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading.value ? "処理中..." : "パスキーを登録"}
        </button>

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading.value}
          class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          {loading.value ? "処理中..." : "パスキーでログイン"}
        </button>
      </div>

      {message.value && (
        <div class="p-3 bg-green-100 text-green-800 rounded-md text-sm mb-2">
          {message.value}
        </div>
      )}

      {error.value && (
        <div class="p-3 bg-red-100 text-red-800 rounded-md text-sm mb-2">
          {error.value}
        </div>
      )}
    </div>
  );
}
