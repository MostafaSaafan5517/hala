"use client";

import { useActionState } from "react";
import type { SettingsFormState } from "@/app/(app)/dashboard/b/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  CANCELLATION_HOURS,
  describeCancellation,
  describeNotice,
  describeSlotInterval,
  NOTICE_MINUTES,
  SLOT_INTERVALS,
} from "@/lib/booking-rules";
import { type Language, languageNames } from "@/lib/languages";

type SettingsAction = (
  previous: SettingsFormState,
  formData: FormData,
) => Promise<SettingsFormState>;

const initialState: SettingsFormState = { error: null, saved: false };

function Feedback({
  state,
  pending,
  label,
}: {
  state: SettingsFormState;
  pending: boolean;
  label: string;
}) {
  return (
    <>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : (
        state.saved && (
          <p role="status" className="text-sm text-muted-foreground">
            Saved.
          </p>
        )
      )}
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving..." : label}
        </Button>
      </div>
    </>
  );
}

export function DetailsForm({
  action,
  details,
  timeZones,
}: {
  action: SettingsAction;
  details: { name: string; timezone: string; defaultLanguage: Language };
  timeZones: string[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Business name</Label>
        <Input
          key={details.name}
          id="name"
          name="name"
          defaultValue={details.name}
          maxLength={100}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="timezone">Time zone</Label>
          <NativeSelect
            key={details.timezone}
            id="timezone"
            name="timezone"
            defaultValue={details.timezone}
            className="w-full"
          >
            {timeZones.map((zone) => (
              <NativeSelectOption key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="defaultLanguage">
            Assistant&apos;s first language
          </Label>
          <NativeSelect
            key={details.defaultLanguage}
            id="defaultLanguage"
            name="defaultLanguage"
            defaultValue={details.defaultLanguage}
            className="w-full"
          >
            {Object.entries(languageNames).map(([code, label]) => (
              <NativeSelectOption key={code} value={code} lang={code}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <Feedback state={state} pending={pending} label="Save details" />
    </form>
  );
}

export function RulesForm({
  action,
  rules,
}: {
  action: SettingsAction;
  rules: {
    noticeMinutes: number;
    horizonDays: number;
    slotInterval: number;
    cancellationHours: number;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form
      key={JSON.stringify(rules)}
      action={formAction}
      className="grid gap-4 rounded-lg border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="noticeMinutes">Book how soon</Label>
          <NativeSelect
            id="noticeMinutes"
            name="noticeMinutes"
            defaultValue={rules.noticeMinutes}
            className="w-full"
          >
            {NOTICE_MINUTES.map((minutes) => (
              <NativeSelectOption key={minutes} value={minutes}>
                {describeNotice(minutes)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="horizonDays">Book how far ahead (days)</Label>
          <Input
            id="horizonDays"
            name="horizonDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            defaultValue={rules.horizonDays}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="slotInterval">Appointments start</Label>
          <NativeSelect
            id="slotInterval"
            name="slotInterval"
            defaultValue={rules.slotInterval}
            className="w-full"
          >
            {SLOT_INTERVALS.map((minutes) => (
              <NativeSelectOption key={minutes} value={minutes}>
                {describeSlotInterval(minutes)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cancellationHours">Cancel or move a booking</Label>
          <NativeSelect
            id="cancellationHours"
            name="cancellationHours"
            defaultValue={rules.cancellationHours}
            className="w-full"
          >
            {CANCELLATION_HOURS.map((hours) => (
              <NativeSelectOption key={hours} value={hours}>
                {describeCancellation(hours)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <Feedback state={state} pending={pending} label="Save rules" />
    </form>
  );
}
