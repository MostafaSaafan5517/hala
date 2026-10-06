# Design audit: Hala before the redesign

Step 1 of the UI redesign: what the interface looks like today, what reads as generic, what's inconsistent, what's missing for Arabic and accessibility, and what's worth keeping. No code was changed for this audit.

**The screens.** [`before/index.md`](before/index.md) shows every screen and state, at desktop (1440 wide) and mobile (390 wide): 59 screens, 118 images. They were captured on 2026-10-06 from the production build with the offline models, so the conversation states are reproducible and identical between the "before" and "after" runs:

```bash
pnpm build
SCREENS_DIR=docs/design/before pnpm screens
```

`scripts/screens/screens.spec.ts` resets the demo salon, then walks the widget (English and Arabic: closed, open, an answer, the confirmation card, booked, network error, waiting for the team, the team replying, closed, budget spent, too many conversations, unknown business), the demo page, the public and sign-in pages, every dashboard page as a member of the demo salon, the read-only demo owner, and the empty states of a business that hasn't been set up.

## The read in one paragraph

Hala is clean, consistent and accessible, and it has no identity. It wears shadcn/ui's neutral starter theme almost unchanged: every gray has zero color, the primary color is near-black, the font is Geist, most corners are 10px, and a 1px border separates everything from everything. Nothing says "welcome", nothing feels like a salon or clinic front desk in Riyadh or Cairo, and, as your brief says, it shares Clubly's minimal black-and-white look. The widget, the part customers actually see, is the plainest of all: a white panel with gray text, a black pill as its button, and a booking confirmation that looks like a disabled form field.

## Worth keeping

- **Restraint and consistency.** One type family per script, one radius scale, one spacing rhythm, no visual noise. The redesign should keep this calm and replace the defaults, not add decoration.
- **The words.** Plain, specific and helpful: empty states say what to do next ("Add what customers can book: each one with how long it takes and what it costs"), times say their zone ("Times are in Asia/Riyadh time"), errors say what happened. No exclamation marks or filler.
- **RTL foundations.** No physical left/right classes anywhere in `src/` (logical properties throughout), Arabic text always carries `lang="ar"` and `dir`, the Arabic font is applied by `:lang(ar)`, the widget mirrors fully in Arabic, and the primary action comes first in reading order in both directions.
- **Numerals.** Western digits in both languages for prices, times, dates and phone numbers (deliberate: `ar-u-nu-latn`), which matches how Gulf businesses write them. Keep it, and keep it consistent.
- **Accessibility basics.** axe finds nothing on any of the 42 pages it checked, at either size (84 checks). Landmarks, labelled fields, a `role="log"` chat, `role="status"` and `role="alert"` regions, `aria-current` on tabs, focus that's visible (if faint, see below).
- **Data honesty.** Tables show every value, with tabular figures in bookings and usage.

## What reads as generic or templated

