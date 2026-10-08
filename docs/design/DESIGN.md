# Hala design system

**Status:** approved (step 2 of the redesign, after the [audit](audit.md)). Step 3 made it the app's tokens: [TOKENS.md](TOKENS.md) explains the files, the names used in code, and how another project uses them. Steps 4 to 6 apply it to the widget, the demo page and the dashboard.

**See it:** `pnpm dev`, then http://localhost:3100/design-preview (development only: a production build answers 404). Screenshots are in [`preview/`](preview/).

## The read

> Reading this as: a bilingual product (a chat that businesses embed on their websites, and a dashboard for their staff) for appointment businesses in the Gulf and Egypt, used by owners and staff at a desk and by their customers on phones, with a warm, calm, hospitable language, leaning toward the existing Tailwind v4 and shadcn/ui (Base UI) components re-themed through CSS-variable tokens, not a new component library.

**In one line:** a front desk that says welcome: warm stone, one deep teal for everything you can act on, and one typeface that speaks Arabic and English as equals.

**Dials** (from the taste skill, which is written for landing pages; the dashboard takes its calmer numbers):

| Surface                                       | Variance | Motion | Density |
| --------------------------------------------- | -------- | ------ | ------- |
| Widget                                        | 4        | 3      | 4       |
| Demo salon page and the future marketing site | 6        | 4      | 3       |
| Dashboard                                     | 3        | 2      | 5       |

**What it must not be:** Clubly's black and white (or any starter theme), AI purple, mesh gradients, a row of three identical cards, or the warm-paper-and-brass look every "premium" site wears.

## Color

One family of **stone** neutrals (a trace of warmth: hue 65 to 75, chroma at most 0.012), one **teal** accent, and three status colors that only ever mean status.

**Why teal.** It is calm and trustworthy (clinics), fresh (salons, studios), at home in the region's visual culture (the Gulf's water, tilework), and far from both Clubly's black and white and the purple of AI products. In light mode it carries white text at 5.6:1.

| Token                          | Light (OKLCH)                 | Light hex | Dark (OKLCH)                  | Dark hex  | Used for                                                 |
| ------------------------------ | ----------------------------- | --------- | ----------------------------- | --------- | -------------------------------------------------------- |
| `bg`                           | 0.975 0.004 75                | `#f8f6f4` | 0.17 0.008 65                 | `#120f0c` | The page                                                 |
| `surface`                      | 0.995 0.002 75                | `#fefdfc` | 0.21 0.008 65                 | `#1b1815` | Cards, lists, panels, the widget                         |
| `surface-2`                    | 0.955 0.005 75                | `#f2f0ec` | 0.25 0.009 65                 | `#25211d` | Fills, hovers, the assistant's bubble, secondary buttons |
| `surface-3`                    | 0.925 0.007 75                | `#e9e6e1` | 0.30 0.010 65                 | `#312d29` | Pressed neutral fills                                    |
| `line`                         | 0.90 0.008 75                 | `#e1ddd8` | 0.32 0.010 65                 | `#37322e` | Dividers inside a surface                                |
| `line-input`                   | 0.64 0.010 75                 | `#908b86` | 0.53 0.012 65                 | `#716a65` | Field outlines (3:1 against their background)            |
| `ink`                          | 0.24 0.012 65                 | `#231e19` | 0.95 0.006 75                 | `#f1eeea` | Text                                                     |
| `ink-2`                        | 0.42 0.012 65                 | `#524c46` | 0.80 0.008 75                 | `#c1bdb8` | Secondary text                                           |
| `ink-3`                        | 0.53 0.012 65                 | `#716a65` | 0.68 0.010 75                 | `#9c9792` | Muted text, captions                                     |
| `accent`                       | 0.50 0.083 190                | `#0e726e` | 0.74 0.100 190                | `#52bfb9` | Primary actions, links, focus, the customer's bubble     |
| `accent-strong`                | 0.43 0.073 190                | `#045c59` | 0.80 0.100 190                | `#67d2cc` | Hover and pressed accent                                 |
| `accent-soft`                  | 0.95 0.025 190                | `#ddf4f2` | 0.30 0.045 190                | `#0b3533` | Selected choices, highlights                             |
| `accent-ink`                   | 0.38 0.063 190                | `#074d4a` | 0.86 0.080 190                | `#91e2dc` | Text and icons on `accent-soft`                          |
| `on-accent`                    | 0.99 0.005 190                | `#f8fdfc` | 0.18 0.020 190                | `#071413` | Text on `accent`                                         |
| `success` / `success-soft`     | 0.50 0.10 155 / 0.95 0.03 155 | `#2a7449` | 0.74 0.13 155 / 0.29 0.05 155 | `#5ec386` | Booked, confirmed                                        |
| `warning-ink` / `warning-soft` | 0.47 0.10 60 / 0.95 0.045 85  | `#834b14` | 0.84 0.12 80 / 0.30 0.05 75   | `#f4c26a` | Waiting for the team                                     |
| `danger` / `danger-soft`       | 0.52 0.17 27 / 0.955 0.02 25  | `#b6322d` | 0.72 0.16 25 / 0.30 0.06 25   | `#f97770` | Errors, cancelling                                       |
| `on-danger`                    | 0.99 0.005 25                 | `#fffafa` | 0.18 0.020 25                 | `#1a0e0d` | Text on a solid danger button                            |

