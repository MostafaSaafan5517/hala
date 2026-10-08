"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import {
  createBusiness,
  type NewBusinessFormState,
} from "@/app/(app)/dashboard/new-business/actions";
import { FormError } from "@/components/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { type Language, languageNames } from "@/lib/languages";
import {
  MAX_SLUG_LENGTH,
  MIN_SLUG_LENGTH,
  SLUG_PATTERN,
  slugify,
} from "@/lib/slug";

const initialState: NewBusinessFormState = { error: null };

const noSubscription = () => () => {};

export function NewBusinessForm({ timeZones }: { timeZones: string[] }) {
  const [state, formAction, pending] = useActionState(
    createBusiness,
    initialState,
  );
  // Controlled, so what the user typed survives the form reset after a failed submit, and so
  // the web address can follow the name until the user edits it themselves.
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [chosenZone, setChosenZone] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("en");
  // The browser's own zone is the likeliest answer. The server can't know it, so it renders UTC
  // and the browser switches once it has hydrated, without a mismatch.
  const browserZone = useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
  const timezone =
    chosenZone ??
    (browserZone && timeZones.includes(browserZone) ? browserZone : "UTC");

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Business name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(slugify(event.target.value));
          }}
          maxLength={100}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="slug">Web address</Label>
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugEdited(true);
          }}
          aria-describedby="slug-hint"
          pattern={SLUG_PATTERN}
          minLength={MIN_SLUG_LENGTH}
          maxLength={MAX_SLUG_LENGTH}
          required
        />
        <p id="slug-hint" className="text-caption text-muted-foreground">
          Identifies your business in links. Lowercase letters, numbers and
          dashes; it can&apos;t change later.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="timezone">Time zone</Label>
        <NativeSelect
          id="timezone"
          name="timezone"
          value={timezone}
          onChange={(event) => setChosenZone(event.target.value)}
          aria-describedby="timezone-hint"
          className="w-full"
        >
          {timeZones.map((zone) => (
            <NativeSelectOption key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p id="timezone-hint" className="text-caption text-muted-foreground">
          Where your business is: opening hours and appointments are in this
          time zone.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="defaultLanguage">Assistant&apos;s first language</Label>
        <NativeSelect
          id="defaultLanguage"
          name="defaultLanguage"
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
          aria-describedby="language-hint"
          className="w-full"
        >
          {Object.entries(languageNames).map(([code, label]) => (
            <NativeSelectOption key={code} value={code} lang={code}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p id="language-hint" className="text-caption text-muted-foreground">
          It greets customers in this language and switches when they write in
          the other one.
        </p>
      </div>
      {state.error && <FormError>{state.error}</FormError>}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="justify-self-start"
      >
        {pending ? "Creating business..." : "Create business"}
      </Button>
    </form>
  );
}
