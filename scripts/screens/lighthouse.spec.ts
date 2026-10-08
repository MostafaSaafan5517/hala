import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "@playwright/test";
import { demoConfig } from "@/config/demo";
import { frontDesk, outDir, resetDemo, staffPage } from "./support";

// Lighthouse scores for the pages the redesign must not make worse, at Lighthouse's mobile and
// desktop settings, against the production build this config serves. Each page is measured three
// times and the median kept, since a single run moves by several points. Written to
// <SCREENS_DIR>/lighthouse.json. Only with LIGHTHOUSE=1: Lighthouse starts the installed Chrome
// itself, which works from a normal terminal but not from a sandboxed one.

const pages = [
  { name: "demo", path: "/demo", signedIn: false },
  { name: "widget", path: `/widget/${demoConfig.slug}`, signedIn: false },
  { name: "login", path: "/login", signedIn: false },
  {
    name: "inbox",
    path: `/dashboard/b/${demoConfig.slug}/inbox`,
    signedIn: true,
  },
];
const runs = 3;

type Report = {
  categories: Record<string, { score: number }>;
  audits: Record<string, { numericValue?: number }>;
};

function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

test("lighthouse: demo, widget, sign-in and inbox", async ({
  browser,
  request,
}, testInfo) => {
  test.skip(!process.env.LIGHTHOUSE, "Set LIGHTHOUSE=1 to measure.");
  test.skip(testInfo.project.name !== "desktop", "Lighthouse sets its sizes.");
  test.setTimeout(30 * 60_000);
  await resetDemo(request);

  // The inbox needs a signed-in member: Lighthouse sends their session cookies, from a file so
  // they never appear in a command line.
  const staff = await staffPage(browser, frontDesk);
  const cookies = await staff.context().cookies();
  await staff.context().close();
  const work = mkdtempSync(path.join(tmpdir(), "hala-lighthouse-"));
  const headersFile = path.join(work, "headers.json");
  writeFileSync(
    headersFile,
    JSON.stringify({
      Cookie: cookies.map(({ name, value }) => `${name}=${value}`).join("; "),
    }),
  );

  const baseURL = testInfo.project.use.baseURL!;
  const results: Record<string, Record<string, number>> = {};
  for (const page of pages) {
    for (const formFactor of ["mobile", "desktop"] as const) {
      const reports: Report[] = [];
      for (let run = 0; run < runs; run += 1) {
        const output = path.join(
          work,
          `${page.name}-${formFactor}-${run}.json`,
        );
        const lighthouse = spawnSync(
          "pnpm",
          [
            "dlx",
            "lighthouse@13.5.0",
            `${baseURL}${page.path}`,
            "--output=json",
            `--output-path=${output}`,
            "--quiet",
            "--chrome-flags=--headless=new",
            "--only-categories=performance,accessibility,best-practices,seo",
            ...(formFactor === "desktop" ? ["--preset=desktop"] : []),
            ...(page.signedIn ? [`--extra-headers=${headersFile}`] : []),
          ],
          { shell: true, encoding: "utf8", timeout: 180_000 },
        );
        if (lighthouse.status !== 0) {
          throw new Error(
            `Lighthouse failed on ${page.path}: ${lighthouse.stderr}`,
          );
        }
        reports.push(JSON.parse(readFileSync(output, "utf8")) as Report);
      }
      const score = (category: string) =>
        median(
          reports.map((report) =>
            Math.round(report.categories[category]!.score * 100),
          ),
        );
      const metric = (audit: string) =>
        median(
          reports.map((report) => report.audits[audit]?.numericValue ?? 0),
        );
      results[`${page.name}-${formFactor}`] = {
        performance: score("performance"),
        accessibility: score("accessibility"),
        bestPractices: score("best-practices"),
        seo: score("seo"),
        firstContentfulPaintMs: Math.round(metric("first-contentful-paint")),
        largestContentfulPaintMs: Math.round(
          metric("largest-contentful-paint"),
        ),
        totalBlockingTimeMs: Math.round(metric("total-blocking-time")),
        cumulativeLayoutShift: Number(
          metric("cumulative-layout-shift").toFixed(3),
        ),
      };
    }
  }
  writeFileSync(
    path.join(outDir, "lighthouse.json"),
    `${JSON.stringify(results, null, 2)}\n`,
  );
});
