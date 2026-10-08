"use client";

import { useActionState } from "react";
import type { StaffFormState } from "@/app/(app)/dashboard/b/[slug]/staff/actions";
import { ServiceName } from "@/components/service-name";
import { FormError } from "@/components/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ServiceOption = {
  id: string;
  name_en: string | null;
  name_ar: string | null;
  active: boolean;
};

/** Adds a staff member or edits one: their name and the services they perform. */
export function StaffForm({
  action,
  initial,
  services,
  submitLabel,
  pendingLabel,
}: {
  action: (
    previous: StaffFormState,
    formData: FormData,
  ) => Promise<StaffFormState>;
  initial: StaffFormState["fields"];
  services: ServiceOption[];
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    fields: initial,
  });
  const chosen = new Set(state.fields.serviceIds);

  // The keys re-mount the fields with what the action returned, after React resets the form.
  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          key={`name-${state.fields.name}`}
          id="name"
          name="name"
          dir="auto"
          defaultValue={state.fields.name}
          maxLength={80}
          required
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-small font-medium">
          Services they perform
        </legend>
        {services.length === 0 ? (
          <p className="text-small text-secondary-foreground">
            No services yet. Add some on the Services tab, then come back.
          </p>
        ) : (
          services.map((service) => (
            <label
              key={`${service.id}-${chosen.has(service.id)}`}
              className="flex min-h-10 items-center gap-2.5 rounded-control px-2 hover:bg-muted"
            >
              <input
                type="checkbox"
                name="serviceIds"
                value={service.id}
                defaultChecked={chosen.has(service.id)}
                className="size-4 accent-primary"
              />
              <ServiceName service={service} />
              {!service.active && (
                <span className="text-caption text-muted-foreground">
                  (archived)
                </span>
              )}
            </label>
          ))
        )}
      </fieldset>
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
