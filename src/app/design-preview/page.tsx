import {
  CalendarBlank,
  CalendarCheck,
  CaretDown,
  ChartBar,
  ChatCircleDots,
  CheckCircle,
  Globe,
  MagnifyingGlass,
  PaperPlaneRight,
  Plus,
  Scissors,
  Storefront,
  Tray,
  UserCircle,
  WarningCircle,
  X,
} from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import {
  Alexandria,
  Geist,
  IBM_Plex_Sans_Arabic,
  Rubik,
} from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import tokens from "../../../docs/design/tokens.json";
import "./preview.css";

// Hala's design system (docs/design/DESIGN.md), shown with its tokens and key components
// in English and Arabic, light and dark. Development only: a production build answers 404.

export const metadata: Metadata = {
  // In production the page is a 404, which shouldn't carry this page's title.
  title: process.env.NODE_ENV === "production" ? undefined : "Design preview",
  robots: { index: false },
};

// Only for the "fonts considered" comparison: today's pair and two other candidates. Readex Pro
// itself comes from the root layout.
const geist = Geist({ subsets: ["latin"] });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: "400" });
const alexandria = Alexandria({ subsets: ["latin", "arabic"] });
const rubik = Rubik({ subsets: ["latin", "arabic"] });

type Language = "en" | "ar";

const words = {
  en: {
    save: "Save details",
    newBooking: "New booking",
    cancel: "Cancel",
    allConversations: "All conversations",
    cancelBooking: "Cancel booking",
    businessName: "Business name",
    businessValue: "Nour Salon",
    businessHelp: "Customers see it in the chat.",
    password: "Password",
    passwordError:
      "Choose a stronger password: at least 8 characters, with letters and numbers.",
    timeZone: "Time zone",
    tabs: ["Overview", "Bookings", "Inbox", "Services", "Usage"],
    periods: ["Last 7 days", "Last 30 days"],
    badges: {
      waiting: "Waiting for the team",
      team: "With the team",
      closed: "Closed",
      confirmed: "Confirmed",
      cancelled: "Cancelled",
    },
    day: "Wednesday 7 October",
    bookings: [
      ["16:00-16:45", "Mona Adel", "Haircut with Layla", "JTU4DW"],
      ["18:30-18:50", "Khalid Omar", "Beard trim with Omar", "Q7MRK2"],
    ],
    tableCaption: "Day by day",
    tableHead: ["Day", "Conversations", "Bookings", "Spent"],
    tableRows: [
      ["Wed 7 Oct", "12", "4", "$0.0214"],
      ["Tue 6 Oct", "9", "3", "$0.0158"],
      ["Mon 5 Oct", "0", "0", "$0.00"],
    ],
    emptyTitle: "No services yet",
    emptyBody:
      "Add what customers can book: each one with how long it takes and what it costs.",
    newService: "New service",
    chat: {
      title: "Chat with Nour Salon",
      other: "العربية",
      close: "Close chat",
      parking: "Is there parking?",
      lookedUp: "Looked it up",
      parkingReply:
        "Yes, free parking behind the building, with a few spaces reserved for customers.",
      sources: "Sources",
      source: "Is there parking?",
      bookAsk: "Can I book a haircut on Friday at 5 pm?",
      checkedDetails: "Checked the business's details",
      checkedAvailability: "Checked availability",
      summary:
        "Haircut on Fri, 9 Oct 2026, 17:00 to 17:45, SAR 120.00, for Sara Al-Qahtani (+966 55 123 4567).",
      confirm: "Confirm",
      notNow: "Not now",
      booked: "Booked · HFSL49",
      team: "From the team",
      teamReply: "Hi, this is Rana at the front desk. How can I help?",
      withTeam: "You're chatting with the team.",
      message: "Message",
      placeholder: "Write a message",
      send: "Send",
      launcher: "Chat with us",
    },
  },
  ar: {
    save: "حفظ التفاصيل",
    newBooking: "حجز جديد",
    cancel: "إلغاء",
    allConversations: "كل المحادثات",
    cancelBooking: "إلغاء الحجز",
    businessName: "اسم النشاط",
    businessValue: "صالون نور",
    businessHelp: "يراه العملاء في المحادثة.",
    password: "كلمة المرور",
    passwordError: "اختر كلمة مرور أقوى: 8 أحرف على الأقل، فيها حروف وأرقام.",
    timeZone: "المنطقة الزمنية",
    tabs: ["نظرة عامة", "الحجوزات", "الوارد", "الخدمات", "الاستخدام"],
    periods: ["آخر 7 أيام", "آخر 30 يومًا"],
    badges: {
      waiting: "بانتظار الفريق",
      team: "مع الفريق",
      closed: "مغلقة",
      confirmed: "مؤكد",
      cancelled: "ملغى",
    },
    day: "الأربعاء 7 أكتوبر",
    bookings: [
      ["16:00-16:45", "منى عادل", "قص شعر مع ليلى", "JTU4DW"],
      ["18:30-18:50", "خالد عمر", "تهذيب اللحية مع عمر", "Q7MRK2"],
    ],
    tableCaption: "يومًا بيوم",
    tableHead: ["اليوم", "المحادثات", "الحجوزات", "التكلفة"],
    tableRows: [
      ["الأربعاء 7 أكتوبر", "12", "4", "$0.0214"],
      ["الثلاثاء 6 أكتوبر", "9", "3", "$0.0158"],
      ["الاثنين 5 أكتوبر", "0", "0", "$0.00"],
    ],
    emptyTitle: "لا توجد خدمات بعد",
    emptyBody: "أضف ما يمكن للعملاء حجزه: لكل خدمة مدتها وسعرها.",
    newService: "خدمة جديدة",
    chat: {
      title: "تحدّث مع صالون نور",
      other: "English",
      close: "إغلاق المحادثة",
      parking: "هل يوجد موقف للسيارات؟",
      lookedUp: "تم البحث",
      parkingReply: "نعم، يوجد موقف مجاني خلف المبنى، مع أماكن مخصصة للعملاء.",
      sources: "المصادر",
      source: "هل يوجد موقف للسيارات؟",
      bookAsk: "أريد حجز قص شعر يوم الجمعة الساعة 5 مساءً",
      checkedDetails: "تم الاطلاع على تفاصيل النشاط",
      checkedAvailability: "تم التحقق من المواعيد المتاحة",
      summary:
        "قص شعر، الجمعة 9 أكتوبر 2026، من 17:00 إلى 17:45، بسعر 120.00 ر.س، باسم سارة القحطاني \u2066(+966\u00a055\u00a0123\u00a04567)\u2069.",
      confirm: "تأكيد",
      notNow: "ليس الآن",
      booked: "تم الحجز · HFSL49",
      team: "من فريق العمل",
      teamReply: "مرحبًا، معك رنا من الاستقبال. كيف أساعدك؟",
      withTeam: "أنت تتحدث الآن مع فريق العمل.",
      message: "رسالتك",
      placeholder: "اكتب رسالتك",
      send: "إرسال",
      launcher: "تحدّث معنا",
    },
  },
} as const;

