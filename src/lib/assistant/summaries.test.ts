import { describe, expect, it } from "vitest";
import { languageOfText } from "@/lib/assistant/language";
import {
  bookingSummary,
  cancellationSummary,
  rescheduleSummary,
  serviceNameIn,
} from "@/lib/assistant/summaries";

const booking = {
  serviceName: "Haircut",
  staffName: "Layla",
  startsAt: "2026-10-05T07:00:00Z",
  endsAt: "2026-10-05T07:45:00Z",
  price: 25000,
  currency: "EGP",
  customerName: "Mona Adel",
  customerPhone: "+201012345678",
};

describe("languageOfText", () => {
  it("is Arabic when the text has Arabic letters", () => {
    expect(languageOfText("أريد حجز موعد")).toBe("ar");
    expect(languageOfText("Book me for 10:00 please")).toBe("en");
  });
});

describe("serviceNameIn", () => {
  it("uses the customer's language, falling back to the other name", () => {
    const both = { name_en: "Haircut", name_ar: "قص شعر" };
    expect(serviceNameIn(both, "ar")).toBe("قص شعر");
    expect(serviceNameIn(both, "en")).toBe("Haircut");
    expect(serviceNameIn({ name_en: null, name_ar: "قص شعر" }, "en")).toBe(
      "قص شعر",
    );
  });
});

describe("bookingSummary", () => {
  it("says what will be booked, in the business's time zone", () => {
    // Intl puts a non-breaking space between the currency and the amount.
    expect(
      bookingSummary(booking, "Africa/Cairo", "en").replace(/\s/g, " "),
    ).toBe(
      "Haircut with Layla on Mon, 5 Oct 2026, 10:00 to 10:45, EGP 250.00, for Mona Adel (+20 10 12345678).",
    );
  });

  it("shows the note the customer is sending, so it can't be added unseen", () => {
    expect(
      bookingSummary(
        { ...booking, notes: "First visit" },
        "Africa/Cairo",
        "en",
      ),
    ).toMatch(/\. Note for the business: "First visit"\.$/);
    expect(
      bookingSummary({ ...booking, notes: "أول زيارة" }, "Africa/Cairo", "ar"),
    ).toMatch(/ملاحظة للنشاط: «أول زيارة»\.$/);
  });

  it("in Arabic for a customer writing Arabic", () => {
    const summary = bookingSummary(
      { ...booking, serviceName: "قص شعر", staffName: "ليلى" },
      "Africa/Cairo",
      "ar",
    );
    expect(summary).toContain("قص شعر مع ليلى");
    expect(summary).toContain("الاثنين، 5 أكتوبر 2026");
    expect(summary).toContain("حتى 10:45");
    expect(summary).toContain("250.00");
    expect(summary).toContain("(+20 10 12345678)");
  });
});

describe("rescheduleSummary and cancellationSummary", () => {
  it("name the booking and its times", () => {
    expect(
      rescheduleSummary(
        {
          reference: "7KQ2MX",
          serviceName: "Haircut",
          from: "2026-10-05T07:00:00Z",
          to: "2026-10-06T08:00:00Z",
          staffName: null,
        },
        "Africa/Cairo",
        "en",
      ),
    ).toBe(
      "Move booking 7KQ2MX (Haircut, Mon, 5 Oct 2026, 10:00) to Tue, 6 Oct 2026, 11:00.",
    );
    expect(
      cancellationSummary(
        {
          reference: "7KQ2MX",
          serviceName: "Haircut",
          startsAt: booking.startsAt,
        },
        "Africa/Cairo",
        "en",
      ),
    ).toBe("Cancel booking 7KQ2MX (Haircut, Mon, 5 Oct 2026, 10:00).");
  });
});
