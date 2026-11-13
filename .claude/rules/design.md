---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.vue"
  - "**/*.svelte"
  - "**/*.css"
  - "**/*.scss"
  - "**/components/**"
  - "**/app/**"
  - "**/pages/**"
---

# Design

- **One design system.** Tokens (colour, spacing, radius, type scale, shadow, motion) live in one file named in `CLAUDE.md`. Use them; never hard-code a hex value, pixel size or font size in a component. Need a new value? The tokens file is shared, so propose the token to your user (the guard asks them) rather than hard-coding it.
- **One component library**, chosen at kickoff (e.g. shadcn/ui, Radix, Mantine, or the native platform's). Compose from it before writing a custom component; don't mix libraries.
- **Spacing** on a 4/8 px scale; generous whitespace; align to a grid. Visual hierarchy through size, weight and spacing before colour.
- **Typography:** at most two families, a fixed type scale, line length 60-80 characters for prose, numbers in tabular figures where they line up.
- **Colour:** one accent colour, neutrals for everything else, semantic colours (success, warning, danger) only for state. AA contrast.
- **Motion:** short (150-250 ms), ease-out, purposeful (state change, continuity); never block input; honour `prefers-reduced-motion`.
- **Icons** from one set at consistent sizes; every icon-only button has an accessible label and a tooltip.
- **Forms:** labels above inputs, inline validation after blur, a disabled-with-spinner submit while pending, errors next to the field.
- **AI output in the UI:** stream it, render Markdown safely, show what it's based on (sources, inputs), make it copyable, and give a clear state while thinking.
- Build each screen as `docs/spec.md` describes it (layout, states, exact copy), matching the references in `docs/design/` when they exist.
- After a UI change, look at it: take screenshots at 375 px and 1440 px (Playwright or the browser tool) and check them before calling it done.