/** The colors shown as swatches, with what each is for; the values come from the tokens. */
const swatches: { name: keyof typeof tokens.color; role: string }[] = [
  { name: "bg", role: "Page" },
  { name: "surface", role: "Cards, panels" },
  { name: "surface-2", role: "Fills, assistant bubble" },
  { name: "line", role: "Dividers" },
  { name: "line-input", role: "Field borders (3:1)" },
  { name: "ink", role: "Text" },
  { name: "ink-2", role: "Secondary text" },
  { name: "ink-3", role: "Muted text" },
  { name: "accent", role: "Actions, focus" },
  { name: "accent-soft", role: "Selected, highlights" },
  { name: "success", role: "Booked, confirmed" },
  { name: "warning-ink", role: "Waiting" },
  { name: "danger", role: "Errors, cancel" },
];

const scale: { className: string; label: string; en: string; ar: string }[] = [
  {
    className: "text-display",
    label: "Display 44/52",
    en: "Welcome, we're here",
    ar: "أهلًا بك، نحن هنا",
  },
  {
    className: "text-h1",
    label: "H1 32/40",
    en: "Nour Salon",
    ar: "صالون نور",
  },
  {
    className: "text-h2",
    label: "H2 24/32",
    en: "Today's bookings",
    ar: "حجوزات اليوم",
  },
  {
    className: "text-h3",
    label: "H3 19/28",
    en: "Booking rules",
    ar: "قواعد الحجز",
  },
  {
    className: "text-large",
    label: "Large 17/28",
    en: "Haircut on Friday at 17:00, SAR 120.00.",
    ar: "قص شعر يوم الجمعة الساعة 17:00، بسعر 120.00 ر.س.",
  },
  {
    className: "text-body",
    label: "Body 15/24 (Arabic 15/28)",
    en: "Customers chat with the assistant on your website. It answers from your own information and books real appointments.",
    ar: "يتحدث العملاء مع المساعد على موقعك. يجيب من معلوماتك أنت ويحجز مواعيد حقيقية.",
  },
  {
    className: "text-small",
    label: "Small 13/20",
    en: "Times are in Asia/Riyadh time.",
    ar: "الأوقات بتوقيت الرياض.",
  },
  {
    className: "text-caption",
    label: "Caption 12/16",
    en: "Checked availability",
    ar: "تم التحقق من المواعيد المتاحة",
  },
];

