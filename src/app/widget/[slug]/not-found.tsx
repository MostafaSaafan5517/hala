import { ChatCircleDots } from "@phosphor-icons/react/ssr";

// Inside the frame, for a business that doesn't exist or hasn't turned its widget on. The
// visitor's language isn't known here, so it says so in both.
export default function WidgetNotFound() {
  return (
    <main className="hala-light grid min-h-dvh place-content-center justify-items-center gap-3 bg-card p-6 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <ChatCircleDots size={24} aria-hidden="true" />
      </span>
      <h1 className="grid gap-1 text-h3">
        <span>This chat isn&apos;t available.</span>
        <span lang="ar" dir="rtl">
          هذه المحادثة غير متاحة.
        </span>
      </h1>
    </main>
  );
}
