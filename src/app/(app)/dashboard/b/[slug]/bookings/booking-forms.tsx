"use client";

import { useActionState } from "react";
import type { BookingFormState } from "@/app/(app)/dashboard/b/[slug]/bookings/actions";
import type { ActionState } from "@/components/action-button";
import { FormError } from "@/components/form-feedback";
import { surface } from "@/components/surface";
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
    // Choices as pills (DESIGN.md, Choosing one); the radio inside each keeps the keyboard and
    // screen reader behavior of a radio group.
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-small font-medium">Time</legend>
      <div className="flex flex-wrap gap-2">
        {times.map((time) => (
          <label
            key={time.value}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-input bg-card px-3.5 text-small tabular-nums hover:bg-muted has-checked:border-transparent has-checked:bg-accent has-checked:font-medium has-checked:text-accent-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background"
          >
            <input
              type="radio"
              name="startsAt"
              value={time.value}
              defaultChecked={time.value === chosen}
              required
              className="size-4 accent-primary focus-visible:outline-none"
            />
            {time.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
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
    <form action={formAction} className={`${surface} grid gap-5 p-5 sm:p-6`}>
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="staffId" value={staffId ?? ""} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <TimeChoices times={times} chosen={state.fields.startsAt} />
      <div className="grid gap-4 sm:grid-cols-2">
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
      <div className="grid gap-4 sm:grid-cols-2">
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
      {state.error && <FormError>{state.error}</FormError>}
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
    <form action={formAction} className={`${surface} grid gap-5 p-5 sm:p-6`}>
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <TimeChoices times={times} />
      {state.error && <FormError>{state.error}</FormError>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Moving..." : "Move booking"}
        </Button>
      </div>
    </form>
  );
}
