/** How long an invite link works: the database's default for `member_invites.expires_at`. */
export const INVITE_LIFETIME_DAYS = 7;

/** Whether an invite can still be used: nobody has used it and it hasn't expired. */
export function isPending(
  invite: { accepted_at: string | null; expires_at: string },
  nowMs = Date.now(),
) {
  return invite.accepted_at === null && Date.parse(invite.expires_at) > nowMs;
}
