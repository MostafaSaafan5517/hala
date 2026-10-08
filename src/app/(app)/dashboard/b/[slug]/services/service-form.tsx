"use client";

import { useActionState } from "react";
import type {
  ServiceFormFields,
  ServiceFormState,
} from "@/app/(app)/dashboard/b/[slug]/services/actions";
import { FormError } from "@/components/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

/** Adds a service or edits one; `initial` holds what the fields start with. */
export function ServiceForm({
  action,
  initial,
  currencies,
  submitLabel,
  pendingLabel,
}: {
  action: (
    previous: ServiceFormState,
    formData: FormData,
  ) => Promise<ServiceFormState>;
  initial: ServiceFormFields;
  currencies: readonly string[];
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    fields: initial,
  });
  const { fields } = state;

  // React resets the form after each submit. The fields come back from the action's result, and
  // the keys re-mount them, because inputs don't accept a new defaultValue after their first
  // render.
  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="nameEn">Name in English</Label>
          <Input
            key={`en-${fields.nameEn}`}
            id="nameEn"
            name="nameEn"
            lang="en"
            dir="ltr"
            defaultValue={fields.nameEn}
            maxLength={80}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nameAr">Name in Arabic</Label>
          <Input
            key={`ar-${fields.nameAr}`}
            id="nameAr"
            name="nameAr"
            lang="ar"
            dir="rtl"
            defaultValue={fields.nameAr}
            maxLength={80}
          />
        </div>
      </div>
      <p className="-mt-2 text-caption text-muted-foreground">
        Fill in one or both: the assistant uses the name in the customer&apos;s
        language when there is one.
      </p>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="duration">Duration (minutes)</Label>
          <Input
            key={`duration-${fields.duration}`}
            id="duration"
            name="duration"
            type="number"
            inputMode="numeric"
            min={5}
            max={720}
            step={5}
            defaultValue={fields.duration}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="buffer">Buffer after (minutes)</Label>
          <Input
            key={`buffer-${fields.buffer}`}
            id="buffer"
            name="buffer"
            type="number"
            inputMode="numeric"
            min={0}
            max={240}
            step={5}
            defaultValue={fields.buffer}
            aria-describedby="buffer-hint"
          />
          <p id="buffer-hint" className="text-caption text-muted-foreground">
            Kept free after each appointment, to clean up or reset a room.
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-2">
          <Label htmlFor="price">Price</Label>
          <Input
            key={`price-${fields.price}`}
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={fields.price}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency">Currency</Label>
          <NativeSelect
            key={`currency-${fields.currency}`}
            id="currency"
            name="currency"
            defaultValue={fields.currency}
          >
            {currencies.map((currency) => (
              <NativeSelectOption key={currency} value={currency}>
                {currency}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      {state.error && <FormError>{state.error}</FormError>}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="justify-self-start"
      >
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
