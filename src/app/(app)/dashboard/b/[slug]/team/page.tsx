import { Crown, IdentificationBadge, User } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import {
  createInvite,
  removeFromTeam,
  revokeInvite,
  setMemberRole,
} from "@/app/(app)/dashboard/b/[slug]/team/actions";
import { InviteForm } from "@/app/(app)/dashboard/b/[slug]/team/invite-form";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/badge";
import { SectionHeader } from "@/components/section-header";
import { surface, surfaceList, surfaceRow } from "@/components/surface";
import { requireMemberBusiness, roleLabels } from "@/lib/business";
import { formatDay } from "@/lib/dates";
import { INVITE_LIFETIME_DAYS, isPending } from "@/lib/invites";

export const metadata: Metadata = { title: "Team" };

const roleIcons = {
  owner: <Crown aria-hidden="true" />,
  admin: <IdentificationBadge aria-hidden="true" />,
  staff: <User aria-hidden="true" />,
};

export default async function TeamPage({
  params,
}: PageProps<"/dashboard/b/[slug]/team">) {
  const { slug } = await params;
  const { supabase, userId, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/team`,
  );
  const canInvite = role !== "staff";

  // Through RLS as the user: members see their colleagues and their profiles; only owners and
  // admins see invites (and never their token hashes).
  const [{ data: team, error }, { data: invites, error: invitesError }] =
    await Promise.all([
      supabase
        .from("business_members")
        .select("user_id, role, created_at, profiles (full_name, email)")
        .eq("business_id", business.id)
        .order("role")
        .order("created_at"),
      canInvite
        ? supabase
            .from("member_invites")
            .select("id, role, created_at, expires_at, accepted_at")
            .eq("business_id", business.id)
            .is("accepted_at", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (error) throw new Error(`Could not load the team: ${error.message}`);
  if (invitesError) {
    throw new Error(`Could not load invites: ${invitesError.message}`);
  }
  const openInvites = invites.filter((invite) => isPending(invite));

  return (
    <>
      <BusinessHeader business={business} role={role} current="team" />

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="grid gap-4" aria-labelledby="team-heading">
          <SectionHeader
            id="team-heading"
            title="Team"
            description="Everyone who can sign in to this business, and what they can do."
          />
          <ul className={surfaceList}>
            {team.map((person) => {
              const isYou = person.user_id === userId;
              // What the viewer may do to this person, mirroring the business_members policies.
              const canChangeRole = role === "owner" && person.role !== "owner";
              const canRemove =
                !isYou &&
                person.role !== "owner" &&
                (role === "owner" ||
                  (role === "admin" && person.role === "staff"));
              const canLeave = isYou && person.role !== "owner";
              return (
                <li
                  key={person.user_id}
                  className={`${surfaceRow} grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center`}
                >
                  <div className="grid min-w-0 gap-1">
                    <span className="font-medium">
                      {person.profiles.full_name ?? person.profiles.email}
                      {isYou && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </span>
                    {person.profiles.full_name && (
                      <span className="text-small wrap-anywhere text-muted-foreground">
                        {person.profiles.email}
                      </span>
                    )}
                    <p className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={person.role === "owner" ? "accent" : "neutral"}
                        icon={roleIcons[person.role]}
                      >
                        {roleLabels[person.role]}
                      </Badge>
                      <span className="text-caption text-muted-foreground">
                        Since {formatDay(person.created_at.slice(0, 10))}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canChangeRole && (
                      <ActionButton
                        action={setMemberRole.bind(
                          null,
                          business.slug,
                          person.user_id,
                          person.role === "admin" ? "staff" : "admin",
                        )}
                        label={
                          person.role === "admin" ? "Make staff" : "Make admin"
                        }
                        pendingLabel="Changing..."
                        variant="outline"
                        size="sm"
                      />
                    )}
                    {canRemove && (
                      <ActionButton
                        action={removeFromTeam.bind(
                          null,
                          business.slug,
                          person.user_id,
                        )}
                        label="Remove"
                        pendingLabel="Removing..."
                        variant="destructive"
                        size="sm"
                      />
                    )}
                    {canLeave && (
                      <ActionButton
                        action={removeFromTeam.bind(
                          null,
                          business.slug,
                          person.user_id,
                        )}
                        label="Leave this business"
                        pendingLabel="Leaving..."
                        variant="destructive"
                        size="sm"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {canInvite && (
          <div className="grid gap-10">
            <section
              className={`${surface} grid gap-4 p-5 sm:p-6`}
              aria-labelledby="invite-heading"
            >
              <div className="grid gap-1">
                <h2 id="invite-heading" className="text-h3">
                  Invite someone
                </h2>
                <p className="text-small text-secondary-foreground">
                  Create a link and send it to them. They sign in (or sign up),
                  open it, and join with the role you chose.
                </p>
              </div>
              <InviteForm
                action={createInvite.bind(null, business.slug)}
                roles={role === "owner" ? ["staff", "admin"] : ["staff"]}
                lifetimeDays={INVITE_LIFETIME_DAYS}
              />
            </section>

            {openInvites.length > 0 && (
              <section
                className="grid gap-4"
                aria-labelledby="open-invites-heading"
              >
                <h2 id="open-invites-heading" className="text-h3">
                  Open invites
                </h2>
                <ul className={surfaceList}>
                  {openInvites.map((invite) => (
                    <li
                      key={invite.id}
                      className={`${surfaceRow} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3`}
                    >
                      <div className="grid gap-1">
                        <span className="font-medium">
                          Invite for a new {invite.role}
                        </span>
                        <span className="text-small text-muted-foreground">
                          Created {formatDay(invite.created_at.slice(0, 10))},
                          works until{" "}
                          {formatDay(invite.expires_at.slice(0, 10))}
                        </span>
                      </div>
                      {(role === "owner" || invite.role === "staff") && (
                        <ActionButton
                          action={revokeInvite.bind(
                            null,
                            business.slug,
                            invite.id,
                          )}
                          label="Revoke"
                          pendingLabel="Revoking..."
                          variant="destructive"
                          size="sm"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
}
