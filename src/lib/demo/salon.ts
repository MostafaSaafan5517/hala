// What the demo salon is made of: a salon in Riyadh with two staff, four services, Gulf opening
// hours, and FAQs and policies in English and Arabic for the assistant to answer from.

export const DEMO_BUSINESS = {
  name: "Nour Salon",
  timezone: "Asia/Riyadh",
  default_language: "en" as const,
  booking_notice_minutes: 60,
  booking_horizon_days: 30,
  slot_interval_minutes: 15,
  cancellation_notice_hours: 24,
  widget_enabled: true,
  // Only Hala's own pages may show it: the demo website (/demo) lives on the same site.
  widget_origins: [] as string[],
};

export const DEMO_SERVICES = [
  {
    name_en: "Haircut",
    name_ar: "قص شعر",
    duration_minutes: 45,
    buffer_minutes: 15,
    price: 12000,
    staff: ["Layla", "Omar"],
  },
  {
    name_en: "Blow-dry",
    name_ar: "سشوار",
    duration_minutes: 30,
    buffer_minutes: 0,
    price: 8000,
    staff: ["Layla"],
  },
  {
    name_en: "Beard trim",
    name_ar: "تهذيب اللحية",
    duration_minutes: 20,
    buffer_minutes: 10,
    price: 5000,
    staff: ["Omar"],
  },
  {
    name_en: "Hair colour",
    name_ar: "صبغة شعر",
    duration_minutes: 90,
    buffer_minutes: 15,
    price: 35000,
    staff: ["Layla"],
  },
];

export const DEMO_CURRENCY = "SAR";
export const DEMO_STAFF = ["Layla", "Omar"];

/** 10:00 to 21:00 every day but Friday (weekday 5), which opens at 14:00. */
export const DEMO_HOURS = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  opens_at: weekday === 5 ? "14:00" : "10:00",
  closes_at: "21:00",
}));

export const DEMO_DOCUMENTS = [
  {
    kind: "faq" as const,
    language: "en" as const,
    title: "Is there parking?",
    body: "Yes, free parking behind the building, with a few spaces reserved for customers.",
  },
  {
    kind: "faq" as const,
    language: "ar" as const,
    title: "أين يقع الصالون؟",
    body: "في حي العليا بالرياض، شارع التحلية، بجانب مكتبة جرير. يوجد موقف مجاني خلف المبنى.",
  },
  {
    kind: "faq" as const,
    language: "en" as const,
    title: "How can I pay?",
    body: "Cash, Mada and all major credit cards. We don't accept cheques.",
  },
  {
    kind: "faq" as const,
    language: "en" as const,
    title: "Do you cut children's hair?",
    body: "Yes, for children aged 4 to 12, at the same price as an adult haircut. A parent must stay during the appointment.",
  },
  {
    kind: "faq" as const,
    language: "ar" as const,
    title: "هل تستخدمون منتجات خالية من الأمونيا؟",
    body: "نعم، نستخدم صبغات خالية من الأمونيا ومنتجات مناسبة للبشرة الحساسة. أخبرنا عن أي حساسية قبل موعدك.",
  },
  {
    kind: "policy" as const,
    language: "en" as const,
    title: "Cancellation policy",
    body: "You can cancel or move a booking free of charge up to 24 hours before it starts. Closer than that, please contact the salon and we'll do our best to help.",
  },
  {
    kind: "policy" as const,
    language: "ar" as const,
    title: "سياسة التأخير",
    body: "إذا تأخرت أكثر من 15 دقيقة فقد نضطر إلى تقصير موعدك أو إعادة جدولته. نرجو إبلاغنا مسبقاً إذا كنت ستتأخر.",
  },
];

/** Upcoming bookings, so the Bookings tab and the usage have something to show after a reset. */
export const DEMO_BOOKINGS = [
  {
    daysAhead: 1,
    time: "16:00",
    service: "Haircut",
    staff: "Layla",
    customer: "Mona Adel",
    phone: "+966501234567",
  },
  {
    daysAhead: 2,
    time: "18:30",
    service: "Beard trim",
    staff: "Omar",
    customer: "Khalid Al-Harbi",
    phone: "+966557654321",
  },
];

/** A website conversation waiting for the team, so the inbox has one to take over. */
export const DEMO_CONVERSATION = [
  { role: "user" as const, text: "Hi, do you do bridal hair and makeup?" },
  {
    role: "assistant" as const,
    text: "I don't have information about bridal hair or makeup. Would you like me to ask the team for you?",
  },
  { role: "user" as const, text: "Yes please, for a wedding next month." },
  {
    role: "assistant" as const,
    text: "I've asked the team to join this chat. Someone will reply here soon.",
  },
];
