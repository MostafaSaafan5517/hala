import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUSINESS_CALLS_PER_MINUTE,
  businessDailyBudgetUsd,
  CONVERSATION_TOKEN_BUDGET,
  handsOver,
  limitMessage,
  limitReached,
  siteDailyBudgetUsd,
} from "@/lib/assistant/limits";

const quiet = {
  conversation_tokens: 0,
  business_chat_calls_last_minute: 0,
  business_cost_today: 0,
  site_cost_today: 0,
};
const budgets = { business: 5, site: 20 };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("limitReached", () => {
  it("is null while the conversation and the business are within their limits", () => {
    expect(limitReached(quiet, budgets)).toBeNull();
    expect(
      limitReached(
        {
          conversation_tokens: CONVERSATION_TOKEN_BUDGET - 1,
          business_chat_calls_last_minute: BUSINESS_CALLS_PER_MINUTE - 1,
          business_cost_today: 4.99,
          site_cost_today: 19.99,
        },
        budgets,
      ),
    ).toBeNull();
  });

  it("names the limit reached, the conversation's budget first", () => {
    expect(
      limitReached(
        { ...quiet, conversation_tokens: CONVERSATION_TOKEN_BUDGET },
        budgets,
      ),
    ).toBe("conversation");
    expect(limitReached({ ...quiet, business_cost_today: 5 }, budgets)).toBe(
      "daily",
    );
    expect(limitReached({ ...quiet, site_cost_today: 20 }, budgets)).toBe(
      "site",
    );
    expect(
      limitReached(
        {
          ...quiet,
          business_chat_calls_last_minute: BUSINESS_CALLS_PER_MINUTE,
        },
        budgets,
      ),
    ).toBe("rate");
  });
});

describe("the daily budgets", () => {
  it("come from the environment: $5 a business, and no site-wide limit unless set", () => {
    vi.stubEnv("BUSINESS_DAILY_BUDGET_USD", "");
    vi.stubEnv("SITE_DAILY_BUDGET_USD", "");
    expect(businessDailyBudgetUsd()).toBe(5);
    expect(siteDailyBudgetUsd()).toBe(Number.POSITIVE_INFINITY);
    vi.stubEnv("BUSINESS_DAILY_BUDGET_USD", "0.15");
    vi.stubEnv("SITE_DAILY_BUDGET_USD", "0.16");
    expect(businessDailyBudgetUsd()).toBe(0.15);
    expect(siteDailyBudgetUsd()).toBe(0.16);
  });

  it("refuse a value that isn't a positive amount, rather than spend without a limit", () => {
    vi.stubEnv("SITE_DAILY_BUDGET_USD", "zero");
    expect(() => siteDailyBudgetUsd()).toThrow(
      "SITE_DAILY_BUDGET_USD must be a positive number of US dollars.",
    );
    vi.stubEnv("BUSINESS_DAILY_BUDGET_USD", "-1");
    expect(() => businessDailyBudgetUsd()).toThrow();
  });
});

describe("handsOver and limitMessage", () => {
  it("hands over only when waiting won't help, and explains in the customer's language", () => {
    expect(handsOver("conversation")).toBe(true);
    expect(handsOver("daily")).toBe(true);
    expect(handsOver("site")).toBe(true);
    expect(handsOver("rate")).toBe(false);
    expect(limitMessage("rate", "en")).toContain("try again in a minute");
    expect(limitMessage("conversation", "ar")).toContain("فريق العمل");
  });
});
