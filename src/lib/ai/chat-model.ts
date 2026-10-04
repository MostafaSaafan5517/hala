import "server-only";
import { gateway } from "ai";
import { CHAT_MODELS, type ChatModelId, isChatModelId } from "@/lib/ai/catalog";
import { offlineChatModel } from "@/lib/ai/offline-chat";

/**
 * The assistant's chat model, from CHAT_MODEL: a model ID from the catalog, called through the
 * Vercel AI Gateway, or "offline". Unset or unknown is an error, never a silent default.
 */
export function chatModelId(): ChatModelId {
  const id = process.env.CHAT_MODEL;
  if (!id || !isChatModelId(id)) {
    throw new Error(
      `CHAT_MODEL must be one of ${Object.keys(CHAT_MODELS).join(", ")} (see .env.example).`,
    );
  }
  return id;
}

export function chatModel(id: ChatModelId) {
  return id === "offline" ? offlineChatModel : gateway(id);
}

/**
 * The secret that signs the assistant's approval requests, so the server only runs a booking,
 * move or cancellation the customer really approved, on exactly the request it showed them.
 * Every server instance needs the same one.
 */
export function toolApprovalSecret() {
  const secret = process.env.TOOL_APPROVAL_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "TOOL_APPROVAL_SECRET must be set to at least 32 random characters (see .env.example).",
    );
  }
  return secret;
}
