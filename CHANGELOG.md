# Changelog

What changed for the people who use Hala. The phases that built it are in the README's [roadmap](README.md#roadmap) and the git history.

## 2026-10-08: the redesign

Hala looked like a starter template: gray on white, a near-black button, a 1px border around everything, and nothing that said who it was for. It now has a design system of its own, applied to every screen, with no change to what Hala does. The before and after screens, accessibility checks, Lighthouse scores and size budget are in [docs/design/results.md](docs/design/results.md).

- **A design system** ([docs/design/DESIGN.md](docs/design/DESIGN.md)): warm stone neutrals with one teal accent, in light and dark; Readex Pro setting Arabic and English together, with Arabic's own line heights; surfaces and soft shadows instead of borders; one radius rule; calm, short motion that stops for reduced motion; Phosphor icons. Every text pair meets WCAG AA. The tokens live in `src/styles/tokens.css` and are exported to `docs/design/tokens.json` for other Hala projects.
- **The widget:** a teal launcher with its label; on phones, the chat fills the screen and has a close button; the business's initial in the header; one message system (the customer in teal, the assistant in stone, the team with a teal edge); quiet process lines and source chips; a raised confirmation card; typing dots; designed empty and error states. Phone numbers inside Arabic text no longer reorder themselves.
- **The demo** is now Nour Salon's own website, in the salon's colors, built only from the seeded salon's data, so the widget appears on someone else's site the way it does for a real business.
- **The dashboard, sign-in and home page:** a top bar with the app mark and a skip link, the business's name as the page heading, sections as pills with icons, lists and forms on surfaces, status badges with an icon and a word, composed empty states, wider layouts where the data needs them (a conversation beside its actions, Usage's tables), and one date format everywhere.
- **Finishing:** a favicon and app icons from the mark, a designed "page not found", and reduced motion honored everywhere.
- **For developers:** the embed script's readable source is `src/embed/widget.js`, minified to `public/widget.js` by `pnpm widget` (a test fails when it's stale or over 2,917 bytes); `pnpm tokens` regenerates `tokens.json` and the class tables `cn` merges with.
