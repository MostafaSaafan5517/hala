import {
  CalendarCheck,
  ChatsCircle,
  Translate,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";

/** What the product does, for the home and sign-in pages: only what it really does. */
const points: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <ChatsCircle aria-hidden="true" />,
    title: "Answers from your own information",
    text: "Your FAQs and policies, with the source shown. When it doesn't know, it says so and offers a person.",
  },
  {
    icon: <CalendarCheck aria-hidden="true" />,
    title: "Books real appointments",
    text: "It checks live availability, and books only once the customer confirms on screen.",
  },
  {
    icon: <Translate aria-hidden="true" />,
    title: "Arabic and English",
    text: "Customers write in either, and the chat follows them, right to left included.",
  },
  {
    icon: <UsersThree aria-hidden="true" />,
    title: "Your team stays in charge",
    text: "Take over any conversation from the inbox, and reply yourself.",
  },
];

export function ProductPoints() {
  return (
    <ul className="grid gap-5">
      {points.map((point) => (
        <li key={point.title} className="flex gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-accent-foreground shadow-level-1 [&_svg]:size-5">
            {point.icon}
          </span>
          <span className="grid gap-0.5">
            <span className="font-medium text-foreground">{point.title}</span>
            <span className="text-small text-secondary-foreground">
              {point.text}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
