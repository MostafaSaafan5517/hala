import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/demo/reset/route";

vi.mock("@/lib/demo/setup", () => ({
  setUpDemo: vi.fn(async () => ({ created: false })),
}));

function call(authorization?: string) {
  return GET(
    new Request("http://localhost/api/demo/reset", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the demo's nightly job", () => {
  it("doesn't exist unless the deployment enables the demo and has a cron secret", async () => {
    vi.stubEnv("DEMO_ENABLED", "");
    vi.stubEnv("CRON_SECRET", "a-long-cron-secret");
    expect((await call("Bearer a-long-cron-secret")).status).toBe(404);
    vi.stubEnv("DEMO_ENABLED", "1");
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(404);
  });

  it("runs only for the cron's secret", async () => {
    vi.stubEnv("DEMO_ENABLED", "1");
    vi.stubEnv("CRON_SECRET", "a-long-cron-secret");
    expect((await call()).status).toBe(401);
    expect((await call("Bearer a-long-cron-secreT")).status).toBe(401);
    expect((await call("Bearer a-long-cron-secret-and-more")).status).toBe(401);
    const response = await call("Bearer a-long-cron-secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: false });
  });
});
