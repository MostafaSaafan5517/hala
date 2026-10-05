import type { Enums } from "@/lib/supabase/database.types";

export const conversationStatusLabels: Record<
  Enums<"conversation_status">,
  string
> = {
  open: "Open",
  needs_human: "Waiting for the team",
  taken_over: "With the team",
  closed: "Closed",
};
