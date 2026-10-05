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

function budgetFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const budget = Number(raw);
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error(`${name} must be a positive number of US dollars.`);
  }
  return budget;
}

/** What one business may spend on AI per local day, in US dollars (BUSINESS_DAILY_BUDGET_USD). */
export function businessDailyBudgetUsd() {
  return budgetFromEnv("BUSINESS_DAILY_BUDGET_USD", 5);
}

/**
 * What the whole deployment may spend on AI per day (UTC), every business together, in US
 * dollars (SITE_DAILY_BUDGET_USD; no limit when unset). A public demo lets anyone create a
 * business, so per-business budgets alone can't protect a shared monthly credit.
 */
export function siteDailyBudgetUsd() {
  return budgetFromEnv("SITE_DAILY_BUDGET_USD", Number.POSITIVE_INFINITY);
}

/** Conversations one website visitor may start per hour (the widget). */
export const VISITOR_CONVERSATIONS_PER_HOUR = 5;

/** Chat model calls one website visitor may cause per minute, across their conversations. */
export const VISITOR_CALLS_PER_MINUTE = 10;

/** The most steps (model calls) in one turn, so a confused model can't loop. */
export const MAX_STEPS_PER_TURN = 8;

export type Limit = "conversation" | "rate" | "daily" | "site";

export function limitReached(
  usage: {
    conversation_tokens: number;
    business_chat_calls_last_minute: number;
    business_cost_today: number;
    site_cost_today: number;
  },
  budgets = { business: businessDailyBudgetUsd(), site: siteDailyBudgetUsd() },
): Limit | null {
  if (usage.conversation_tokens >= CONVERSATION_TOKEN_BUDGET) {
    return "conversation";
  }
  if (usage.business_cost_today >= budgets.business) return "daily";
  if (usage.site_cost_today >= budgets.site) return "site";
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
  site: {
    en: "The assistant isn't available for the rest of today, so a member of the team will reply in this chat.",
    ar: "المساعد غير متاح لبقية اليوم، لذلك سيرد عليك أحد أفراد فريق العمل في هذه المحادثة.",
  },
};

export function limitMessage(limit: Limit, language: CustomerLanguage) {
  return messages[limit][language];
}