1. **The palette is the starter theme.** Grays from `oklch(1 0 0)` to `oklch(0.145 0 0)` with no hue; primary near-black; the only colors are the chart's blue (`#2a78d6`) and the destructive red. This is the main source of the black-and-white look Hala shares with Clubly.
2. **Default type.** Geist for Latin (Vercel's default) and IBM Plex Sans Arabic for Arabic, both fine faces, both chosen by default rather than for the product; one size scale for both scripts.
3. **A border around everything.** Lists (services, staff, bookings, knowledge), status notes, empty states, stat tiles, and every message in the inbox transcript are 1px-bordered boxes. Beyond headings and spacing, hierarchy comes from borders, almost never from surface or tone.
4. **The KPI row.** Usage opens with four equal stat tiles, the most common dashboard pattern there is.
5. **Unfinished edges.** Next.js's default 404 ("404 | This page could not be found.", also inside the widget for an unknown business) and default favicon; a home page that is a centered title and two buttons; sign-in as a small bordered card adrift in a white page.
6. **The demo salon page doesn't look like a salon's website.** It's a white document: a heading, a paragraph, four bordered rows and a note. No hierarchy, no warmth, nothing a real salon would put up. It's the first thing a client sees from the portfolio.
7. **The launcher.** A black pill in the system font (not the app's), with "Chat with us" and no icon. It could belong to any site.
8. **One narrow column everywhere.** Every dashboard page is a 720px column, even at 1440 wide, so half the screen is empty while Usage's ten-column tables wrap their headers onto two lines and the inbox stacks the customer card above the transcript instead of beside it.

## The widget (what customers see)

- **Mobile opens as a floating panel, not full screen.** At 390 wide the 600px panel leaves the top of the salon's page showing above it and stops 88px short of the bottom, where the launcher sits over the page. The embed script's styles decide this, so it can change in Step 4 without behavior changes.
- **No sense of who's answering.** The header is "Chat with Nour Salon" and a language button: no mark, initial or color of the business, nothing that says this is the salon's own front desk.
- **Three message treatments, none of them "the salon".** Assistant replies are bare text, the customer's are gray bubbles, staff replies are bordered boxes with a small label.
- **Process lines read as noise.** "Looked it up", "Checked the business's details", "Checked availability" are 12px gray lines between messages; sources are a run-on 12px line ("Sources: [1] Cancellation policy, [2] …").
- **The booking confirmation is the weakest screen and the most important.** Service, date, time, price, name and phone arrive as one sentence in a thin bordered box with two 28px buttons. It should be the clearest thing in the chat. (Its wording comes from the server; see the proposals for making it structured.)
- **The composer takes a quarter of the panel.** A visible "Message" label, a two-row textarea and Send on its own row: about 160px of the 600px panel.
- **Empty and state messages are the same faint line.** The empty chat is one gray sentence in a large white panel; "Replying...", waiting for the team, "You're chatting with the team" and errors are all a 12px line above the composer (errors in red).
- **The launcher doesn't follow the business's language.** It sits on the right unless the website adds `data-language="ar"`, and its label is English ("Chat") unless the website sets `data-label`: the embed script doesn't know the business's language (see proposals).

## Arabic and right-to-left

- **Arabic is set like Latin.** Same 14px size and line height as English; Arabic needs a slightly larger size (about 1.1x) and more line height (about 1.7) to read comfortably, and its weights stop at 600.
- **A Latin comma in Arabic.** The widget's sources are separated by ", " in both languages; Arabic uses "، ".
- **Mixed names.** The header reads "تحدّث مع Nour Salon": businesses have no Arabic name to show (see proposals).
- **Cluttered punctuation in the Arabic confirmation.** "120.00 ر.س.،" stacks the currency's period and the Arabic comma; this text is generated on the server (see proposals).
- **The frame starts in English.** Its `<html>` is `lang="en" dir="ltr"` until the widget's script runs, even for an Arabic chat (the chat itself is marked correctly from the first paint).
- **The dashboard is English-only.** Arabic appears only in content (service names, Arabic FAQs, Arabic conversations); an Arabic dashboard would be a new feature (see proposals).

## Accessibility beyond axe

- **Faint focus ring.** A 3px ring at 50% of a mid gray, roughly 1.5:1 against white; WCAG's non-text contrast asks 3:1 of the indicators that show a control's state.
- **Small touch targets.** Default buttons are 32px tall and small ones 28px, including the widget's Confirm, Not now and close buttons, which customers tap on phones (44px is the comfortable size).
- **No reduced-motion handling.** There's almost no motion today; the redesign must add `prefers-reduced-motion` handling with any motion it adds.
- **No skip link.** Keyboard users pass the header and twelve tabs on every dashboard page before the content.
- **The widget has no `main` landmark.** Screen reader users can't jump straight to the chat (Lighthouse's only accessibility finding, on the widget's page).
- **Small gray text carries meaning.** Muted text (`#737373`, 4.7:1) passes AA, but at 12px it carries the widget's status lines, sources and errors.
- **Dates and times disagree.** The app writes "Wed, 7 Oct 2026" and 24-hour times, while the browser's native date and time inputs show "10/07/2026" and "10:00 AM" in an English (US) browser: they follow the browser's locale.

## Inconsistencies

- **Three "choose one" controls:** the business tabs (filled muted pill), Usage's period (black filled button), and Hours' person switch (outlined round pill).
- **Two type families on one page:** the launcher uses the system font, the frame uses Geist.
- **Date formats:** "Wed 30 Sept" in Usage beside "Wed, 7 Oct 2026" in Bookings, and the native inputs above.
- **Message and card treatments:** bubble, no bubble and bordered box in the widget; bordered cards for every transcript message in the inbox.

## Baselines for "no regressions"

| Check                                      | Before                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| axe (WCAG 2.1 A/AA), 42 pages at each size | 0 findings on every page ([desktop](before/axe-desktop.json), [mobile](before/axe-mobile.json)) |
| Embed script (`public/widget.js`)          | 2,652 bytes (1,161 gzipped): limit after the redesign 2,917 bytes                               |
| Chat frame JavaScript (`/widget/[slug]`)   | 11 files, 294,028 bytes as sent: limit after the redesign 323,430 bytes                         |
| Lighthouse                                 | See the table below ([`before/lighthouse.json`](before/lighthouse.json))                        |

**Lighthouse, before.** The median of three runs per page, against the local production build (`LIGHTHOUSE=1`, run from a normal terminal: Lighthouse can't start Chrome from a sandboxed shell). Performance is the score most affected by the machine, so compare it only between runs on the same machine; the mobile numbers use Lighthouse's simulated slow phone.

| Page              | Performance (mobile / desktop) | Accessibility | Best practices | SEO       | Largest paint, mobile |
| ----------------- | ------------------------------ | ------------- | -------------- | --------- | --------------------- |
| Demo salon page   | 78 / 100                       | 100 / 100     | 100 / 100      | 100 / 100 | 3.8 s                 |
| Widget frame      | 77 / 99                        | 98 / 98       | 100 / 100      | 100 / 100 | 4.0 s                 |
| Sign in           | 83 / 100                       | 100 / 100     | 100 / 100      | 100 / 100 | 3.8 s                 |
| Inbox (signed in) | 89 / 99                        | 100 / 100     | 100 / 100      | 100 / 100 | 3.5 s                 |

No page shifts its layout while loading (cumulative layout shift 0 everywhere). The widget's 98 is one finding: its page has no `main` landmark.

## Proposals (they change behavior, so they're not part of this pass)

1. **An Arabic dashboard.** Translate the staff interface and let each member choose a language.
2. **An Arabic business name.** A `name_ar` for businesses, shown in the Arabic widget's header and on the demo page.
3. **A launcher that knows the business's language.** The embed script would read the business's default language (one small request, or the server writing it into the script) to choose its side and label.
4. **Suggested questions in an empty chat.** A few tappable starters ("Opening hours", "Book an appointment"); they would send a message, which is new interaction.
5. **A structured confirmation.** The server would send the booking's fields (service, day, time, staff, price) alongside the sentence, so the card can show them as a clear summary; it would also fix the Arabic punctuation.
6. **Date and time pickers that match the app.** 24-hour, locale-consistent pickers instead of the browser's native inputs.

## What the redesign should do first

In the redesign skill's order, adapted to a bilingual data app:

1. **Identity through tokens (Steps 2 and 3).** A warm, tinted neutral scale with one accent; a Latin and Arabic type pairing chosen together, with Arabic's own size and line height; a radius and elevation system that lets surfaces, not borders, carry hierarchy; a visible focus ring.
2. **The widget (Step 4).** Full screen on phones, a header with the business's identity, one coherent message system, process lines and sources that are quiet but legible, a confirmation card that is unmistakably the moment to decide, a compact composer, 44px touch targets, designed empty and state messages, a branded "not found", a `main` landmark, and a launcher in the same family. Within the size budget, no animation library.
3. **The demo page (Step 5).** A believable salon website built from the seeded data only (no invented reviews or numbers), designed to show the widget at its best.
4. **The dashboard (Step 6).** Wider layouts where data needs them (Usage tables, a two-column conversation view), surfaces instead of borders, one "choose one" control, composed empty states, a skip link, consistent date formats.
5. **Finish (Step 7).** Favicon, 404, reduced motion, then every suite, axe, Lighthouse and the size budget again.

Some of the redesign skill's advice doesn't apply here and won't be followed: stock or placeholder photos (the demo uses only honest content), invented testimonials or metrics, fonts without Arabic letters, or moving the dashboard to a sidebar for its own sake.
