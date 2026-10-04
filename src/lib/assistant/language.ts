// The language a customer writes in, for replies and approval summaries. Kept apart from the
// server-only code so the chat in the browser can use it too.

export type CustomerLanguage = "en" | "ar";

const ARABIC = /[؀-ۿ]/;

/** Arabic if the text has Arabic letters, otherwise English. */
export function languageOfText(text: string): CustomerLanguage {
  return ARABIC.test(text) ? "ar" : "en";
}
