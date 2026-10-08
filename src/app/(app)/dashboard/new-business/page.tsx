import type { Metadata } from "next";
import { NewBusinessForm } from "@/app/(app)/dashboard/new-business/new-business-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { timeZoneOptions } from "@/lib/time-zones";

export const metadata: Metadata = { title: "Create a business" };

export default async function NewBusinessPage() {
  await requireUser("/dashboard/new-business");

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle as="h1">Create a business</CardTitle>
        <CardDescription>
          You&apos;ll be its owner. Next you&apos;ll add your services, staff
          and opening hours.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewBusinessForm timeZones={timeZoneOptions()} />
      </CardContent>
    </Card>
  );
}
