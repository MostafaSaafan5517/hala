"use client";

import { useActionState } from "react";
import type { AddFormState } from "@/app/(app)/dashboard/b/[slug]/time-off/actions";
import { FormDone, FormError } from "@/components/form-feedback";
import { surface } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

type AddAction = (
  previous: AddFormState,
  formData: FormData,
) => Promise<AddFormState>;

const initialState: AddFormState = { error: null, added: 0 };

function Feedback({ state, noun }: { state: AddFormState; noun: string }) {
  if (state.error) return <FormError>{state.error}</FormError>;
  return state.added > 0 ? <FormDone>{noun} added.</FormDone> : null;
}

export function ClosureForm({ action }: { action: AddAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={`${surface} grid gap-4 p-5 sm:p-6`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="startsOn">First day</Label>
          <Input id="startsOn" name="startsOn" type="date" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="endsOn">Last day</Label>
          <Input id="endsOn" name="endsOn" type="date" required />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="closureReason">Reason (optional)</Label>
        <Input
          id="closureReason"
          name="reason"
          dir="auto"
          maxLength={200}
          placeholder="Eid al-Fitr"
        />
      </div>
      <Feedback state={state} noun="Closure" />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Adding..." : "Add closure"}
        </Button>
      </div>
    </form>
  );
}

export function TimeOffForm({
  action,
  staff,
}: {
  action: AddAction;
  staff: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  if (staff.length === 0) {
    return (
      <p className="text-secondary-foreground">
        Add staff on the Staff tab first.
      </p>
    );
  }

  return (
    <form action={formAction} className={`${surface} grid gap-4 p-5 sm:p-6`}>
      <div className="grid gap-2">
        <Label htmlFor="staffId">Staff member</Label>
        <NativeSelect id="staffId" name="staffId" className="w-full">
          {staff.map((person) => (
            <NativeSelectOption key={person.id} value={person.id} dir="auto">
              {person.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="startsAt">From</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            step={300}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="endsAt">Until</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            step={300}
            required
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="timeOffReason">Reason (optional)</Label>
        <Input
          id="timeOffReason"
          name="reason"
          dir="auto"
          maxLength={200}
          placeholder="Annual leave"
        />
      </div>
      <Feedback state={state} noun="Time off" />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Adding..." : "Add time off"}
        </Button>
      </div>
    </form>
  );
}
