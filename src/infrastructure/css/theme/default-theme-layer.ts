/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Default theme layer — Sovrium's always-present CSS token layer.
 *
 * The standalone Sovrium binary cannot read files at runtime, so the default
 * design system is inlined here as bundled TypeScript string constants — the
 * V1_TOKEN_LAYER / ROLE_TOKEN_BRIDGE / NEUTRAL_FLOOR_LAYER constants below ARE
 * the source of truth. Three layers are exported and assembled by
 * `buildDefaultLayer` in `compiler.ts`:
 *
 *   - {@link V1_TOKEN_LAYER}    — canonical role tokens, ramps and non-color
 *     tokens. Registers the canonical token names in an `@theme` block (so the
 *     Tailwind engine mints `bg-background`, `text-foreground`, `bg-primary`, `bg-error-bg`,
 *     `ring-focus-ring`, … utilities) and ships their light/dark VALUES in plain
 *     `:root` / dark-selector blocks so they switch at runtime. The minting
 *     names point at an internal `--sv-*` indirection layer whose value is
 *     supplied by {@link ROLE_TOKEN_BRIDGE}.
 *   - {@link ROLE_TOKEN_BRIDGE}  — `var()` fallback chains supplying every
 *     canonical `--sv-*` role var with its default value. `var()` late-binds at
 *     use-time, so the author's `@theme` (emitted later in the pipeline) still
 *     wins.
 *
 *     MOST roles now resolve to the neutral default DIRECTLY, because reading
 *     the matching `--color-*` name back would form a custom-property CYCLE
 * once that name became a registered canonical alias — see the
 *     per-role notes in the block itself. Only six roles still read a
 *     `--color-*` key as an intermediate rung: `--sv-focus-ring`
 *     (`--color-ring`), the four `-solid` status roles (`--color-success` /
 *     `-warning` / `-error` / `-info`) and `--sv-border` (`--color-input`).
 *
 *     Of those, `ring`/`success`/`warning`/`error`/`info` are ALSO first-class
 *     `theme.colors` keys routed through `COLOR_TO_SV_TOKEN`
 *     (`theme-generators.ts`), so their rung is redundant with the author
 *     bridge. `--color-input` is the one exception: it is absent from
 *     `COLOR_TO_SV_TOKEN`, so this rung is the ONLY path by which it reaches
 *     `--sv-border` — a surviving shadcn component-layer alias. Retiring it is
 *     a per-token change that needs visual-regression baselines, so it stays.
 *   - {@link NEUTRAL_FLOOR_LAYER} — the same canonical token set as
 *     {@link V1_TOKEN_LAYER} but with neutral, unstyled grayscale / system-font
 *     values + a dark cascade, used when `theme.baseline === 'replace'` so a
 *     replaced baseline never renders unstyled.
 *
 * ## How the Tailwind v4 wiring works (verified, not assumed)
 *
 * `@theme { --color-background: var(--sv-bg) }` does two things: it registers
 * `--color-background` (so the `bg-background` utility resolves to `background-color:
 * var(--color-background)`) AND it would normally hoist that var into `:root`. We keep
 * the actual light/dark VALUES in a separate `:root` block and a dark-selector
 * block keyed off the `--sv-*` indirection layer; overriding `--sv-bg` under the
 * dark selector switches the role token at runtime. `@source inline(...)`
 * safelists every canonical utility so it is emitted in BOTH the native PostCSS
 * path AND the candidate-driven native-free binary path — independent of the
 * source-tree scan in `generated-css-assets.ts`.
 *
 * ## Dark-mode selector
 *
 * The running app toggles dark mode by adding the `.dark` class to
 * `<html>` (see `command-palette-runtime.ts`), and the compiler declares
 * `@custom-variant dark (&:is(.dark *))`. v1's own source keys dark off
 * `[data-theme="dark"]`. To honour both, the dark cascade is emitted under
 * `:where(.dark, [data-theme='dark'])` — the `.dark` arm matches the live
 * toggle, the `[data-theme='dark']` arm matches the legacy authored convention.
 *
 * Source of truth: the {@link V1_TOKEN_LAYER} string constant below. Semantic
 * element styles (html/body/h1/a/.humane/…) are deliberately EXCLUDED because
 * they overlap with the existing `generateBaseLayer`. The Source Serif 4
 * italic `@font-face` declaration is shipped via
 * `SELF_HOSTED_FONT_FACES` (assembled by `buildDefaultLayer` in
 * `compiler.ts`); Plex Sans and JetBrains Mono are self-hosted —
 * for the self-hosted font strategy
 * for the strategy and budget.
 */

/**
 * The full set of canonical color utilities the v1 token layer must mint.
 * Safelisted via `@source inline(...)` so they are emitted in both the native
 * and native-free compilation paths regardless of source-tree candidate scan.
 *
 * Kept in sync with the `@theme` color-token registrations below.
 */
