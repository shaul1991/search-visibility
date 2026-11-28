import { AsyncLocalStorage } from "node:async_hooks";

const language = new AsyncLocalStorage();

export function validateLocale(locale) {
  if (locale !== "en" && locale !== "ko") {
    throw new Error("Language must be en or ko. / 언어는 en 또는 ko여야 합니다.");
  }
  return locale;
}

export function withLocale(locale, callback) {
  return language.run(validateLocale(locale), callback);
}

export function currentLocale() {
  return language.getStore() ?? "ko";
}

export function t(korean, english) {
  return currentLocale() === "en" ? english : korean;
}
