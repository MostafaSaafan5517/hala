// The public demo: a salon anyone can try, on a deployment with DEMO_ENABLED=1. Its dashboard
// login is public on purpose (the account is read-only, so the database refuses its changes),
// and /api/demo/reset sets the salon up and clears what visitors left, nightly.
export const demoConfig = {
  slug: "nour-salon",
  email: "demo.owner@example.com",
  password: "demo-salon-2026",
} as const;

export function demoEnabled() {
  return process.env.DEMO_ENABLED === "1";
}