const CANONICAL_COLOR_UTILITIES = [
  // Neutral ramp
  'bg-neutral-50',
  'bg-neutral-100',
  'bg-neutral-200',
  'bg-neutral-300',
  'bg-neutral-400',
  'bg-neutral-500',
  'bg-neutral-600',
  'bg-neutral-700',
  'bg-neutral-800',
  'bg-neutral-900',
  'bg-neutral-950',
  'text-neutral-500',
  'text-neutral-600',
  'text-neutral-700',
  'text-neutral-900',
  'text-neutral-950',
  'border-neutral-200',
  'border-neutral-300',
  // Surface roles
  'bg-background',
  'bg-background-subtle',
  'bg-background-raised',
  'bg-background-overlay',
  'bg-foreground',
  'text-background',
  'text-background-overlay',
  'bg-scrim',
  'bg-scrim/50',
  // Border roles
  'border-border',
  'border-border-strong',
  'border-border-inverse',
  'divide-border',
  'bg-border',
  'bg-border-strong',
  // Foreground roles
  'text-foreground',
  'text-foreground-muted',
  'text-foreground-subtle',
  'text-foreground-disabled',
  'text-foreground-inverse',
  'text-foreground-humane',
  // Primary
  'bg-primary',
  'bg-primary-hover',
  'bg-primary-active',
  'bg-primary-subtle',
  'text-primary',
  'text-primary-fg',
  'text-primary-subtle-fg',
  'border-primary',
  // Focus ring
  'ring-focus-ring',
  'border-focus-ring',
  // Warmth accent
  // Success
  'bg-success-bg',
  'bg-success-solid',
  'text-success-fg',
  'text-success-solid-fg',
  'border-success-border',
  // Success numbered ramp (50/100/300/500/600/700/950 — the v1 ramp steps; see V1_ROOT_LIGHT)
  'bg-success-50',
  'bg-success-100',
  'bg-success-300',
  'bg-success-500',
  'bg-success-600',
  'bg-success-700',
  'bg-success-950',
  // Warning
  'bg-warning-bg',
  'bg-warning-solid',
  'text-warning-fg',
  'text-warning-solid-fg',
  'border-warning-border',
  // Warning numbered ramp (50/100/300/500/700/950)
  'bg-warning-50',
  'bg-warning-100',
  'bg-warning-300',
  'bg-warning-500',
  'bg-warning-700',
  'bg-warning-950',
  // Error
  'bg-error-bg',
  'bg-error-solid',
  'text-error-fg',
  'text-error-solid-fg',
  'border-error-border',
  // Error numbered ramp (50/100/300/500/600/700/950)
  'bg-error-50',
  'bg-error-100',
  'bg-error-300',
  'bg-error-500',
  'bg-error-600',
  'bg-error-700',
  'bg-error-950',
  // Info
  'bg-info-bg',
  'bg-info-solid',
  'text-info-fg',
  'text-info-solid-fg',
  'border-info-border',
  // Info numbered ramp (50/100/300/500/600/700/950)
  'bg-info-50',
  'bg-info-100',
  'bg-info-300',
  'bg-info-500',
  'bg-info-600',
  'bg-info-700',
  'bg-info-950',
  // shadcn-convention alias utilities — mirror COLOR_TO_SV_TOKEN so the
  // default theme always emits them (they otherwise tree-shake to no-ops when a
  // config authored with shadcn names is not scanned, e.g. the native-free binary
  // path). Each resolves to the same --sv-* role as its v1-name sibling.
  'text-primary-foreground',
  'bg-card',
  'bg-muted',
  'text-muted-foreground',
  'bg-popover',
  'bg-destructive',
  'text-destructive-foreground',
].join(' ')

/**
 * Canonical typography utilities the v1 token layer must mint.
 *
 * Tailwind v4 tree-shakes `@theme` token declarations whose minted utility
 * has no candidate in the source-tree scan, so a font slot referenced only
 * dynamically would be dropped from the compiled CSS and its `@font-face`
 * would never load — no element ever requests the family. Safelisting keeps
 * every slot reachable in both compilation paths.
 *
 * There is no `font-serif` entry: [internal ref] amendment A2 deletes the serif
 * grace note, the `--font-serif` token and the Source Serif face with it.
 *
 * `font-mono` is included for parity (the safelist contract is "every v1
 * font slot is always reachable"). `font-sans` is the default and
 * already emitted via the body cascade, but listing it here makes the
 * contract symmetric and prevents a future tree-shake regression.
 */
const CANONICAL_FONT_UTILITIES = ['font-sans', 'font-mono'].join(' ')

/**
 * `@theme` block registering every canonical color token name. Each maps to an
 * internal `--sv-*` indirection var (whose value is supplied by the `:root`
 * blocks below and {@link ROLE_TOKEN_BRIDGE}). Registering them here is what mints
 * the corresponding `bg-*` / `text-*` / `border-*` / `ring-*` utilities.
 */
