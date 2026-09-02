import { assertEquals } from "jsr:@std/assert@^1.0.11";
import {
  getTranslation,
  getTranslator,
  type Locale,
  parseLocale,
} from "./i18n.ts";

Deno.test("parseLocale selects locale based on query parameter and Accept-Language header", () => {
  assertEquals(parseLocale(null, "en"), "en");
  assertEquals(parseLocale("ja,en;q=0.8", "en"), "en");
  assertEquals(parseLocale(null, "ja"), "ja");
  assertEquals(parseLocale(null, "fr"), "ja");

  assertEquals(parseLocale("ja,en;q=0.8", null), "ja");
  assertEquals(parseLocale("en-US,en;q=0.9,ja;q=0.8", null), "en");
  assertEquals(parseLocale("ja-JP,ja;q=0.9,en;q=0.8", null), "ja");
  assertEquals(parseLocale("fr-FR,fr;q=0.9", null), "ja");
  assertEquals(parseLocale("en;q=0.5,ja;q=0.9", null), "ja");
  assertEquals(parseLocale("en;q=invalid,ja;q=0.5", null), "en");
  assertEquals(parseLocale("en;other=param,ja;q=0.5", null), "en");
  assertEquals(parseLocale(null, null), "ja");
});

Deno.test("getTranslation returns correct localized messages and falls back for unknown locale", () => {
  assertEquals(
    getTranslation("ja", "invalidInput"),
    "ユーザー名と表示名を入力してください",
  );
  assertEquals(
    getTranslation("en", "invalidInput"),
    "Please enter a username and display name",
  );
  assertEquals(
    getTranslation("fr" as Locale, "invalidInput"),
    "ユーザー名と表示名を入力してください",
  );
});

Deno.test("getTranslator provides locale and translator helper function", () => {
  const jaTranslator = getTranslator("ja-JP");
  assertEquals(jaTranslator.locale, "ja");
  assertEquals(jaTranslator.t("unauthorized"), "ログインが必要です");

  const enTranslator = getTranslator("en-US");
  assertEquals(enTranslator.locale, "en");
  assertEquals(enTranslator.t("unauthorized"), "Login required");
});
