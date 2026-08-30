import PasskeyAuth from "../islands/PasskeyAuth.tsx";

export default function Home() {
  return (
    <main class="shell">
      <header class="hero">
        <div class="brand-mark" aria-hidden="true">P</div>
        <p class="eyebrow">PASSKEY FOUNDATION</p>
        <h1>
          パスワードのない<br />安全なサインイン
        </h1>
        <p class="hero-copy">
          あなたの端末が鍵になります。フィッシングに強く、覚える秘密もありません。
        </p>
      </header>
      <PasskeyAuth />
      <footer>Protected with WebAuthn</footer>
    </main>
  );
}