const V1_THEME_COLOR_REGISTRATIONS = `@theme {
    /* Neutral ramp — minted directly so bg-neutral-* utilities resolve */
    --color-neutral-50: var(--sv-neutral-50);
    --color-neutral-100: var(--sv-neutral-100);
    --color-neutral-200: var(--sv-neutral-200);
    --color-neutral-300: var(--sv-neutral-300);
    --color-neutral-400: var(--sv-neutral-400);
    --color-neutral-500: var(--sv-neutral-500);
    --color-neutral-600: var(--sv-neutral-600);
    --color-neutral-700: var(--sv-neutral-700);
    --color-neutral-800: var(--sv-neutral-800);
    --color-neutral-900: var(--sv-neutral-900);
    --color-neutral-950: var(--sv-neutral-950);

    /* Surface roles */
    --color-background: var(--sv-bg);
    --color-background-subtle: var(--sv-bg-subtle);
    --color-background-raised: var(--sv-bg-raised);
    --color-background-overlay: var(--sv-bg-overlay);
    --color-scrim: var(--sv-scrim);

    /* Border roles */
    --color-border: var(--sv-border);
    --color-border-strong: var(--sv-border-strong);
    --color-border-inverse: var(--sv-border-inverse);

    /* Foreground roles */
    --color-foreground: var(--sv-fg);
    --color-foreground-muted: var(--sv-fg-muted);
    --color-foreground-subtle: var(--sv-fg-subtle);
    --color-foreground-disabled: var(--sv-fg-disabled);
    --color-foreground-inverse: var(--sv-fg-inverse);

    /* Primary */
    --color-primary: var(--sv-primary);
    --color-primary-hover: var(--sv-primary-hover);
    --color-primary-active: var(--sv-primary-active);
    --color-primary-fg: var(--sv-primary-fg);
    --color-primary-subtle: var(--sv-primary-subtle);
    --color-primary-subtle-fg: var(--sv-primary-subtle-fg);

    /* Focus ring */
    --color-focus-ring: var(--sv-focus-ring);

    /* Warmth accent */

    /* Success */
    --color-success-bg: var(--sv-success-bg);
    --color-success-border: var(--sv-success-border);
    --color-success-fg: var(--sv-success-fg);
    --color-success-solid: var(--sv-success-solid);
    --color-success-solid-fg: var(--sv-success-solid-fg);

    /* Success numbered ramp — mints bg-success-50/100/.../950 utilities.
       Values resolve through --sv-success-* (defined in V1_ROOT_LIGHT). */
    --color-success-50: var(--sv-success-50);
    --color-success-100: var(--sv-success-100);
    --color-success-300: var(--sv-success-300);
    --color-success-500: var(--sv-success-500);
    --color-success-600: var(--sv-success-600);
    --color-success-700: var(--sv-success-700);
    --color-success-950: var(--sv-success-950);

    /* Warning */
    --color-warning-bg: var(--sv-warning-bg);
    --color-warning-border: var(--sv-warning-border);
    --color-warning-fg: var(--sv-warning-fg);
    --color-warning-solid: var(--sv-warning-solid);
    --color-warning-solid-fg: var(--sv-warning-solid-fg);

    /* Warning numbered ramp */
    --color-warning-50: var(--sv-warning-50);
    --color-warning-100: var(--sv-warning-100);
    --color-warning-300: var(--sv-warning-300);
    --color-warning-500: var(--sv-warning-500);
    --color-warning-700: var(--sv-warning-700);
    --color-warning-950: var(--sv-warning-950);

    /* Error */
    --color-error-bg: var(--sv-error-bg);
    --color-error-border: var(--sv-error-border);
    --color-error-fg: var(--sv-error-fg);
    --color-error-solid: var(--sv-error-solid);
    --color-error-solid-fg: var(--sv-error-solid-fg);

    /* Error numbered ramp */
    --color-error-50: var(--sv-error-50);
    --color-error-100: var(--sv-error-100);
    --color-error-300: var(--sv-error-300);
    --color-error-500: var(--sv-error-500);
    --color-error-600: var(--sv-error-600);
    --color-error-700: var(--sv-error-700);
    --color-error-950: var(--sv-error-950);

    /* Info */
    --color-info-bg: var(--sv-info-bg);
    --color-info-border: var(--sv-info-border);
    --color-info-fg: var(--sv-info-fg);
    --color-info-solid: var(--sv-info-solid);
    --color-info-solid-fg: var(--sv-info-solid-fg);

    /* Info numbered ramp */
    --color-info-50: var(--sv-info-50);
    --color-info-100: var(--sv-info-100);
    --color-info-300: var(--sv-info-300);
    --color-info-500: var(--sv-info-500);
    --color-info-600: var(--sv-info-600);
    --color-info-700: var(--sv-info-700);
    --color-info-950: var(--sv-info-950);

    /* shadcn-convention alias utilities (DEC-060). Mirror COLOR_TO_SV_TOKEN in
       theme-generators.ts so the DEFAULT theme mints the same shadcn names the
       custom-theme path already accepts — text-primary-foreground / bg-card /
       bg-muted / text-muted-foreground / bg-popover / bg-destructive /
       text-destructive-foreground resolve to their --sv-* role token in BOTH
       light and dark (previously they no-op'd on the default theme, leaving
       button text inheriting --sv-fg → near-invisible in dark mode). Each maps
       to the SAME --sv-* role its v1-name sibling maps to, so the alias and the
       v1 utility compute identically. The Group-A *-foreground / destructive
       names were the author-override inputs the alias bridge read as
       var(--color-X, ...); those bridge fallbacks are dropped (custom themes set
       the --sv-* role directly via generateAuthorSvBridge), so registering them
       here does NOT form a --color-X to --sv-role to --color-X cycle. */
    --color-primary-foreground: var(--sv-primary-fg);
    --color-card: var(--sv-bg-raised);
    --color-muted: var(--sv-bg-subtle);
    --color-muted-foreground: var(--sv-fg-muted);
    --color-popover: var(--sv-bg-overlay);
    --color-destructive: var(--sv-error-solid);
    --color-destructive-foreground: var(--sv-error-solid-fg);
  }`

/**
 * `@theme` block registering the non-color v1 tokens — fonts, sizes, weights,
 * line-heights, letter-spacing, spacing, radii, shadows, durations, easings,
 * z-index, density. Values are inlined verbatim from v1 (oklch / rgb / var()
 * kept as-is). These do not need `--sv-*` indirection (they do not switch by
 * theme baseline) so they carry their values directly.
 */
