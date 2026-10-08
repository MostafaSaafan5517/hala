"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessages } from "@/components/chat/chat-messages";
import { chatLabels } from "@/components/chat/labels";
import { turnRequestBody } from "@/components/chat/turn-request";
import { FormError } from "@/components/form-feedback";

const labels = chatLabels.en;

export function AssistantChat({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
}) {
  const { messages, sendMessage, addToolApprovalResponse, status, error } =
    useChat({
      id: conversationId,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: `/api/assistant/${conversationId}`,
        // The server keeps the conversation: send only what's new.
        prepareSendMessagesRequest: ({ messages: current }) => ({
          body: turnRequestBody(current),
        }),
      }),
      // Once every request in the reply is answered, carry on.
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="grid gap-4">
      <div
        role="log"
        aria-label="Conversation"
        className="grid min-h-48 grid-cols-[minmax(0,1fr)] content-start gap-3 rounded-surface bg-card p-4 shadow-level-1 sm:p-5"
      >
        {messages.length === 0 && (
          <p className="text-secondary-foreground">{labels.empty}</p>
        )}
        <ChatMessages
          messages={messages}
          labels={labels}
          replying={busy}
          onAnswer={(id, approved) => addToolApprovalResponse({ id, approved })}
        />
      </div>
      {/* The typing dots show it; this says it to screen readers. */}
      {busy && (
        <p role="status" className="sr-only">
          {labels.replying}
        </p>
      )}
      {error && <FormError>{labels.error}</FormError>}
      <ChatComposer
        labels={labels}
        busy={busy}
        onSend={async (text) => {
          void sendMessage({ text });
          return true;
        }}
      />
    </div>
  );
}
