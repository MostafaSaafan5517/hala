# Redesign results

Step 7 of the redesign: the same checks as before it started, run again on the finished work. The [audit](audit.md) recorded the starting point on 2026-10-06; everything below the "after" headings was measured on 2026-10-08, on the same machine, from the production build.

## Screens

[`before/index.md`](before/index.md) and [`after/index.md`](after/index.md) show the same 59 screens and states, at desktop (1440 wide) and phone (390 wide) sizes, captured by the same script (`scripts/screens/screens.spec.ts`) with the offline models, so the conversations say the same things in both:

```bash
pnpm build
SCREENS_DIR=docs/design/after pnpm screens
```

## Accessibility

| Check                                   | Before                          | After                                     |
| --------------------------------------- | ------------------------------- | ----------------------------------------- |
| axe, WCAG 2.1 A and AA, desktop         | 0 findings on 42 pages          | 0 findings on 58 pages                    |
| axe, WCAG 2.1 A and AA, phone           | 0 findings on 42 pages          | 0 findings on 58 pages                    |
| axe with the device in dark mode        | not checked (there was no dark) | 0 findings on 20 pages                    |
| Lighthouse accessibility, widget        | 98                              | 100                                       |
| Lighthouse accessibility, other pages   | 100                             | 100                                       |
| Text contrast (computed for each token) | not checked                     | every pair at least 4.5:1, light and dark |

The widget's 98 was Lighthouse's "Document does not have a main landmark"; the chat is a `main` landmark now. The 16 extra axe pages are the widget's states, now checked inside their frame (axe's findings: [`after/axe-desktop.json`](after/axe-desktop.json), [`after/axe-mobile.json`](after/axe-mobile.json)). Contrast is computed by `src/styles/tokens.test.ts`, which fails if any text pair drops below AA. Automated checks catch roughly a third of accessibility problems; keyboard use and what a screen reader announces still need a person to try them.

**Reduced motion.** With `prefers-reduced-motion`, nothing moves: the widget panel opens without fading, new messages and the typing dots stand still, a pressed button no longer settles 1px, and a rule in `globals.css` stops any transition or animation a component forgets to guard. Checked in Chromium both ways: a pressed button moves 1px and transitions take 120ms with motion allowed, and neither happens with it reduced.

## Lighthouse

`LIGHTHOUSE=1 SCREENS_DIR=… pnpm screens -g lighthouse --project desktop`: Lighthouse 13.5.0 with the installed Chrome, each page three times and the median kept, at Lighthouse's phone settings (a slow 4G connection and a 4x slower processor) and its desktop settings. The full numbers are in [`before/lighthouse.json`](before/lighthouse.json) and [`after/lighthouse.json`](after/lighthouse.json).

| Page             | Performance | Accessibility | Largest paint   | Blocking time | Layout shift |
| ---------------- | ----------- | ------------- | --------------- | ------------- | ------------ |
| Demo, phone      | 78 → 90     | 100 → 100     | 3.85 s → 2.70 s | 305 → 254 ms  | 0 → 0        |
| Demo, desktop    | 100 → 100   | 100 → 100     | 0.77 s → 0.67 s | 14 → 25 ms    | 0 → 0        |
| Widget, phone    | 77 → 78     | 98 → 100      | 4.01 s → 3.29 s | 492 → 568 ms  | 0 → 0        |
| Widget, desktop  | 99 → 100    | 98 → 100      | 0.84 s → 0.66 s | 47 → 56 ms    | 0 → 0        |
| Sign in, phone   | 83 → 86     | 100 → 100     | 3.79 s → 3.09 s | 268 → 322 ms  | 0 → 0        |
| Sign in, desktop | 100 → 100   | 100 → 100     | 0.74 s → 0.68 s | 28 → 9 ms     | 0 → 0        |
| Inbox, phone     | 89 → 91     | 100 → 100     | 3.54 s → 3.19 s | 128 → 166 ms  | 0 → 0        |
| Inbox, desktop   | 99 → 100    | 100 → 100     | 0.88 s → 0.67 s | 52 → 8 ms     | 0 → 0        |

Best practices and SEO are 100 everywhere, before and after.

**Read with care.** Two days apart, the same machine was in a different state, and Lighthouse's phone scores move by several points from run to run. The higher "after" scores are mostly that, not the redesign: the demo page's 78 → 90, for example, came out as 95 for the old page and 94 for the new one when the two were measured alternately in Step 5. So the claim is "no regression", and it's tested the fairer way below.