const V1_THEME_NONCOLOR_REGISTRATIONS = `@theme {
    /* ---------- Typography ---------- */
    --font-sans: 'IBM Plex Sans Variable', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    --font-display: var(--font-sans);

    --font-size-2xs: 0.6875rem;
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.8125rem;
    --font-size-base: 0.875rem;
    --font-size-md: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    --font-size-2xl: 1.5rem;
    --font-size-3xl: 1.875rem;
    --font-size-4xl: 2.25rem;
    --font-size-5xl: 3rem;
    --font-size-6xl: 3.75rem;

    --font-weight-regular: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;

    --line-height-none: 1;
    --line-height-tight: 1.1;
    --line-height-snug: 1.25;
    --line-height-normal: 1.55;
    --line-height-relaxed: 1.7;

    --letter-spacing-tighter: -0.022em;
    --letter-spacing-tight: -0.012em;
    --letter-spacing-normal: 0;
    --letter-spacing-wide: 0.02em;
    --letter-spacing-caps: 0.04em;

    /* ---------- Spacing ---------- */
    --spacing-0: 0px;
    --spacing-px: 1px;
    --spacing-0-5: 0.125rem;
    --spacing-1: 0.25rem;
    --spacing-1-5: 0.375rem;
    --spacing-2: 0.5rem;
    --spacing-2-5: 0.625rem;
    --spacing-3: 0.75rem;
    --spacing-4: 1rem;
    --spacing-5: 1.25rem;
    --spacing-6: 1.5rem;
    --spacing-8: 2rem;
    --spacing-10: 2.5rem;
    --spacing-12: 3rem;
    --spacing-16: 4rem;
    --spacing-20: 5rem;
    --spacing-24: 6rem;
    --spacing-32: 8rem;

    /* ---------- Radii ---------- */
    --radius-none: 0px;
    --radius-sm: 2px;
    --radius-base: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    --radius-xl: 12px;
    --radius-full: 9999px;

    /* ---------- Shadows ---------- */
    --shadow-none: none;
    --shadow-xs: 0 1px 0 0 rgb(0 0 0 / 0.04);
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 1px -1px rgb(0 0 0 / 0.04);
    --shadow-md: 0 4px 12px -2px rgb(0 0 0 / 0.07), 0 2px 4px -1px rgb(0 0 0 / 0.04);
    --shadow-lg: 0 12px 28px -4px rgb(0 0 0 / 0.09), 0 4px 8px -2px rgb(0 0 0 / 0.04);
    --shadow-xl: 0 24px 48px -8px rgb(0 0 0 / 0.13), 0 8px 16px -4px rgb(0 0 0 / 0.06);

    /* ---------- Motion ---------- */
    --duration-instant: 0ms;
    --duration-fast: 120ms;
    --duration-base: 180ms;
    --duration-slow: 260ms;
    --duration-deliberate: 340ms;

    --ease-default: cubic-bezier(0.2, 0, 0, 1);
    --ease-enter: cubic-bezier(0, 0, 0.2, 1);
    --ease-exit: cubic-bezier(0.4, 0, 1, 1);
    --ease-emphasized: cubic-bezier(0.3, 0, 0.1, 1.1);
  }`

/**
 * Plain `:root` block holding v1's LIGHT-mode token values. The neutral ramp,
 * warmth accent, and semantic ramps are inlined verbatim (oklch kept as-is —
 * the CSS engine handles oklch; only the schema rejects it). The role tokens
 * (`--sv-bg`, `--sv-fg`, …) get their light values here by referencing the
 * ramps via `var()`, exactly as v1's `:root` does. The fallback for any role
 * token can still be overridden by {@link ROLE_TOKEN_BRIDGE} (author/legacy keys).
 *
 * Note: `--sv-*` role token light values are intentionally NOT set here — they
 * are set by {@link ROLE_TOKEN_BRIDGE} so the author-key fallback chain is the
 * single source of their light value. Only the underlying ramps + the few role
 * tokens with literal (non-aliasable) values live here.
 */
const V1_ROOT_LIGHT = `:root {
    color-scheme: light;

    /* ---------- Neutral ramp — warm cast ---------- */
    --sv-neutral-50: oklch(0.985 0 0);
    --sv-neutral-100: oklch(0.965 0 0);
    --sv-neutral-200: oklch(0.92 0 0);
    --sv-neutral-300: oklch(0.87 0 0);
    --sv-neutral-400: oklch(0.71 0 0);
    --sv-neutral-500: oklch(0.56 0 0);
    --sv-neutral-600: oklch(0.445 0 0);
    --sv-neutral-700: oklch(0.375 0 0);
    --sv-neutral-800: oklch(0.272 0 0);
    --sv-neutral-900: oklch(0.205 0 0);
    --sv-neutral-950: oklch(0.14 0 0);

    /* ---------- Warmth accent ---------- */

    /* ---------- Semantic ramps (locked) ---------- */
    --sv-success-50: var(--sv-neutral-50);
    --sv-success-100: var(--sv-neutral-200);
    --sv-success-300: var(--sv-neutral-300);
    --sv-success-500: var(--sv-neutral-500);
    --sv-success-600: var(--sv-neutral-600);
    --sv-success-700: var(--sv-neutral-600);
    --sv-success-950: var(--sv-neutral-900);

    --sv-warning-50: var(--sv-neutral-50);
    --sv-warning-100: var(--sv-neutral-100);
    --sv-warning-300: var(--sv-neutral-300);
    --sv-warning-500: var(--sv-neutral-400);
    --sv-warning-700: var(--sv-neutral-600);
    --sv-warning-950: var(--sv-neutral-800);

    --sv-error-50: oklch(0.975 0.015 25);
    --sv-error-100: oklch(0.945 0.04 25);
    --sv-error-300: oklch(0.81 0.135 25);
    --sv-error-500: oklch(0.605 0.205 25);
    --sv-error-600: oklch(0.53 0.195 25);
    --sv-error-700: oklch(0.455 0.17 25);
    --sv-error-950: oklch(0.225 0.08 25);

    --sv-info-50: var(--sv-neutral-50);
    --sv-info-100: var(--sv-neutral-200);
    --sv-info-300: var(--sv-neutral-300);
    --sv-info-500: var(--sv-neutral-500);
    --sv-info-600: var(--sv-neutral-600);
    --sv-info-700: var(--sv-neutral-600);
    --sv-info-950: var(--sv-neutral-900);

    /* Humane fg — literal, no author alias */

    /* Scrim — mode-invariant dark modal backdrop. Pinned to the darkest ramp
       step and intentionally NOT overridden in the dark cascade, so it stays a
       dark veil in both light and dark modes (unlike bg-foreground/50, which inverts). */
    --sv-scrim: var(--sv-neutral-950);
  }`

