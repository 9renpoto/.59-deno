import PasskeyAuth from "../islands/PasskeyAuth.tsx";

export default function Home() {
  return (
    <main class="app-shell">
      <header class="hero-header">
        <div class="brand-mark" aria-hidden="true">P</div>
        <p class="eyebrow">PASSKEY FOUNDATION</p>
        <h1 class="title">
          パスワードのない<br />安全なサインイン
        </h1>
        <p class="description">
          あなたの端末が鍵になります。フィッシングに強く、覚える秘密もありません。
        </p>
      </header>
      <PasskeyAuth />
      <footer class="page-footer">Protected with WebAuthn</footer>
    </main>
  );
}
