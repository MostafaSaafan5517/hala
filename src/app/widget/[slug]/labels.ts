import type { CustomerLanguage } from "@/lib/assistant/language";

/** The widget's own words, around the chat, in each language. */
export const widgetLabels: Record<
  CustomerLanguage,
  {
    title: (business: string) => string;
    close: string;
    otherLanguage: { code: CustomerLanguage; name: string };
    waiting: string;
    withTeam: string;
    ended: string;
    newConversation: string;
    tooMany: string;
  }
> = {
  en: {
    title: (business) => `Chat with ${business}`,
    close: "Close chat",
    otherLanguage: { code: "ar", name: "العربية" },
    waiting:
      "We've asked the team to join. They'll reply here; the assistant can keep helping meanwhile.",
    withTeam: "You're chatting with the team.",
    ended: "This conversation has ended.",
    newConversation: "Start a new conversation",
    tooMany: "You've started several conversations. Please try again later.",
  },
  ar: {
    title: (business) => `تحدّث مع ${business}`,
    close: "إغلاق المحادثة",
    otherLanguage: { code: "en", name: "English" },
    waiting:
      "طلبنا من فريق العمل الانضمام، وسيردّون هنا. يمكن للمساعد مواصلة مساعدتك في الأثناء.",
    withTeam: "أنت تتحدث الآن مع فريق العمل.",
    ended: "انتهت هذه المحادثة.",
    newConversation: "بدء محادثة جديدة",
    tooMany: "لقد بدأت عدة محادثات. يُرجى المحاولة لاحقًا.",
  },
};