/**
 * Dark cascade — overrides the `--sv-*` role vars under the live `.dark` toggle
 * (and v1's authored `[data-theme='dark']`). Re-points role tokens to different
 * ramp steps, exactly mirroring v1's `[data-theme="dark"]` block.
 *
 * Specificity note: the selector is prefixed with `html` (not the cleaner
 * `:is(.dark, [data-theme='dark'])`) so its specificity rises to (0,1,1) —
 * type+class — strictly above `:root`'s (0,1,0) — pseudo-class only. Without
 * the type prefix, the ROLE_TOKEN_BRIDGE `:root` rule and any later `:root`
 * block (Tailwind preflight, etc.) tie on specificity, and the
 * LATER-IN-SOURCE rule wins. Tailwind emits additional `:root` blocks AFTER
 * our dark cascade, so without `html` the dark overrides are silently masked:
 * `.dark` on `<html>` adds the class but `--sv-bg`/`--sv-fg` never re-point.
 * This was the root cause of "ui-kit (and foundations) snapshots look
 * identical in light and dark mode". Do NOT remove the `html` prefix.
 */
const V1_ROOT_DARK = `html:is(.dark, [data-theme='dark']) {
    color-scheme: dark;

    --sv-bg: var(--sv-neutral-950);
    --sv-bg-subtle: var(--sv-neutral-900);
    --sv-bg-raised: var(--sv-neutral-900);
    --sv-bg-overlay: var(--sv-neutral-800);

    --sv-border: var(--sv-neutral-800);
    --sv-border-strong: var(--sv-neutral-700);
    --sv-border-inverse: var(--sv-neutral-50);

    --sv-fg: var(--sv-neutral-50);
    --sv-fg-muted: var(--sv-neutral-400);
    /* fg-subtle is a TEXT token, so it is pinned slightly lighter than
       --sv-neutral-500 (oklch L 0.56) to clear WCAG AA (>= 4.5:1) on
       bg-background in dark mode while staying clearly darker than fg-muted. */
    --sv-fg-subtle: oklch(0.59 0 0);
    --sv-fg-disabled: var(--sv-neutral-700);
    --sv-fg-inverse: var(--sv-neutral-950);

    --sv-primary: var(--sv-neutral-50);
    --sv-primary-hover: var(--sv-neutral-200);
    --sv-primary-active: oklch(1 0 0);
    --sv-primary-fg: var(--sv-neutral-950);
    --sv-primary-subtle: var(--sv-neutral-800);
    --sv-primary-subtle-fg: var(--sv-neutral-50);

    --sv-focus-ring: var(--sv-neutral-50);

    --sv-success-bg: var(--sv-success-950);
    --sv-success-border: var(--sv-neutral-700);
    --sv-success-fg: var(--sv-neutral-300);
    --sv-success-solid: var(--sv-success-500);
    --sv-success-solid-fg: var(--sv-neutral-950);

    --sv-warning-bg: var(--sv-warning-950);
    --sv-warning-border: var(--sv-neutral-600);
    --sv-warning-fg: var(--sv-neutral-300);
    --sv-warning-solid: var(--sv-neutral-300);
    --sv-warning-solid-fg: var(--sv-warning-950);

    --sv-error-bg: var(--sv-error-950);
    --sv-error-border: oklch(0.38 0.14 25);
    --sv-error-fg: oklch(0.81 0.135 25);
    --sv-error-solid: var(--sv-error-500);
    --sv-error-solid-fg: var(--sv-neutral-50);

    --sv-info-bg: var(--sv-info-950);
    --sv-info-border: var(--sv-neutral-700);
    --sv-info-fg: var(--sv-neutral-300);
    --sv-info-solid: var(--sv-info-500);
    --sv-info-solid-fg: var(--sv-neutral-50);
  }`

/**
 * The always-present v1 token layer. Assembled from the `@source inline(...)`
 * safelist, the color + non-color `@theme` registrations, and the light/dark
 * value blocks. Pair with {@link ROLE_TOKEN_BRIDGE} (which supplies the light
 * values of the role tokens via author/legacy fallback chains).
 */
export const V1_TOKEN_LAYER = `@source inline("${CANONICAL_COLOR_UTILITIES} ${CANONICAL_FONT_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${V1_THEME_NONCOLOR_REGISTRATIONS}

  ${V1_ROOT_LIGHT}

  ${V1_ROOT_DARK}`

/**
 * The token-VOCABULARY half of {@link V1_TOKEN_LAYER}: the `@source inline(...)`
 * safelist plus the color + non-color `@theme` registration blocks, WITHOUT any
 * `:root` value block. This registers the canonical token names so the Tailwind
 * engine mints the `bg-*` / `text-*` / `border-*` / `ring-*` / `font-*` /
 * `text-{size}` utilities — which is what `generateBaseLayer`'s
 * `@apply text-foreground`, `@apply font-sans`, etc. require to resolve.
 *
 * Emitted under `ECO_DESIGN_LAYER=off` (see `buildDefaultLayer` in
 * `compiler.ts`). The VALUE blocks (`V1_ROOT_LIGHT` / `V1_ROOT_DARK` /
 * {@link ROLE_TOKEN_BRIDGE}) are the [internal ref] override surface and stay demoted, so
 * the canonical color tokens register to a now-undefined `--sv-*` indirection.
 * The prestyled-by-default islands paint via their own inline `withVarFallback`
 * literals (the `--sv-*` lookup is just an override hook), so the page still
 * renders styled. Keeping the registrations means the per-app compile no longer
 * crashes on `@apply <canonical-utility>` when the override surface is off —
 * letting layer-off compile per-app exactly like layer-on (the with≡without
 * parity contract, `contract-without-theme-layer.spec.ts`).
 */
