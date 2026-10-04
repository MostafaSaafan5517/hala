"use client";

import { useActionState, useState } from "react";
import type {
  DocumentFormFields,
  DocumentFormState,
} from "@/app/(app)/dashboard/b/[slug]/knowledge/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { type Language, languageNames } from "@/lib/languages";
import {
  type KnowledgeKind,
  knowledgeKinds,
  MAX_TITLE_LENGTH,
} from "@/lib/knowledge/kinds";

/** Adds a document or edits one; `initial` holds what the fields start with. */
export function DocumentForm({
  action,
  kind,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (
    previous: DocumentFormState,
    formData: FormData,
  ) => Promise<DocumentFormState>;
  kind: KnowledgeKind;
  initial: DocumentFormFields & { language: Language };
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    fields: initial,
  });
  const { fields } = state;
  // The text fields follow the document's language: its direction, and the Arabic font.
  const [language, setLanguage] = useState<Language>(initial.language);
  const direction = language === "ar" ? "rtl" : "ltr";
  const { titleLabel, bodyLabel, maxBody, hint } = knowledgeKinds[kind];

  // React resets the form after each submit; the keys re-mount the text fields with what came
  // back from the action, since inputs only take a defaultValue on their first render.
  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="language">Written in</Label>
        <NativeSelect
          id="language"
          name="language"
          className="w-full sm:w-48"
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
        >
          {(["en", "ar"] as const).map((code) => (
            <NativeSelectOption key={code} value={code} lang={code}>
              {languageNames[code]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="title">{titleLabel}</Label>
        <Input
          key={`title-${fields.title}`}
          id="title"
          name="title"
          lang={language}
          dir={direction}
          defaultValue={fields.title}
          maxLength={MAX_TITLE_LENGTH}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="body">{bodyLabel}</Label>
        <Textarea
          key={`body-${fields.body}`}
          id="body"
          name="body"
          lang={language}
          dir={direction}
          defaultValue={fields.body}
          maxLength={maxBody}
          rows={kind === "faq" ? 4 : 10}
          aria-describedby="body-hint"
          required
        />
        <p id="body-hint" className="text-xs text-muted-foreground">
          {hint}
        </p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
