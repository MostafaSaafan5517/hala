# Using Hala's design tokens

The design system ([DESIGN.md](DESIGN.md)) lives in code as one set of tokens that this app and any other Hala project (the marketing website first) use as-is.

## The files

| File                                                           | What it is                                                                                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/styles/tokens.css`](../../src/styles/tokens.css)         | **The source.** Plain CSS custom properties named `--hala-*`: colors and shadows for light and dark, radii, motion and the type scale. No framework needed.               |
| [`tokens.json`](tokens.json)                                   | The same tokens as JSON, with a hex fallback for every color, for tools and projects that don't read CSS. Written by `pnpm tokens`; never edit it by hand.                |
| [`src/app/globals.css`](../../src/app/globals.css)             | How this app wires the tokens into Tailwind CSS v4 and shadcn/ui: the color names the components use, the type scale utilities, the dark-mode rule and the focus outline. |
| [`src/styles/tokens.test.ts`](../../src/styles/tokens.test.ts) | Fails if the two dark copies differ, if `tokens.json` is out of date, or if a change breaks WCAG AA for any text or outline pair the interface uses.                      |
| [`src/lib/cn-tables.ts`](../../src/lib/cn-tables.ts)           | The tables `cn` merges class names with, built from the theme so it knows `text-body`, `rounded-control` and the rest. Written by `pnpm tokens`; never edit it by hand.   |

## Light, dark, and forcing one

Colors are light by default and dark when the device asks for it (`prefers-color-scheme`). Two classes force a mode for everything inside them:

- `.hala-light`: the widget (it sits on businesses' websites, most of them light) and the demo salon page.
- `.hala-dark`: anything that must stay dark, such as a dark section of the marketing site.

A forced class sets the text color too, so nothing inside inherits the other mode's color. Tailwind's `dark:` variant follows the same rule.

## Names in code

The components keep shadcn/ui's color names, so its components work unchanged; each name points at a Hala token.

| Design token (DESIGN.md)       | CSS variable                                 | Tailwind name                                         | Used for                                                 |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `bg`                           | `--hala-bg`                                  | `background`                                          | The page                                                 |
| `surface`                      | `--hala-surface`                             | `card`, `popover`                                     | Cards, lists, panels                                     |
| `surface-2`                    | `--hala-surface-2`                           | `muted`, `secondary`                                  | Fills, hovers, the assistant's bubble, secondary buttons |
| `surface-3`                    | `--hala-surface-3`                           | `secondary-strong`                                    | Pressed neutral fills                                    |
| `line`                         | `--hala-line`                                | `border`                                              | Dividers                                                 |
| `line-input`                   | `--hala-line-input`                          | `input`                                               | Field outlines                                           |
| `ink`                          | `--hala-ink`                                 | `foreground`, `card-foreground`, `popover-foreground` | Text                                                     |
| `ink-2`                        | `--hala-ink-2`                               | `secondary-foreground`                                | Secondary text                                           |
| `ink-3`                        | `--hala-ink-3`                               | `muted-foreground`                                    | Muted text, captions                                     |
| `accent`                       | `--hala-accent`                              | `primary`, `ring`, `chart-1`                          | Primary actions, links, focus                            |
| `accent-strong`                | `--hala-accent-strong`                       | `primary-strong`                                      | Hover and pressed primary                                |
| `on-accent`                    | `--hala-on-accent`                           | `primary-foreground`                                  | Text on primary                                          |
| `accent-soft`                  | `--hala-accent-soft`                         | `accent`                                              | Selected choices, highlights                             |
| `accent-ink`                   | `--hala-accent-ink`                          | `accent-foreground`                                   | Text and icons on `accent`                               |
| `success` / `success-soft`     | `--hala-success` / `--hala-success-soft`     | `success` / `success-soft`                            | Booked, confirmed                                        |
| `warning-ink` / `warning-soft` | `--hala-warning-ink` / `--hala-warning-soft` | `warning` / `warning-soft`                            | Waiting for the team                                     |
| `danger` / `danger-soft`       | `--hala-danger` / `--hala-danger-soft`       | `destructive` / `destructive-soft`                    | Errors, cancelling                                       |
| `on-danger`                    | `--hala-on-danger`                           | `destructive-foreground`                              | Text on a solid destructive button                       |

Note the one trap: Tailwind's `accent` is the **soft** teal (shadcn's meaning: a highlight), while DESIGN.md's `accent` is the solid teal, which code calls `primary`.

**Type:** `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-large`, `text-body`, `text-small`, `text-caption`. Each sets its size, line height and (for headings) weight and tracking; inside Arabic text (`lang="ar"`) the line heights grow and the tracking goes, automatically. Don't add `tracking-*` to Arabic.

**Shape and depth:** `rounded-control`, `rounded-surface`, `rounded-panel`, `rounded-bubble` (with `rounded-ee-bubble-tail` or `rounded-es-bubble-tail` for the speaker's corner), `rounded-badge`; `shadow-level-1`, `shadow-level-2`, `shadow-level-3`. **Motion:** `ease-hala`, with `var(--hala-duration-fast)`, `var(--hala-duration)` and `var(--hala-duration-slow)`; `motion-safe:animate-arrive` (a message arriving) and `motion-safe:animate-typing` (the typing dots).

**Fonts:** `font-sans` is Readex Pro (Latin and Arabic) and `font-mono` is Geist Mono, both loaded with `next/font` in [`src/app/layout.tsx`](../../src/app/layout.tsx) as `--font-readex` and `--font-geist-mono`.

## In another project (the marketing site)

1. **Copy `src/styles/tokens.css`** into the project, unchanged, and import it from the global stylesheet.
2. **Load the fonts** with `next/font/google`: `Readex_Pro({ variable: "--font-readex", subsets: ["latin", "arabic"] })` and, if it shows code, `Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })`, and put their `variable` classes on `<html>`.
3. **With Tailwind CSS v4 and shadcn/ui**, copy the `@custom-variant dark`, both `@theme` blocks, the `:root` radius line and the `@layer base` block from `src/app/globals.css`. Every name in the table above then works there too. If it merges classes with `cn`, build its tables from that stylesheet (`cn build --css <it> --full`) and use them as `src/lib/utils.ts` does.
4. **Without Tailwind,** use the variables directly: `background: var(--hala-surface); color: var(--hala-ink); border-radius: var(--hala-radius-surface); box-shadow: var(--hala-shadow-1);`, and set the type scale from the `--hala-text-*` variables (with the `-arabic` line heights inside `:lang(ar)`).
5. **Design tools** (Figma and the like) can read `tokens.json`, which also carries each color's hex.

When the tokens change here, copy `tokens.css` again; the version in this repository is the one to trust.

## Changing a token

1. Edit `src/styles/tokens.css`. A dark color is written twice (inside the `prefers-color-scheme` query and in `.hala-dark`); change both.
2. Run `pnpm tokens` to rewrite `tokens.json` and `cn`'s tables, then `pnpm test`: it fails on a mismatch, a stale export, stale tables, or a pair below WCAG AA.
3. If the change is visible, update the value in DESIGN.md's tables and check `/design-preview` (in development) in both modes.
