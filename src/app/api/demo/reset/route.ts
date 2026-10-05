import { timingSafeEqual } from "node:crypto";
import { demoEnabled } from "@/config/demo";
import { setUpDemo } from "@/lib/demo/setup";

// Sets the public demo up, and clears what visitors left in it: Vercel's cron calls this every
// night with `Authorization: Bearer <CRON_SECRET>`. Only on a deployment with DEMO_ENABLED=1;
// anywhere else, and without the secret, it doesn't exist.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!demoEnabled() || !secret) return new Response(null, { status: 404 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return Response.json(await setUpDemo());
  } catch (error) {
    console.error("Setting up the demo failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return Response.json(
      { error: "Setting up the demo failed." },
      { status: 500 },
    );
  }
}