**Contrast, computed** (OKLCH converted to sRGB, WCAG ratios rounded down; AA asks 4.5:1 for text and 3:1 for outlines and focus):

| Pair                                           | Light  | Dark   |
| ---------------------------------------------- | ------ | ------ |
| `ink` on `bg`                                  | 15.3:1 | 16.5:1 |
| `ink-2` on `surface`                           | 8.3:1  | 9.4:1  |
| `ink-3` on `surface-2` (the weakest text pair) | 4.6:1  | 5.5:1  |
| `on-accent` on `accent`                        | 5.6:1  | 8.4:1  |
| `accent` on `bg` (links, focus ring)           | 5.3:1  | 8.6:1  |
| `accent-ink` on `accent-soft`                  | 8.4:1  | 9.0:1  |
| `warning-ink` on `warning-soft`                | 6.0:1  | 8.3:1  |
| `danger` on `danger-soft`                      | 5.2:1  | 5.2:1  |
| `line-input` on `surface`                      | 3.3:1  | 3.3:1  |
| `success` on `success-soft` (badges)           | 4.9:1  | 6.3:1  |
| `on-danger` on `danger`                        | 5.8:1  | 7.1:1  |

**Dark mode.** The dashboard, sign-in and home pages follow the device's setting (`prefers-color-scheme`). The widget stays light: it sits on businesses' own websites, most of them light, and a dark widget on a light site looks like a mistake (a per-business setting would be a new feature, so it's a proposal). The demo salon is its own website, and light.

**Charts** use `accent` for their one series; nothing else gets a color of its own.

## Type

**Readex Pro**, one family for both scripts. Its Arabic was drawn alongside its Latin (the Latin builds on Lexend, which was designed for reading ease; the Arabic is by Nadine Chahine), so the two share weight, color and rhythm instead of a Latin face borrowing whatever Arabic the system has. It's on Google Fonts (open licence), loaded with `next/font` as one variable font (weights 160 to 700) with the `latin` and `arabic` subsets. **Geist Mono** stays for code only (the embed snippet).

Considered, side by side on the preview page: Geist with IBM Plex Sans Arabic (today: two unrelated families that don't match in weight or rhythm), Alexandria (strong and geometric, more display than reading face), Rubik (friendly, but its Arabic is the least refined of the four).

| Step    | Size / line height | Arabic line height | Weight | Used for                              |
| ------- | ------------------ | ------------------ | ------ | ------------------------------------- |
| Display | 44 / 52            | 68                 | 600    | The demo page and marketing headlines |
| H1      | 32 / 40            | 52                 | 600    | Page titles                           |
| H2      | 24 / 32            | 40                 | 600    | Sections                              |
| H3      | 19 / 28            | 32                 | 600    | Groups, empty-state titles            |
| Large   | 17 / 28            | 32                 | 400    | The confirmation's summary, lead text |
| Body    | 15 / 24            | 28                 | 400    | Everything else                       |
| Small   | 13 / 20            | 24                 | 400    | Labels, table cells, secondary lines  |
| Caption | 12 / 16            | 20                 | 400    | Process lines, sources, helper text   |

- **Arabic keeps the sizes and gets the extra line height**; it never gets letter spacing (it breaks the joins) or case transforms.
- **Latin display sizes tighten:** -0.02em for Display and H1, -0.01em for H2. Sentence case everywhere.
- **Weights:** 400, 500 (labels, buttons, emphasis) and 600 (headings). Nothing heavier.
- **Line length:** reading text stays under 68 characters.
- **Numbers:** Western digits in both languages, as today; tabular figures in tables, times and money.
- **Mixed directions:** a left-to-right run inside Arabic (a phone number, a reference, an email) is isolated, with `<bdi>` in markup or Unicode isolates (U+2066, U+2069) in generated text. Without it, "(+966 55 123 4567)" reorders itself inside an Arabic sentence; that happens in the widget's Arabic confirmation today and is fixed in step 4, with the brackets inside the isolated run and no line break within the number.
- **No em or en dashes** in the interface: ranges use a hyphen in compact places ("16:00-16:45") and words in sentences ("from 17:00 to 17:45", "من 17:00 إلى 17:45").

## Space

Steps of 4px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80. Inside a component 8 to 12; between groups 24; between page sections 48 to 64. Page gutters are 16px on phones, 24px on tablets and 32px on desktops. Containers: data pages up to 1152px wide, forms up to 672px, reading text up to 68 characters, the widget panel 400px.

## Shape

One rule, applied everywhere:

- **Controls** (buttons, fields, selects): 10px.
- **Surfaces** (cards, lists, tables, the confirmation card): 16px; the widget panel: 20px.
- **Chat bubbles:** 18px, with 6px on the bottom corner on the speaker's side, mirrored in Arabic.
- **Choices** (tabs, periods, switches): full pills. **Badges:** 6px, because they're labels, not buttons.

## Depth

Surfaces lift off the page with a soft, warm-tinted shadow and a hairline ring, instead of sitting in borders.

| Level | Shadow (light)                                  | Used for                        |
| ----- | ----------------------------------------------- | ------------------------------- |
| 0     | none                                            | Things on the page itself       |
| 1     | `0 1px 2px` stone at 6%, plus a 1px ring at 7%  | Cards, lists, tables            |
| 2     | `0 12px 28px -12px` stone at 22%, plus the ring | The confirmation card, menus    |
| 3     | `0 28px 60px -18px` stone at 32%, plus the ring | The widget panel over a website |

Borders stay only where they mean something: field outlines (3:1), dividers inside a surface, and the team's messages, marked by a teal edge.

## Motion

Calm, short and purposeful, CSS only (no animation library, in the widget least of all).

- **Durations:** 120ms (hover and press), 200ms (state changes), 280ms (things arriving). **Easing:** `cubic-bezier(0.2, 0, 0, 1)`. Only `transform` and `opacity` move.
- **What moves:** a button settles 1px when pressed; the widget panel fades in and rises 8px; a new message fades in and rises 4px; three dots pulse while the assistant is replying. Nothing else loops, and nothing animates on scroll in the product.
- **Reduced motion:** with `prefers-reduced-motion`, nothing moves and the dots stand still.

## Icons

**Phosphor** (regular weight; the fill weight for the launcher and send glyphs), replacing Lucide's two icons so there is one family. 14px beside 12 to 13px text (process lines, badges), 16px beside body text, 18 to 20px in buttons, 24px in empty states. Icons point the way the text reads: send, arrows and "next" chevrons mirror in Arabic. They accompany words; an icon-only button (close, send) keeps its accessible name ("Close chat", "Send").

## Focus and touch

- **Focus:** a 2px `accent` outline with a 2px gap, on every interactive element (at least 5.3:1 against the page, light and dark).
- **Touch:** at least 44px for everything in the widget and for actions on phones; dashboard controls are 40px tall.

## Components

**Buttons.** Primary (`accent`), secondary (`surface-2` fill), outline (a field-style ring, for low emphasis on surfaces), ghost (`accent-ink` text), danger (`danger` on `danger-soft`, solid on hover). One primary action per view; labels of one to three words, on one line.

**Fields.** Label above, helper below, error below with an icon. 40px tall, `surface` fill with a `line-input` ring; invalid fields get a 2px `danger` ring and their message. A placeholder never stands in for a label.

**Choosing one** (business sections, periods, whose hours): pills. The current one is `accent-soft` with `accent-ink` text, medium weight and `aria-current`; the others are `ink-2` and fill on hover.

**Badges.** Soft tone, its ink, an icon and a word, never color alone: waiting for the team (warning), with the team (accent), closed (neutral), confirmed (success), cancelled (danger).

**Lists and cards.** One level-1 surface holds a list, with dividers between rows; no box around each row. Cards exist only where they group something you act on.

**Tables.** Inside a surface. Header 12px medium in `ink-3`; rows 40 to 44px; text starts at the start, numbers end at the end with tabular figures; rows fill `surface-2` on hover. On phones a wide table scrolls inside its surface, which is then a named, focusable region so the keyboard can scroll it too; the page never scrolls sideways.

**Empty states.** An icon in an `accent-soft` circle, a short title, the sentence the app already has about what to do, and that one action.

**The chat** (the widget and the dashboard's test chat):

- **Messages.** The customer's in `accent` bubbles at the end, the assistant's in `surface-2` bubbles at the start, the team's in `surface` bubbles with a teal edge on the start side and "From the team" with an icon.
- **Process lines** ("Looked it up", "Checked availability") are 12px `ink-3` lines with an icon; **sources** are numbered chips under the reply.
- **The confirmation card** is a level-2 surface with a calendar icon, the summary at 17px medium, and Confirm (primary) beside Not now (secondary), both 44px; the result follows as a `success` line with a check.
- **State notes** sit above the composer with an icon in their tone: waiting (warning), with the team (accent), errors (danger).
- **The composer** is one line that grows, with an icon send button; its label ("Message") is kept for screen readers, visually hidden.
- **While replying,** three dots in an assistant bubble.

**The widget's shell.** A header with the business's initial in an `accent` circle, "Chat with Nour Salon", a language pill with a globe, and close. On desktops a 400px panel (at most 640px tall) at level 3; on phones (under 640px wide) it fills the screen, respecting the safe areas. Its page has a `main` landmark, and an unknown business gets a designed "not found" inside the frame. The **launcher** is an `accent` pill with the chat icon and its label, or a 56px circle on phones; it uses the system font, because the host page doesn't load ours. The chat stays inside its frame; the host page only ever gets the launcher and the frame's inline styles. The widget's JavaScript may grow by 10% at most (see the audit's baseline).

**Grids:** columns are `minmax(0, 1fr)`, so long content wraps instead of pushing a layout past the screen (the preview caught this at 390px).

## The dashboard, in step 6

- **Frame:** a top bar with the Hala mark and the business (linking back to Businesses), and section tabs as pills with icons, wrapping onto a second line when needed.
- **Widths:** data pages use the full 1152px; forms stay within 672px.
- **Usage:** leads with today's spend against the budget (a meter, the only progress bar), the counts follow as plain figures instead of four equal tiles, and the tables sit in surfaces.
- **A conversation:** the transcript beside a side panel (customer, status, actions) from 1024px up.
- **Also:** a skip link, consistent date formats, and composed empty states.

**As built.** The signed-in pages share one frame: a top bar with the app mark, a skip link, the business's name as the page's H1, and its sections as pills with icons, which wrap (four rows on a phone, rather than scrolling sideways and hiding some). Sections have H2 headings with what they're for and their one action; lists sit on one surface with dividers; statuses are badges (a conversation's, a booking's, an archived item's, a member's role); forms sit on surfaces with errors and "Saved." in their tone, with an icon; destructive actions (cancel a booking, remove, revoke) use the danger button. Wide screens use the width where it helps: the overview's two forms side by side, Knowledge's "Try a question" and Team's invite form beside their lists, the widget's live preview beside its settings, a booking's cancel panel and a conversation's status, actions and customer beside the details or transcript. Usage leads with today's spend as a meter, follows with the period's counts as plain figures, and keeps its tables on surfaces that scroll sideways on a phone. Days read the same everywhere ("Wed, 7 Oct 2026", and "Wed, 7 Oct" in tables), ranges use a hyphen ("16:00-16:45"), and a missing value reads "None". Sign-in, sign-up and the home page share a panel of what Hala does (only what it does). The browser's own date and time inputs still follow the browser's locale; matching pickers stay a proposal.

## The demo salon page, in step 5

It's a business's website, not Hala's, so it gets a salon identity of its own, built only from the seeded data (no invented reviews, prices or claims). The widget then appears on someone else's site, the way it does in real life.

**As built.** Nour Salon has its own colors, scoped to the page: cream, espresso ink and brass (every text pair at least 4.8:1), so Hala's teal launcher stands out on it as it would on any client's site. Its type is Readex Pro, like Hala's, but in light weights at large sizes, with a wordmark in spaced capitals (the Latin only: spacing would break the Arabic's joins) and the Arabic word "نور" (light) large and soft as the one decoration. The page has a header, a hero, the services with their Arabic names, durations, prices and who performs them, and the salon's address, hours, parking and payment, all from the seeded salon (its services and staff from the database, the rest from its FAQs). Hala's own words stay apart, in Hala's colors: a one-line note at the top that this is a demo, and the "See the salon's side" card with the dashboard login.

**Measured, then decided.** A display face of its own (El Messiri, Latin and Arabic) was tried and dropped: Lighthouse on the same machine scored the page 92 against the old page's 96, with the first and largest paints about 0.3 s later and a small layout shift from the font swap. Without it, first and largest paint match the old page and nothing shifts. A team section repeating who performs each service was dropped too. What remains costs a little main-thread time (the page has about twice the old one's text, laid out again when Readex arrives): over 9 alternating runs, a median of 94 against 95.

## Marks

The wordmark is "Hala | هلا" in Readex Pro semibold. The app mark is "هلا" in `on-accent` on an `accent` rounded square; in step 7 it becomes the favicon and app icon. Neither appears inside the widget, which belongs to the business.

## For the marketing site

The marketing website uses exactly this system: [TOKENS.md](TOKENS.md) shows how to bring the tokens (`src/styles/tokens.css`, or `tokens.json` for tools) into another project.