export const V1_THEME_REGISTRATIONS = `@source inline("${CANONICAL_COLOR_UTILITIES} ${CANONICAL_FONT_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${V1_THEME_NONCOLOR_REGISTRATIONS}`

/**
 * Alias `var()` bridge — the critical artifact. Supplies the LIGHT-mode value of
 * each canonical `--sv-*` role var as a fallback chain:
 *
 *   author key  →  legacy component-layer name  →  v1 default
 *
 * `var()` late-binds at use-time, so the author's `@theme` (emitted later in the
 * pipeline, e.g. `--color-background: #fff`) still wins. The dark cascade in
 * {@link V1_ROOT_DARK} overrides `--sv-*` directly and is unaffected.
 *
 * ## Ambiguous-alias decisions (revisit at pilot review)
 *
 *  - `card → bg-raised` — cards are elevated surfaces.
 *  - `popover → bg-overlay`.
 *  - `input` border → `--sv-border` (v1 has no dedicated `input` token).
 *  - `muted → bg-subtle`, `muted-foreground → fg-muted`.
 *  - `ring → focus-ring`.
 *  - Author single-hue semantics (`success` / `warning` / `error` /
 *    `destructive`) map to the `-solid` slot ONLY; the `-bg` / `-border` / `-fg`
 *    slots keep their v1 ramp defaults (a partial override; v1 fills the rest).
 *  - Canonical danger name: islands consume v1's `error-*` directly. `danger` /
 *    `destructive` are treated as author-override aliases onto `error-solid`.
 */