**Measured side by side.** `main` (the site before the redesign) and the redesign, both production builds on one machine against one database, measured alternately: five Lighthouse runs each per page at phone settings, medians shown.

| Page    | Performance | Accessibility | Largest paint   | Blocking time | Layout shift |
| ------- | ----------- | ------------- | --------------- | ------------- | ------------ |
| Demo    | 84 → 89     | 100 → 100     | 3.66 s → 2.59 s | 212 → 347 ms  | 0 → 0        |
| Widget  | 69 → 72     | 98 → 100      | 4.06 s → 3.27 s | 647 → 966 ms  | 0 → 0        |
| Sign in | 86 → 89     | 100 → 100     | 3.77 s → 3.12 s | 205 → 216 ms  | 0 → 0        |
| Inbox   | 89 → 93     | 100 → 100     | 3.46 s → 2.86 s | 146 → 166 ms  | 0 → 0        |

Every score is level or higher, and the largest paint comes 0.5 to 1.1 s sooner on every page. Blocking time is the exception that needed a closer look, since the widget's rose by half.

- **The widget's** five runs overlap widely (499 to 903 ms for `main`, 617 to 1,529 ms for the redesign), and its median is pulled up by two slow runs. The extra time sits in the React runtime, a file that is byte for byte the same in both builds.
- **The demo's** extra time is style and layout: the page has about twice the old one's text, laid out again when the font arrives (the trade-off accepted in Step 5).

So blocking was measured directly as well: 20 alternating loads of each page in Chromium with the processor slowed 4x, adding up every long task's time over 50 ms. The redesign blocked less on both pages, and less in 14 of the 20 pairs on each:

| Page   | `main`, median | Redesign, median | Middle half, `main` | Middle half, redesign |
| ------ | -------------- | ---------------- | ------------------- | --------------------- |
| Widget | 1,488 ms       | 1,193 ms         | 1,145 to 1,984 ms   | 1,072 to 1,683 ms     |
| Demo   | 550 ms         | 497 ms           | 487 to 779 ms       | 440 to 673 ms         |

Lighthouse simulates a slow connection and reorders the work accordingly, so its blocking time can differ from what the processor actually does; the two measures together say the redesign doesn't make these pages slower to respond.

## Size budget

The widget is what a business puts on its own website, so its weight had a hard limit: at most 10% more than before the redesign.

| What                                 | Before        | After         | Limit         |
| ------------------------------------ | ------------- | ------------- | ------------- |
| Embed script (`public/widget.js`)    | 2,652 bytes   | 2,833 bytes   | 2,917 bytes   |
| Embed script, gzipped                | 1,161 bytes   | 1,338 bytes   |               |
| The chat frame's JavaScript, as sent | 294,028 bytes | 302,926 bytes | 323,430 bytes |

Both are inside the limit: the embed script is 6.8% larger and the chat frame's JavaScript 3.0%. The embed script grew because it now lays the widget out full screen on phones, gives the chat a close button there, and fades the panel in; to fit the budget it's now minified from a readable source (`src/embed/widget.js`, `pnpm widget`), which also means it compresses less well: gzipped, it's 15% larger, which the byte limit doesn't measure. A unit test fails the build when the script is stale or over its limit. Data: [`before/widget-size.json`](before/widget-size.json), [`after/widget-size.json`](after/widget-size.json).

The 404 page shows why the frame is measured, not assumed: its first version used `next/link`, and because the app's 404 belongs to every page's bundle, that added 6,885 bytes of navigation code to the chat frame. It uses plain links now.

## Tests

No behavior changed, and every suite passes on the finished work: 164 unit tests, 60 end-to-end tests (with axe on the pages they visit), 482 database tests (pgTAP), 6 concurrency tests and 33 integration tests, plus typecheck, lint and formatting. Where a test's words changed with the design (a hyphen in a time range, a message that became a heading), the commit that changed it says why; no selector was loosened to make a test pass.

## Not done in this pass

The audit's [proposals](audit.md#proposals-they-change-behavior-so-theyre-not-part-of-this-pass) change behavior, so they wait for their own work: an Arabic dashboard, an Arabic business name, a launcher that knows the business's language, suggested questions in an empty chat, a structured booking confirmation (which would also fix the Arabic punctuation in it), and date and time pickers that match the app.
