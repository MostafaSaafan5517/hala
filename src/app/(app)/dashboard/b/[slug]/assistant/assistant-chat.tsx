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
        className="grid gap-3 rounded-lg border p-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        )}
        <ChatMessages
          messages={messages}
          labels={labels}
          onAnswer={(id, approved) => addToolApprovalResponse({ id, approved })}
        />
      </div>
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          {labels.replying}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {labels.error}
        </p>
      )}
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
