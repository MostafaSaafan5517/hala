"use client";

import { useActionState } from "react";
import type { BookingFormState } from "@/app/(app)/dashboard/b/[slug]/bookings/actions";
import type { ActionState } from "@/components/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { languageNames } from "@/lib/languages";

/** A free start time: the moment to send back, and how it reads ("10:00"). */
export type TimeOption = { value: string; label: string };

function TimeChoices({
  times,
  chosen,
}: {
  times: TimeOption[];
  chosen?: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">Time</legend>
      <div className="flex flex-wrap gap-2">
        {times.map((time) => (
          <label
            key={time.value}
            className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm tabular-nums has-checked:border-foreground has-checked:font-medium"
          >
            <input
              type="radio"
              name="startsAt"
              value={time.value}
              defaultChecked={time.value === chosen}
              required
              className="accent-foreground"
            />
            {time.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function FormError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  ) : null;
}

export function NewBookingForm({
  action,
  times,
  serviceId,
  staffId,
  idempotencyKey,
  defaultLanguage,
}: {
  action: (
    previous: BookingFormState,
    formData: FormData,
  ) => Promise<BookingFormState>;
  times: TimeOption[];
  serviceId: string;
  staffId: string | null;
  idempotencyKey: string;
  defaultLanguage: "en" | "ar";
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    fields: {},
  });

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4">
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="staffId" value={staffId ?? ""} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <TimeChoices times={times} chosen={state.fields.startsAt} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Customer name</Label>
          <Input
            id="name"
            name="name"
            dir="auto"
            autoComplete="off"
            defaultValue={state.fields.name}
            maxLength={80}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone, with country code</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            autoComplete="off"
            placeholder="+20 10 1234 5678"
            defaultValue={state.fields.phone}
            required
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="email">Email (optional)</Label>
          <Input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="off"
            defaultValue={state.fields.email}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="language">Speaks</Label>
          <NativeSelect
            id="language"
            name="language"
            className="w-full"
            defaultValue={state.fields.language || defaultLanguage}
          >
            {(["en", "ar"] as const).map((code) => (
              <NativeSelectOption key={code} value={code} lang={code}>
                {languageNames[code]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          name="notes"
          dir="auto"
          maxLength={500}
          defaultValue={state.fields.notes}
        />
      </div>
      <FormError error={state.error} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Booking..." : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}

export function MoveBookingForm({
  action,
  times,
  staffId,
  idempotencyKey,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  times: TimeOption[];
  staffId: string;
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
  });

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4">
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <TimeChoices times={times} />
      <FormError error={state.error} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Moving..." : "Move booking"}
        </Button>
      </div>
    </form>
  );
}