export const ROLE_TOKEN_BRIDGE = `:root {
    /* Surface roles.
       Neutral defaults are used directly (no var(--color-background, ...)
       self-reference) to avoid the --color-background to --sv-bg to
       --color-background custom-property CYCLE that left text-background on
       bg-primary invalid-at-computed-value in zero-config — surface inherited
       --sv-fg (near-black) and primary buttons rendered black-on-black in
       light mode. The --color-muted / --color-card / --color-popover author
       keys are NOT registered back to --sv-bg-* (no forward alias), but the
       same pattern is applied for symmetry with the border/foreground/primary
       roles above. Author override of --color-background still reaches every
       bg-background utility directly via the registration in
       V1_THEME_COLOR_REGISTRATIONS. */
    --sv-bg: var(--sv-neutral-50);
    --sv-bg-subtle: var(--sv-neutral-100);
    --sv-bg-raised: oklch(0.995 0 0);
    --sv-bg-overlay: oklch(0.995 0 0);

    /* Border roles.
       NOTE: sv-border/-strong/-inverse use the v1 neutral default DIRECTLY
       (no var(--color-border, ...) self-reference). The canonical
       --color-border token is registered in V1_THEME_COLOR_REGISTRATIONS as
       --color-border: var(--sv-border); pulling it back in here as the
       bridge's own author key would form a --color-border to --sv-border to
       --color-border custom-property CYCLE that the engine resolves to NOTHING
       (transparent/empty) in zero-config — the exact unstyled footgun these
       contracts guard against. Author override still works: an author
       --color-border value overrides the registration default directly, so
       border-border (which reads var(--color-border)) picks it up without the
       bridge needing to re-alias it. The --color-input alias is preserved as a
       non-cyclic author key. */
    --sv-border: var(--color-input, var(--sv-neutral-200));
    --sv-border-strong: var(--sv-neutral-300);
    --sv-border-inverse: var(--sv-neutral-900);

    /* Foreground roles.
       --sv-fg uses the neutral default directly (no var(--color-foreground, ...)
       self-reference) to avoid the --color-foreground to --sv-fg to
       --color-foreground custom-property CYCLE that resolved tooltip
       backgrounds to transparent in zero-config (see border/primary notes
       above). Author override of --color-foreground reaches every
       bg-foreground/text-foreground utility directly via the registration. */
    --sv-fg: var(--sv-neutral-950);
    /* fg-muted uses the v1 neutral default DIRECTLY (no var(--color-muted-foreground,
       …) self-reference) to avoid the --color-muted-foreground → --sv-fg-muted →
       --color-muted-foreground CYCLE now that --color-muted-foreground is a
       registered shadcn alias (DEC-060). Author override still flows through
       --sv-fg-muted directly via generateAuthorSvBridge. */
    --sv-fg-muted: var(--sv-neutral-600);
    /* fg-subtle/-disabled/-inverse use the neutral default directly to avoid
       the --color-foreground-* to --sv-fg-* to --color-foreground-* cycle (see border note
       above). Author override still flows through --color-foreground-*. */
    /* fg-subtle is a TEXT token, so it is pinned slightly darker than
       --sv-neutral-500 (oklch L 0.56) to clear WCAG AA (>= 4.5:1) on
       bg-background in light mode while staying clearly lighter than fg-muted. */
    --sv-fg-subtle: oklch(0.54 0 0);
    --sv-fg-disabled: var(--sv-neutral-400);
    --sv-fg-inverse: var(--sv-neutral-50);

    /* Primary.
       Neutral defaults are used directly (no var(--color-primary, ...)
       self-reference) to avoid the --color-primary to --sv-primary to
       --color-primary cycle that left bg-primary transparent in zero-config.
       --sv-primary-fg likewise uses the neutral default DIRECTLY: as of DEC-060
       --color-primary-foreground is a REGISTERED shadcn alias
       (--color-primary-foreground: var(--sv-primary-fg)), so reading it back as
       this role's fallback would form a --color-primary-foreground → --sv-primary-fg
       → --color-primary-foreground cycle. Author override of primary-foreground
       reaches --sv-primary-fg directly via generateAuthorSvBridge. */
    --sv-primary: var(--sv-neutral-900);
    --sv-primary-hover: var(--sv-neutral-800);
    --sv-primary-active: var(--sv-neutral-950);
    --sv-primary-fg: var(--sv-neutral-50);
    --sv-primary-subtle: var(--sv-neutral-100);
    --sv-primary-subtle-fg: var(--sv-neutral-900);

    /* Chart series palette — slot N paints series index N-1.

       Slot 1 is the anchor: when the app declares a theme primary,
       generateAuthorSvBridge re-points it at that colour, so the
       overwhelmingly common single-series chart is on-brand with no config.
       It is NOT written as var(--sv-primary, …) here, because the zero-config
       primary is a near-black neutral — correct for a button, unreadable as a
       chart. An unthemed chart therefore keeps the blue it has always had.

       Slots 2-5 are a fixed CATEGORICAL ramp, never derived from the theme: a
       ramp of one hue's lightness steps collapses under deuteranopia and on
       small bars, and a multi-series chart is unreadable the moment two series
       cannot be told apart. Distinguishability wins over palette purity. */
    --sv-chart-1: #3b82f6;
    --sv-chart-2: #ef4444;
    --sv-chart-3: #10b981;
    --sv-chart-4: #f59e0b;
    --sv-chart-5: #8b5cf6;

    /* Focus ring */
    --sv-focus-ring: var(--color-ring, var(--sv-neutral-900));


    /* Success — author 'success' overrides the -solid slot only */
    --sv-success-bg: var(--sv-success-100);
    --sv-success-border: var(--sv-success-300);
    --sv-success-fg: var(--sv-success-700);
    --sv-success-solid: var(--color-success, var(--sv-success-600));
    --sv-success-solid-fg: var(--sv-neutral-50);

    /* Warning */
    --sv-warning-bg: var(--sv-warning-100);
    --sv-warning-border: var(--sv-warning-300);
    --sv-warning-fg: var(--sv-warning-700);
    --sv-warning-solid: var(--color-warning, var(--sv-warning-500));
    --sv-warning-solid-fg: var(--sv-warning-950);

    /* Error — author 'danger'/'error' override the -solid slot via --color-error.
       The --color-destructive / --color-destructive-foreground shadcn names are
       NO LONGER read here: as of DEC-060 they are registered aliases
       (--color-destructive: var(--sv-error-solid)), so reading them back as this
       role's fallback would form a --color-destructive → --sv-error-solid →
       --color-destructive cycle. A destructive author override reaches
       --sv-error-solid directly via generateAuthorSvBridge. */
    --sv-error-bg: var(--sv-error-100);
    --sv-error-border: var(--sv-error-300);
    --sv-error-fg: var(--sv-error-700);
    --sv-error-solid: var(--color-error, var(--sv-error-600));
    --sv-error-solid-fg: var(--sv-neutral-50);

    /* Info */
    --sv-info-bg: var(--sv-info-100);
    --sv-info-border: var(--sv-info-300);
    --sv-info-fg: var(--sv-info-700);
    --sv-info-solid: var(--color-info, var(--sv-info-600));
    --sv-info-solid-fg: var(--sv-neutral-50);
  }`

/**
 * `:root` block holding the NEUTRAL-FLOOR light values for the `--sv-*` ramps —
 * grayscale, no warm cast, system fonts implied. Used by
 * {@link NEUTRAL_FLOOR_LAYER} when `theme.baseline === 'replace'`.
 */
const NEUTRAL_FLOOR_ROOT_LIGHT = `:root {
    color-scheme: light;

    /* Plain grayscale ramp (no warm cast) */
    --sv-neutral-50: #fafafa;
    --sv-neutral-100: #f5f5f5;
    --sv-neutral-200: #e5e5e5;
    --sv-neutral-300: #d4d4d4;
    --sv-neutral-400: #a3a3a3;
    --sv-neutral-500: #737373;
    --sv-neutral-600: #525252;
    --sv-neutral-700: #404040;
    --sv-neutral-800: #262626;
    --sv-neutral-900: #171717;
    --sv-neutral-950: #0a0a0a;

    /* Neutral semantic hues — desaturated, generic */

    --sv-success-50: var(--sv-neutral-50);
    --sv-success-100: var(--sv-neutral-100);
    --sv-success-300: var(--sv-neutral-300);
    --sv-success-500: var(--sv-neutral-500);
    --sv-success-600: var(--sv-neutral-600);
    --sv-success-700: var(--sv-neutral-700);
    --sv-success-950: var(--sv-neutral-950);

    --sv-warning-50: var(--sv-neutral-50);
    --sv-warning-100: var(--sv-neutral-100);
    --sv-warning-300: var(--sv-neutral-300);
    --sv-warning-500: var(--sv-neutral-500);
    --sv-warning-700: var(--sv-neutral-700);
    --sv-warning-950: var(--sv-neutral-950);

    --sv-error-50: #fef2f2;
    --sv-error-100: #fee2e2;
    --sv-error-300: #fca5a5;
    --sv-error-500: #ef4444;
    --sv-error-600: #dc2626;
    --sv-error-700: #b91c1c;
    --sv-error-950: #450a0a;

    --sv-info-50: var(--sv-neutral-50);
    --sv-info-100: var(--sv-neutral-100);
    --sv-info-300: var(--sv-neutral-300);
    --sv-info-500: var(--sv-neutral-500);
    --sv-info-600: var(--sv-neutral-600);
    --sv-info-700: var(--sv-neutral-700);
    --sv-info-950: var(--sv-neutral-950);

    /* Scrim — mode-invariant dark modal backdrop (see V1_ROOT_LIGHT). */
    --sv-scrim: var(--sv-neutral-950);
  }`

