import type { CustomerLanguage } from "@/lib/assistant/language";

// Cost and abuse controls, checked before every turn from the model usage log (chat_usage).
// Hitting one costs nothing: the customer gets a fixed reply, and no model is called.

/**
 * Tokens one conversation may spend, input and output across every step. Each step re-sends the
 * conversation, so this is roughly 15-20 exchanges; a longer one goes to a person.
 */
export const CONVERSATION_TOKEN_BUDGET = 100_000;

/** Chat model calls one business may make per minute, across all its conversations. */
export const BUSINESS_CALLS_PER_MINUTE = 60;

/** What one business may spend on AI per local day, in US dollars. */
export const BUSINESS_DAILY_BUDGET_USD = 5;

/** The most steps (model calls) in one turn, so a confused model can't loop. */
export const MAX_STEPS_PER_TURN = 8;

export type Limit = "conversation" | "rate" | "daily";

export function limitReached(usage: {
  conversation_tokens: number;
  business_chat_calls_last_minute: number;
  business_cost_today: number;
}): Limit | null {
  if (usage.conversation_tokens >= CONVERSATION_TOKEN_BUDGET) {
    return "conversation";
  }
  if (usage.business_cost_today >= BUSINESS_DAILY_BUDGET_USD) return "daily";
  if (usage.business_chat_calls_last_minute >= BUSINESS_CALLS_PER_MINUTE) {
    return "rate";
  }
  return null;
}

/** Whether a limit hands the conversation to a person (it won't clear by waiting a minute). */
export function handsOver(limit: Limit) {
  return limit !== "rate";
}

const messages: Record<Limit, Record<CustomerLanguage, string>> = {
  conversation: {
    en: "This conversation has gone on for a while, so a member of the team will take it from here. They'll reply in this chat.",
    ar: "طالت هذه المحادثة، لذلك سيتابع معك أحد أفراد فريق العمل من هنا. سيردّون عليك في هذه المحادثة.",
  },
  daily: {
    en: "The assistant isn't available for the rest of today, so a member of the team will reply in this chat.",
    ar: "المساعد غير متاح لبقية اليوم، لذلك سيرد عليك أحد أفراد فريق العمل في هذه المحادثة.",
  },
  rate: {
    en: "The assistant is very busy right now. Please try again in a minute.",
    ar: "المساعد مشغول جدًا الآن. يُرجى المحاولة مرة أخرى بعد دقيقة.",
  },
};

export function limitMessage(limit: Limit, language: CustomerLanguage) {
  return messages[limit][language];
}
