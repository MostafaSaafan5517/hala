import type { CustomerLanguage } from "@/lib/assistant/language";

/** Everything the chat says around the messages, in each language a customer may use. */
export type ChatLabels = {
  you: string;
  assistant: string;
  team: string;
  lookups: Record<string, string>;
  booked: (reference: string) => string;
  moved: (reference: string) => string;
  cancelled: (reference: string) => string;
  couldNotComplete: string;
  confirming: string;
  couldNotGoAhead: string;
  notConfirmed: string;
  confirm: string;
  notNow: string;
  sources: string;
  replying: string;
  error: string;
  message: string;
  send: string;
  empty: string;
};

export const chatLabels: Record<CustomerLanguage, ChatLabels> = {
  en: {
    you: "You:",
    assistant: "Assistant:",
    team: "From the team",
    lookups: {
      search_knowledge: "Looked it up",
      business_info: "Checked the business's details",
      check_availability: "Checked availability",
      find_bookings: "Looked up bookings",
      request_human: "Asked the team to take over",
    },
    booked: (reference) => `Booked · ${reference}`,
    moved: (reference) => `Moved · ${reference}`,
    cancelled: (reference) => `Cancelled · ${reference}`,
    couldNotComplete: "Couldn't complete it.",
    confirming: "Confirming...",
    couldNotGoAhead: "Couldn't go ahead.",
    notConfirmed: "Not confirmed.",
    confirm: "Confirm",
    notNow: "Not now",
    sources: "Sources:",
    replying: "Replying...",
    error: "Something went wrong. Please try again.",
    message: "Message",
    send: "Send",
    empty: "Ask a question, or ask to book.",
  },
  ar: {
    you: "أنت:",
    assistant: "المساعد:",
    team: "من فريق العمل",
    lookups: {
      search_knowledge: "تم البحث",
      business_info: "تم الاطلاع على تفاصيل النشاط",
      check_availability: "تم التحقق من المواعيد المتاحة",
      find_bookings: "تم البحث عن الحجوزات",
      request_human: "تم طلب أحد أفراد الفريق",
    },
    booked: (reference) => `تم الحجز · ${reference}`,
    moved: (reference) => `تم نقل الموعد · ${reference}`,
    cancelled: (reference) => `تم الإلغاء · ${reference}`,
    couldNotComplete: "تعذّر إتمام ذلك.",
    confirming: "جارٍ التأكيد...",
    couldNotGoAhead: "تعذّر المتابعة.",
    notConfirmed: "لم يتم التأكيد.",
    confirm: "تأكيد",
    notNow: "ليس الآن",
    sources: "المصادر:",
    replying: "جارٍ الرد...",
    error: "حدث خطأ. يُرجى المحاولة مرة أخرى.",
    message: "رسالتك",
    send: "إرسال",
    empty: "اسأل سؤالًا، أو اطلب حجز موعد.",
  },
};