/** A section of the preview, with its title and what it's for. */
function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5">
      <div className="grid gap-1">
        <h2 className="text-h2">{title}</h2>
        {note && (
          <p className="max-w-[70ch] text-small text-secondary-foreground">
            {note}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/** One language and theme of the components: lang, dir and the dark tokens when asked. */
function Frame({
  language,
  dark = false,
  label,
  children,
}: {
  language: Language;
  dark?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-2">
      <p className="text-caption font-medium text-muted-foreground">{label}</p>
      <div
        lang={language}
        dir={language === "ar" ? "rtl" : "ltr"}
        className={`${dark ? "hala-dark" : "hala-light"} grid content-start gap-6 rounded-surface bg-background p-5 text-foreground shadow-level-1`}
      >
        {children}
      </div>
    </div>
  );
}

function Button({
  kind = "primary",
  icon,
  children,
}: {
  kind?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  icon?: ReactNode;
  children: ReactNode;
}) {
  const look = {
    primary: "bg-primary text-primary-foreground hover:bg-primary-strong",
    secondary: "bg-muted text-foreground hover:bg-secondary-strong",
    outline:
      "bg-card text-foreground shadow-[inset_0_0_0_1px_var(--hala-line-input)] hover:bg-muted",
    ghost: "text-accent-foreground hover:bg-accent",
    danger:
      "bg-destructive-soft text-destructive hover:bg-destructive hover:text-destructive-foreground",
  }[kind];
  return (
    <button
      type="button"
      className={`hp-press inline-flex h-10 items-center gap-2 rounded-control px-4 text-[14px] font-medium ${look}`}
    >
      {icon}
      {children}
    </button>
  );
}

function Badge({
  tone,
  icon,
  children,
}: {
  tone: "warning" | "accent" | "neutral" | "success" | "danger";
  icon?: ReactNode;
  children: ReactNode;
}) {
  const look = {
    warning: "bg-warning-soft text-warning",
    accent: "bg-accent text-accent-foreground",
    neutral: "bg-muted text-secondary-foreground",
    success: "bg-success-soft text-success",
    danger: "bg-destructive-soft text-destructive",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption font-medium ${look}`}
    >
      {icon}
      {children}
    </span>
  );
}

/** Buttons, fields, the "choose one" control, badges, a list, a table and an empty state. */
function Components({ language }: { language: Language }) {
  const t = words[language];
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button>{t.save}</Button>
        <Button kind="secondary" icon={<Plus size={18} />}>
          {t.newBooking}
        </Button>
        <Button kind="outline">{t.cancel}</Button>
        <Button kind="ghost">{t.allConversations}</Button>
        <Button kind="danger">{t.cancelBooking}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-small font-medium">{t.businessName}</span>
          <input
            defaultValue={t.businessValue}
            className="h-10 rounded-control bg-card px-3 shadow-[inset_0_0_0_1px_var(--hala-line-input)]"
          />
          <span className="text-caption text-muted-foreground">
            {t.businessHelp}
          </span>
        </label>
        <label className="grid gap-1.5">
          <span className="text-small font-medium">{t.timeZone}</span>
          <span className="relative grid">
            <select
              defaultValue="Asia/Riyadh"
              className="h-10 w-full appearance-none rounded-control bg-card ps-3 pe-9 shadow-[inset_0_0_0_1px_var(--hala-line-input)]"
            >
              <option>Asia/Riyadh</option>
              <option>Africa/Cairo</option>
            </select>
            <CaretDown
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute end-3 top-3 text-muted-foreground"
            />
          </span>
        </label>
        <label className="grid gap-1.5 sm:col-span-2">
          <span className="text-small font-medium">{t.password}</span>
          <input
            type="password"
            defaultValue="password"
            aria-invalid="true"
            className="h-10 rounded-control bg-card px-3 shadow-[inset_0_0_0_2px_var(--hala-danger)]"
          />
          <span className="inline-flex items-center gap-1 text-caption text-destructive">
            <WarningCircle size={16} aria-hidden="true" />
            {t.passwordError}
          </span>
        </label>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap gap-1">
          {t.tabs.map((tab, index) => (
            <a
              key={tab}
              href="#components"
              aria-current={index === 2 ? "page" : undefined}
              className={`hp-press rounded-full px-3 py-1.5 text-small ${
                index === 2
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-secondary-foreground hover:bg-muted"
              }`}
            >
              {tab}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {t.periods.map((period, index) => (
            <span
              key={period}
              className={`rounded-full px-3 py-1.5 text-small ${
                index === 0
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-secondary-foreground shadow-[inset_0_0_0_1px_var(--hala-line)]"
              }`}
            >
              {period}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="warning" icon={<WarningCircle size={14} />}>
          {t.badges.waiting}
        </Badge>
        <Badge tone="accent" icon={<UserCircle size={14} />}>
          {t.badges.team}
        </Badge>
        <Badge tone="neutral">{t.badges.closed}</Badge>
        <Badge tone="success" icon={<CheckCircle size={14} />}>
          {t.badges.confirmed}
        </Badge>
        <Badge tone="danger">{t.badges.cancelled}</Badge>
      </div>

      <div className="overflow-hidden rounded-surface bg-card shadow-level-1">
        <p className="border-b border-border px-4 py-3 text-small font-medium">
          {t.day}
        </p>
        <ul className="divide-y divide-border">
          {t.bookings.map(([time, customer, what, reference]) => (
            <li
              key={reference}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3"
            >
              <span dir="ltr" className="text-small font-medium tabular-nums">
                {time}
              </span>
              <span className="grid">
                <span className="text-body font-medium">{customer}</span>
                <span className="text-small text-secondary-foreground">
                  {what}
                </span>
              </span>
              <span className="font-mono text-caption text-muted-foreground">
                {reference}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div
        role="region"
        aria-label={t.tableCaption}
        tabIndex={0}
        className="overflow-x-auto rounded-surface bg-card shadow-level-1"
      >
        <table className="w-full border-collapse">
          <caption className="px-4 pt-3 text-start text-small font-medium">
            {t.tableCaption}
          </caption>
          <thead>
            <tr className="text-caption text-muted-foreground">
              {t.tableHead.map((head, index) => (
                <th
                  key={head}
                  className={`px-4 py-2 font-medium ${index === 0 ? "text-start" : "text-end"}`}
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-small">
            {t.tableRows.map((row) => (
              <tr
                key={row[0]}
                className="border-t border-border hover:bg-muted"
              >
                {row.map((cell, index) => (
                  <td
                    key={index}
                    className={`px-4 py-2.5 ${index === 0 ? "text-start" : "text-end tabular-nums"}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid justify-items-center gap-3 rounded-surface bg-card px-6 py-8 text-center shadow-level-1">
        <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <Scissors size={24} aria-hidden="true" />
        </span>
        <p className="text-h3">{t.emptyTitle}</p>
        <p className="max-w-[42ch] text-small text-secondary-foreground">
          {t.emptyBody}
        </p>
        <Button icon={<Plus size={18} />}>{t.newService}</Button>
      </div>
    </>
  );
}

/** A process line: what the assistant looked up, quiet but legible. */
function Step({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
      {icon}
      {children}
    </p>
  );
}

/** The widget open in the middle of a conversation: every message kind and the confirmation. */
function Widget({ language }: { language: Language }) {
  const t = words[language].chat;
  const initial = language === "ar" ? "ن" : "N";
  return (
    <div
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      className="hala-light grid w-full max-w-[400px] min-w-0 content-start gap-3"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] overflow-hidden rounded-[20px] bg-card shadow-level-3">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground"
          >
            {initial}
          </span>
          <h3 className="min-w-0 flex-1 truncate text-body font-semibold">
            {t.title}
          </h3>
          <button
            type="button"
            lang={language === "ar" ? "en" : "ar"}
            className="hp-press inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-small text-secondary-foreground hover:bg-muted"
          >
            <Globe size={16} aria-hidden="true" />
            {t.other}
          </button>
          <button
            type="button"
            aria-label={t.close}
            className="hp-press grid size-11 place-items-center rounded-full text-secondary-foreground hover:bg-muted"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-3 px-4 py-4">
          <p className="max-w-[85%] justify-self-end rounded-bubble rounded-ee-bubble-tail bg-primary px-3.5 py-2 text-body text-primary-foreground">
            {t.parking}
          </p>
          <div className="grid max-w-[88%] justify-items-start gap-1.5">
            <Step icon={<MagnifyingGlass size={14} aria-hidden="true" />}>
              {t.lookedUp}
            </Step>
            <p className="rounded-bubble rounded-es-bubble-tail bg-muted px-3.5 py-2 text-body">
              {t.parkingReply}{" "}
              <span className="text-accent-foreground">[1]</span>
            </p>
            <p className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
              {t.sources}
              <span className="rounded-full bg-muted px-2 py-0.5 text-secondary-foreground">
                1 · {t.source}
              </span>
            </p>
          </div>
          <p className="max-w-[85%] justify-self-end rounded-bubble rounded-ee-bubble-tail bg-primary px-3.5 py-2 text-body text-primary-foreground">
            {t.bookAsk}
          </p>
          <div className="grid max-w-[92%] gap-1.5">
            <Step icon={<Storefront size={14} aria-hidden="true" />}>
              {t.checkedDetails}
            </Step>
            <Step icon={<CalendarBlank size={14} aria-hidden="true" />}>
              {t.checkedAvailability}
            </Step>
            <div
              role="group"
              aria-label={t.confirm}
              className="grid gap-3 rounded-surface bg-card p-4 shadow-level-2"
            >
              <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
                <CalendarCheck size={20} aria-hidden="true" />
              </span>
              <p className="text-large font-medium">{t.summary}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="hp-press h-11 rounded-control bg-primary font-medium text-primary-foreground hover:bg-primary-strong"
                >
                  {t.confirm}
                </button>
                <button
                  type="button"
                  className="hp-press h-11 rounded-control bg-muted font-medium hover:bg-secondary-strong"
                >
                  {t.notNow}
                </button>
              </div>
            </div>
            <Step
              icon={
                <CheckCircle
                  size={14}
                  weight="fill"
                  aria-hidden="true"
                  className="text-success"
                />
              }
            >
              <span className="font-medium text-success">{t.booked}</span>
            </Step>
          </div>
          <div className="grid max-w-[88%] gap-1 rounded-bubble rounded-es-bubble-tail bg-card px-3.5 py-2 shadow-[inset_3px_0_0_var(--hala-accent),var(--hala-shadow-1)] rtl:shadow-[inset_-3px_0_0_var(--hala-accent),var(--hala-shadow-1)]">
            <span className="inline-flex items-center gap-1 text-caption font-medium text-accent-foreground">
              <UserCircle size={14} aria-hidden="true" />
              {t.team}
            </span>
            <p className="text-body">{t.teamReply}</p>
          </div>
          <p
            aria-hidden="true"
            className="flex gap-1 justify-self-start rounded-bubble rounded-es-bubble-tail bg-muted px-3.5 py-3"
          >
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-typing"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 border-t border-border p-3">
          <p className="inline-flex items-center gap-1.5 px-1 text-caption text-accent-foreground">
            <UserCircle size={14} aria-hidden="true" />
            {t.withTeam}
          </p>
          <div className="flex items-end gap-2 rounded-[14px] bg-muted p-1.5 ps-3">
            <label className="sr-only" htmlFor={`message-${language}`}>
              {t.message}
            </label>
            <textarea
              id={`message-${language}`}
              rows={1}
              placeholder={t.placeholder}
              className="max-h-28 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-body outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              aria-label={t.send}
              className="hp-press grid size-11 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground hover:bg-primary-strong"
            >
              <PaperPlaneRight
                size={20}
                weight="fill"
                className="rtl:-scale-x-100"
              />
            </button>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="hp-press inline-flex h-12 items-center gap-2 justify-self-end rounded-full bg-primary ps-4 pe-5 font-medium text-primary-foreground shadow-level-2"
      >
        <ChatCircleDots size={22} weight="fill" aria-hidden="true" />
        {t.launcher}
      </button>
    </div>
  );
}

/** A slice of the dashboard: the frame, the section tabs and a stat row (sample values). */
function DashboardSlice() {
  return (
    <div
      lang="en"
      className="overflow-hidden rounded-surface bg-background shadow-level-1"
    >
      <div className="flex items-center gap-3 border-b border-border bg-card px-5 py-3">
        <span className="grid size-8 place-items-center rounded-[9px] bg-primary text-[14px] font-semibold text-primary-foreground">
          <span lang="ar">هلا</span>
        </span>
        <span className="font-semibold">Hala</span>
        <span className="text-input">/</span>
        <span className="inline-flex items-center gap-1 text-small font-medium">
          Nour Salon
          <CaretDown size={14} aria-hidden="true" />
        </span>
      </div>
      <div className="grid gap-5 p-5">
        <nav className="flex flex-wrap gap-1" aria-label="Business">
          {[
            ["Overview", Storefront],
            ["Bookings", CalendarBlank],
            ["Inbox", Tray],
            ["Usage", ChartBar],
          ].map(([label, Icon], index) => {
            const Glyph = Icon as typeof Storefront;
            return (
              <a
                key={label as string}
                href="#dashboard"
                aria-current={index === 3 ? "page" : undefined}
                className={`hp-press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-small ${
                  index === 3
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-secondary-foreground hover:bg-muted"
                }`}
              >
                <Glyph size={16} aria-hidden="true" />
                {label as string}
              </a>
            );
          })}
        </nav>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="grid gap-3 rounded-surface bg-card p-4 shadow-level-1">
            <p className="text-small text-secondary-foreground">Spent today</p>
            <p className="text-h1 tabular-nums">
              $0.04{" "}
              <span className="text-small font-normal text-muted-foreground">
                of $5.00
              </span>
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[2%] rounded-full bg-primary" />
            </div>
          </div>
          {[
            ["Website conversations", "12"],
            ["Bookings by the assistant", "4"],
            ["Asked for a person", "1"],
          ].map(([label, value]) => (
            <div key={label} className="grid content-start gap-1 pt-4">
              <p className="text-small text-secondary-foreground">{label}</p>
              <p className="text-h2 tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">
          Sample values for the preview.
        </p>
      </div>
    </div>
  );
}

export default function DesignPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="flex-1 bg-background text-foreground">
      <main className="mx-auto grid max-w-[1320px] gap-14 px-4 py-10 sm:px-8">
        <header className="grid gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-[14px] bg-primary text-[19px] font-semibold text-primary-foreground">
              <span lang="ar">هلا</span>
            </span>
            <p className="text-h2">
              Hala <span className="text-input">|</span>{" "}
              <span lang="ar">هلا</span>
            </p>
          </div>
          <h1 className="max-w-[22ch] text-display">
            A front desk that says welcome, in both languages
          </h1>
          <p className="max-w-[68ch] text-large text-secondary-foreground">
            Hala&apos;s design system: warm stone neutrals, one deep teal for
            everything you can act on, and Readex Pro setting Arabic and English
            together. Everything here uses the app&apos;s own tokens.
            Development only; the reasoning is in docs/design/DESIGN.md, the
            tokens in docs/design/TOKENS.md.
          </p>
        </header>

        <Section
          title="Color"
          note="Stone neutrals with a trace of warmth, one teal accent, and status colors that only ever mean status. Every text pair is AA or better in both modes (computed, see DESIGN.md)."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {(["light", "dark"] as const).map((mode) => (
              <div
                key={mode}
                className={`${mode === "dark" ? "hala-dark" : "hala-light"} grid gap-2 rounded-surface bg-background p-4 shadow-level-1`}
              >
                <p className="text-small font-medium">
                  {mode === "light" ? "Light" : "Dark"}
                </p>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {swatches.map((swatch) => (
                    <li key={swatch.name} className="grid gap-1">
                      <span
                        className="h-12 rounded-control shadow-[inset_0_0_0_1px_oklch(0.5_0_0/0.15)]"
                        style={{
                          background: tokens.color[swatch.name][mode].hex,
                        }}
                      />
                      <span className="text-caption font-medium">
                        {swatch.name}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {tokens.color[swatch.name][mode].hex} · {swatch.role}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Type"
          note="Readex Pro for both scripts: its Arabic was drawn alongside its Latin, so the two share weight, color and rhythm. Arabic keeps the sizes and gets more line height; only Latin display sizes tighten their tracking. Digits are Western in both languages."
        >
          <div className="overflow-hidden rounded-surface bg-card shadow-level-1">
            {scale.map((step) => (
              <div
                key={step.label}
                className="grid gap-x-8 gap-y-2 border-b border-border px-5 py-4 last:border-b-0 lg:grid-cols-[140px_1fr_1fr]"
              >
                <p className="pt-1.5 text-caption text-muted-foreground">
                  {step.label}
                </p>
                <p lang="en" className={step.className}>
                  {step.en}
                </p>
                <p lang="ar" dir="rtl" className={step.className}>
                  {step.ar}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Shape, depth and space"
          note="Controls 10px, surfaces 16px, chat bubbles 18px with a 6px corner on the speaker's side, and pills for choices and badges. Surfaces lift with a soft warm shadow instead of sitting in borders. Space steps by 4px."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Level 1: cards and lists", "--hala-shadow-1"],
              ["Level 2: the confirmation, popovers", "--hala-shadow-2"],
              ["Level 3: the widget over a website", "--hala-shadow-3"],
            ].map(([label, shadow]) => (
              <div
                key={label}
                className="grid h-28 place-items-center rounded-surface bg-card px-4 text-center"
                style={{ boxShadow: `var(${shadow})` }}
              >
                <span className="text-small text-secondary-foreground">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {[4, 8, 12, 16, 24, 32, 48, 64].map((size) => (
              <div key={size} className="grid justify-items-center gap-1">
                <span
                  className="block rounded-[3px] bg-accent"
                  style={{ width: size, height: size }}
                />
                <span className="text-caption text-muted-foreground">
                  {size}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="The widget"
          note="What customers see: the business's initial in the header, the customer's messages in teal, the assistant's in stone, the team's marked with a teal edge and a label, quiet process lines, and a confirmation card that is unmistakably the moment to decide. The composer is one line that grows. It stays light on every website."
        >
          <div className="grid justify-items-center gap-10 lg:grid-cols-2">
            <Widget language="en" />
            <Widget language="ar" />
          </div>
        </Section>

        <Section
          title="Components"
          note="The same components in English and Arabic, light and dark. One choose-one control (pills), one button shape, status always with an icon and a word."
        >
          <div id="components" className="grid gap-6 lg:grid-cols-2">
            <Frame language="en" label="English, light">
              <Components language="en" />
            </Frame>
            <Frame language="ar" label="Arabic, light">
              <Components language="ar" />
            </Frame>
            <Frame language="en" dark label="English, dark">
              <Components language="en" />
            </Frame>
            <Frame language="ar" dark label="Arabic, dark">
              <Components language="ar" />
            </Frame>
          </div>
        </Section>

        <Section
          title="The dashboard, wider"
          note="A top bar with the business, section tabs as pills with icons, and a page that uses the width: the day's spend leads, the counts follow without boxes."
        >
          <div id="dashboard">
            <DashboardSlice />
          </div>
        </Section>

        <Section
          title="Fonts considered"
          note="The same line in each candidate. Readex Pro was chosen; Hala used Geist with IBM Plex Sans Arabic before the redesign."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [
                "Readex Pro (chosen)",
                "var(--font-readex)",
                "var(--font-readex)",
              ],
              [
                "Geist with IBM Plex Sans Arabic (before)",
                geist.style.fontFamily,
                plexArabic.style.fontFamily,
              ],
              [
                "Alexandria",
                alexandria.style.fontFamily,
                alexandria.style.fontFamily,
              ],
              ["Rubik", rubik.style.fontFamily, rubik.style.fontFamily],
            ].map(([label, latin, arabic]) => (
              <div
                key={label}
                className="grid gap-2 rounded-surface bg-card p-4 shadow-level-1"
              >
                <p className="text-caption text-muted-foreground">{label}</p>
                <p
                  lang="en"
                  className="text-[17px] leading-7"
                  style={{ fontFamily: latin }}
                >
                  Book a haircut on Friday at 17:00, SAR 120.00.
                </p>
                <p
                  lang="ar"
                  dir="rtl"
                  className="text-[17px] leading-8"
                  style={{ fontFamily: arabic }}
                >
                  احجز قص شعر يوم الجمعة الساعة 17:00، بسعر 120.00 ر.س.
                </p>
              </div>
            ))}
          </div>
        </Section>
      </main>
    </div>
  );
}