/**
 * Dark cascade for the neutral floor — same role re-pointing as v1's dark
 * cascade but on the grayscale ramp.
 */
const NEUTRAL_FLOOR_ROOT_DARK = `html:is(.dark, [data-theme='dark']) {
    color-scheme: dark;

    --sv-bg: var(--sv-neutral-950);
    --sv-bg-subtle: var(--sv-neutral-900);
    --sv-bg-raised: var(--sv-neutral-900);
    --sv-bg-overlay: var(--sv-neutral-800);

    --sv-border: var(--sv-neutral-800);
    --sv-border-strong: var(--sv-neutral-700);
    --sv-border-inverse: var(--sv-neutral-50);

    --sv-fg: var(--sv-neutral-50);
    --sv-fg-muted: var(--sv-neutral-400);
    --sv-fg-subtle: var(--sv-neutral-500);
    --sv-fg-disabled: var(--sv-neutral-700);
    --sv-fg-inverse: var(--sv-neutral-950);

    --sv-primary: var(--sv-neutral-50);
    --sv-primary-hover: var(--sv-neutral-200);
    --sv-primary-active: #ffffff;
    --sv-primary-fg: var(--sv-neutral-950);
    --sv-primary-subtle: var(--sv-neutral-800);
    --sv-primary-subtle-fg: var(--sv-neutral-50);

    --sv-focus-ring: var(--sv-neutral-50);

    --sv-success-bg: var(--sv-success-950);
    --sv-success-border: var(--sv-neutral-700);
    --sv-success-fg: var(--sv-neutral-300);
    --sv-success-solid: var(--sv-success-500);
    --sv-success-solid-fg: var(--sv-neutral-950);

    --sv-warning-bg: var(--sv-warning-950);
    --sv-warning-border: var(--sv-neutral-700);
    --sv-warning-fg: var(--sv-neutral-300);
    --sv-warning-solid: var(--sv-warning-500);
    --sv-warning-solid-fg: var(--sv-warning-950);

    --sv-error-bg: var(--sv-error-950);
    --sv-error-border: #991b1b;
    --sv-error-fg: #fca5a5;
    --sv-error-solid: var(--sv-error-500);
    --sv-error-solid-fg: var(--sv-neutral-50);

    --sv-info-bg: var(--sv-info-950);
    --sv-info-border: var(--sv-neutral-700);
    --sv-info-fg: var(--sv-neutral-300);
    --sv-info-solid: var(--sv-info-500);
    --sv-info-solid-fg: var(--sv-neutral-50);
  }`

/**
 * `@theme` block registering the non-color tokens for the neutral floor —
 * system fonts (no self-hosted faces), same scales as v1 so layout/spacing/
 * radius utilities still resolve. Shadows are plain gray.
 */
const NEUTRAL_FLOOR_NONCOLOR = `@theme {
    --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    --font-display: var(--font-sans);

    --font-size-2xs: 0.6875rem;
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.8125rem;
    --font-size-base: 0.875rem;
    --font-size-md: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    --font-size-2xl: 1.5rem;
    --font-size-3xl: 1.875rem;
    --font-size-4xl: 2.25rem;
    --font-size-5xl: 3rem;
    --font-size-6xl: 3.75rem;

    --font-weight-regular: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;

    --line-height-none: 1;
    --line-height-tight: 1.1;
    --line-height-snug: 1.25;
    --line-height-normal: 1.5;
    --line-height-relaxed: 1.625;

    --radius-none: 0px;
    --radius-sm: 2px;
    --radius-base: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    --radius-xl: 12px;
    --radius-full: 9999px;

    --shadow-none: none;
    --shadow-xs: 0 1px 0 0 rgb(0 0 0 / 0.04);
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 1px -1px rgb(0 0 0 / 0.04);
    --shadow-md: 0 4px 12px -2px rgb(0 0 0 / 0.07), 0 2px 4px -1px rgb(0 0 0 / 0.04);
    --shadow-lg: 0 12px 28px -4px rgb(0 0 0 / 0.09), 0 4px 8px -2px rgb(0 0 0 / 0.04);
    --shadow-xl: 0 24px 48px -8px rgb(0 0 0 / 0.13), 0 8px 16px -4px rgb(0 0 0 / 0.06);
  }`

/**
 * The neutral-floor layer used when `theme.baseline === 'replace'`. Defines the
 * SAME canonical token set as {@link V1_TOKEN_LAYER} (so components never render
 * unstyled) but with neutral grayscale values + system fonts + a dark cascade.
 * Pair with {@link ROLE_TOKEN_BRIDGE} (which still supplies role-token light
 * values via author/legacy fallbacks onto the neutral ramps defined here).
 */
export const NEUTRAL_FLOOR_LAYER = `@source inline("${CANONICAL_COLOR_UTILITIES} ${CANONICAL_FONT_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${NEUTRAL_FLOOR_NONCOLOR}

  ${NEUTRAL_FLOOR_ROOT_LIGHT}

  ${NEUTRAL_FLOOR_ROOT_DARK}`
