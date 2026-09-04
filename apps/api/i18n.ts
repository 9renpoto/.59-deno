export type Locale = "ja" | "en";

export const DEFAULT_LOCALE: Locale = "ja";

export const translations = {
  ja: {
    invalidInput: "ユーザー名と表示名を入力してください",
    usernameTaken: "このユーザー名は使用されています",
    invalidRegistrationResponse: "登録レスポンスが不正です",
    registrationExpired: "登録操作の有効期限が切れています",
    passkeyVerificationFailed: "パスキーを検証できませんでした",
    invalidAuthenticationResponse: "認証レスポンスが不正です",
    loginExpired: "ログイン操作の有効期限が切れています",
    passkeyNotFound: "パスキーを確認できません",
    unauthorized: "ログインが必要です",
    passkeyVerificationError:
      "パスキーを検証できませんでした。もう一度お試しください",
    apiTitle: "Passkey API",
  },
  en: {
    invalidInput: "Please enter a username and display name",
    usernameTaken: "This username is already taken",
    invalidRegistrationResponse: "Invalid registration response",
    registrationExpired: "Registration session has expired",
    passkeyVerificationFailed: "Failed to verify passkey",
    invalidAuthenticationResponse: "Invalid authentication response",
    loginExpired: "Login session has expired",
    passkeyNotFound: "Passkey could not be found",
    unauthorized: "Login required",
    passkeyVerificationError: "Failed to verify passkey. Please try again",
    apiTitle: "Passkey API",
  },
} as const;

export type TranslationKey = keyof typeof translations.ja;

export function parseLocale(
  acceptLanguage?: string | null,
  queryLang?: string | null,
): Locale {
  if (queryLang) {
    const normalizedQuery = queryLang.trim().toLowerCase();
    if (normalizedQuery.startsWith("en")) return "en";
    if (normalizedQuery.startsWith("ja")) return "ja";
  }

  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const matches = acceptLanguage
    .split(",")
    .map((item) => {
      const [lang, qPart] = item.trim().split(";");
      let q = 1.0;
      if (qPart && qPart.trim().startsWith("q=")) {
        const parsedQ = parseFloat(qPart.trim().substring(2));
        if (!isNaN(parsedQ)) {
          q = parsedQ;
        }
      }
      return { lang: lang.trim().toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of matches) {
    if (lang.startsWith("en")) return "en";
    if (lang.startsWith("ja")) return "ja";
  }

  return DEFAULT_LOCALE;
}

export function getTranslation(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] ?? translations[DEFAULT_LOCALE][key];
}

export type Translator = (key: TranslationKey) => string;

export function getTranslator(
  acceptLanguage?: string | null,
  queryLang?: string | null,
): { locale: Locale; t: Translator } {
  const locale = parseLocale(acceptLanguage, queryLang);
  return {
    locale,
    t: (key: TranslationKey) => getTranslation(locale, key),
  };
}
