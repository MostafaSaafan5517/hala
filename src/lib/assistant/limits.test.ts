import { describe, expect, it } from "vitest";
import {
  BUSINESS_CALLS_PER_MINUTE,
  BUSINESS_DAILY_BUDGET_USD,
  CONVERSATION_TOKEN_BUDGET,
  handsOver,
  limitMessage,
  limitReached,
} from "@/lib/assistant/limits";

const quiet = {
  conversation_tokens: 0,
  business_chat_calls_last_minute: 0,
  business_cost_today: 0,
};

describe("limitReached", () => {
  it("is null while the conversation and the business are within their limits", () => {
    expect(limitReached(quiet)).toBeNull();
    expect(
      limitReached({
        conversation_tokens: CONVERSATION_TOKEN_BUDGET - 1,
        business_chat_calls_last_minute: BUSINESS_CALLS_PER_MINUTE - 1,
        business_cost_today: BUSINESS_DAILY_BUDGET_USD - 0.01,
      }),
    ).toBeNull();
  });

  it("names the limit reached, the conversation's budget first", () => {
    expect(
      limitReached({
        ...quiet,
        conversation_tokens: CONVERSATION_TOKEN_BUDGET,
      }),
    ).toBe("conversation");
    expect(
      limitReached({
        ...quiet,
        business_cost_today: BUSINESS_DAILY_BUDGET_USD,
      }),
    ).toBe("daily");
    expect(
      limitReached({
        ...quiet,
        business_chat_calls_last_minute: BUSINESS_CALLS_PER_MINUTE,
      }),
    ).toBe("rate");
  });
});

describe("handsOver and limitMessage", () => {
  it("hands over only when waiting won't help, and explains in the customer's language", () => {
    expect(handsOver("conversation")).toBe(true);
    expect(handsOver("daily")).toBe(true);
    expect(handsOver("rate")).toBe(false);
    expect(limitMessage("rate", "en")).toContain("try again in a minute");
    expect(limitMessage("conversation", "ar")).toContain("فريق العمل");
  });
});
