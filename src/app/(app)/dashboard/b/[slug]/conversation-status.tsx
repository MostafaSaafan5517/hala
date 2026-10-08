import {
  ChatCircleDots,
  CheckCircle,
  Hourglass,
  UserCircle,
} from "@phosphor-icons/react/ssr";
import { Badge, type BadgeTone } from "@/components/badge";
import type { Enums } from "@/lib/supabase/database.types";

type ConversationStatus = Enums<"conversation_status">;

export const conversationStatusLabels: Record<ConversationStatus, string> = {
  open: "Open",
  needs_human: "Waiting for the team",
  taken_over: "With the team",
  closed: "Closed",
};

const tones: Record<ConversationStatus, BadgeTone> = {
  open: "neutral",
  needs_human: "warning",
  taken_over: "accent",
  closed: "neutral",
};

const icons = {
  open: ChatCircleDots,
  needs_human: Hourglass,
  taken_over: UserCircle,
  closed: CheckCircle,
};

/** A conversation's status as a badge: its tone, an icon and the word. */
export function ConversationStatusBadge({
  status,
}: {
  status: ConversationStatus;
}) {
  const Glyph = icons[status];
  return (
    <Badge tone={tones[status]} icon={<Glyph aria-hidden="true" />}>
      {conversationStatusLabels[status]}
    </Badge>
  );
}
