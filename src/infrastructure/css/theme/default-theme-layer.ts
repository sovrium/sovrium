/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const CANONICAL_COLOR_UTILITIES = [
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
  'bg-background',
  'bg-background-subtle',
  'bg-background-raised',
  'bg-background-overlay',
  'bg-foreground',
  'text-background',
  'text-background-overlay',
  'bg-scrim',
  'bg-scrim/50',
  'border-border',
  'border-border-strong',
  'border-border-inverse',
  'divide-border',
  'bg-border',
  'bg-border-strong',
  'text-foreground',
  'text-foreground-muted',
  'text-foreground-subtle',
  'text-foreground-disabled',
  'text-foreground-inverse',
  'text-foreground-humane',
  'bg-primary',
  'bg-primary-hover',
  'bg-primary-active',
  'bg-primary-subtle',
  'text-primary',
  'text-primary-fg',
  'text-primary-subtle-fg',
  'border-primary',
  'ring-focus-ring',
  'border-focus-ring',
  'bg-warmth',
  'bg-warmth-subtle',
  'text-warmth',
  'text-warmth-fg',
  'border-warmth-border',
  'bg-success-bg',
  'bg-success-solid',
  'text-success-fg',
  'text-success-solid-fg',
  'border-success-border',
  'bg-warning-bg',
  'bg-warning-solid',
  'text-warning-fg',
  'text-warning-solid-fg',
  'border-warning-border',
  'bg-error-bg',
  'bg-error-solid',
  'text-error-fg',
  'text-error-solid-fg',
  'border-error-border',
  'bg-info-bg',
  'bg-info-solid',
  'text-info-fg',
  'text-info-solid-fg',
  'border-info-border',
].join(' ')

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
    --color-foreground-humane: var(--sv-fg-humane);

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
    --color-warmth: var(--sv-warmth);
    --color-warmth-fg: var(--sv-warmth-fg);
    --color-warmth-subtle: var(--sv-warmth-subtle);
    --color-warmth-border: var(--sv-warmth-border);

    /* Success */
    --color-success-bg: var(--sv-success-bg);
    --color-success-border: var(--sv-success-border);
    --color-success-fg: var(--sv-success-fg);
    --color-success-solid: var(--sv-success-solid);
    --color-success-solid-fg: var(--sv-success-solid-fg);

    /* Warning */
    --color-warning-bg: var(--sv-warning-bg);
    --color-warning-border: var(--sv-warning-border);
    --color-warning-fg: var(--sv-warning-fg);
    --color-warning-solid: var(--sv-warning-solid);
    --color-warning-solid-fg: var(--sv-warning-solid-fg);

    /* Error */
    --color-error-bg: var(--sv-error-bg);
    --color-error-border: var(--sv-error-border);
    --color-error-fg: var(--sv-error-fg);
    --color-error-solid: var(--sv-error-solid);
    --color-error-solid-fg: var(--sv-error-solid-fg);

    /* Info */
    --color-info-bg: var(--sv-info-bg);
    --color-info-border: var(--sv-info-border);
    --color-info-fg: var(--sv-info-fg);
    --color-info-solid: var(--sv-info-solid);
    --color-info-solid-fg: var(--sv-info-solid-fg);
  }`

const V1_THEME_NONCOLOR_REGISTRATIONS = `@theme {
    /* ---------- Typography ---------- */
    --font-sans: 'IBM Plex Sans Variable', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    --font-serif: 'Source Serif 4 Variable', 'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif;
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
    --shadow-xs: 0 1px 0 0 rgb(45 30 15 / 0.04);
    --shadow-sm: 0 1px 2px 0 rgb(45 30 15 / 0.05), 0 1px 1px -1px rgb(45 30 15 / 0.04);
    --shadow-md: 0 4px 12px -2px rgb(45 30 15 / 0.07), 0 2px 4px -1px rgb(45 30 15 / 0.04);
    --shadow-lg: 0 12px 28px -4px rgb(45 30 15 / 0.09), 0 4px 8px -2px rgb(45 30 15 / 0.04);
    --shadow-xl: 0 24px 48px -8px rgb(45 30 15 / 0.13), 0 8px 16px -4px rgb(45 30 15 / 0.06);

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

const V1_ROOT_LIGHT = `:root {
    color-scheme: light;

    /* ---------- Neutral ramp — warm cast ---------- */
    --sv-neutral-50: oklch(0.985 0.003 75);
    --sv-neutral-100: oklch(0.965 0.005 75);
    --sv-neutral-200: oklch(0.92 0.007 72);
    --sv-neutral-300: oklch(0.87 0.009 70);
    --sv-neutral-400: oklch(0.71 0.011 65);
    --sv-neutral-500: oklch(0.56 0.011 60);
    --sv-neutral-600: oklch(0.445 0.012 55);
    --sv-neutral-700: oklch(0.375 0.012 50);
    --sv-neutral-800: oklch(0.272 0.01 45);
    --sv-neutral-900: oklch(0.205 0.008 40);
    --sv-neutral-950: oklch(0.14 0.006 38);

    /* ---------- Warmth accent ---------- */
    --sv-warmth-50: oklch(0.975 0.012 50);
    --sv-warmth-100: oklch(0.945 0.025 50);
    --sv-warmth-300: oklch(0.81 0.075 50);
    --sv-warmth-500: oklch(0.62 0.1 50);
    --sv-warmth-700: oklch(0.47 0.085 48);
    --sv-warmth-900: oklch(0.31 0.055 45);
    --sv-warmth-950: oklch(0.215 0.04 45);

    /* ---------- Semantic ramps (locked) ---------- */
    --sv-success-50: oklch(0.975 0.02 152);
    --sv-success-100: oklch(0.945 0.045 152);
    --sv-success-300: oklch(0.81 0.13 150);
    --sv-success-500: oklch(0.62 0.165 148);
    --sv-success-600: oklch(0.54 0.15 148);
    --sv-success-700: oklch(0.45 0.13 148);
    --sv-success-950: oklch(0.215 0.055 148);

    --sv-warning-50: oklch(0.985 0.02 80);
    --sv-warning-100: oklch(0.96 0.045 80);
    --sv-warning-300: oklch(0.87 0.13 78);
    --sv-warning-500: oklch(0.76 0.155 72);
    --sv-warning-700: oklch(0.54 0.135 55);
    --sv-warning-950: oklch(0.245 0.06 50);

    --sv-error-50: oklch(0.975 0.015 25);
    --sv-error-100: oklch(0.945 0.04 25);
    --sv-error-300: oklch(0.81 0.135 25);
    --sv-error-500: oklch(0.605 0.205 25);
    --sv-error-600: oklch(0.53 0.195 25);
    --sv-error-700: oklch(0.455 0.17 25);
    --sv-error-950: oklch(0.225 0.08 25);

    --sv-info-50: oklch(0.975 0.015 240);
    --sv-info-100: oklch(0.945 0.035 240);
    --sv-info-300: oklch(0.81 0.115 240);
    --sv-info-500: oklch(0.61 0.165 240);
    --sv-info-600: oklch(0.53 0.18 240);
    --sv-info-700: oklch(0.455 0.15 240);
    --sv-info-950: oklch(0.225 0.07 240);

    /* Humane fg — literal, no author alias */
    --sv-fg-humane: oklch(0.3 0.02 45);

    /* Scrim — mode-invariant dark modal backdrop. Pinned to the darkest ramp
       step and intentionally NOT overridden in the dark cascade, so it stays a
       dark veil in both light and dark modes (unlike bg-foreground/50, which inverts). */
    --sv-scrim: var(--sv-neutral-950);
  }`

const V1_ROOT_DARK = `:where(.dark, [data-theme='dark']) {
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
    --sv-fg-humane: oklch(0.91 0.015 65);

    --sv-primary: var(--sv-neutral-50);
    --sv-primary-hover: var(--sv-neutral-200);
    --sv-primary-active: oklch(1 0 0);
    --sv-primary-fg: var(--sv-neutral-950);
    --sv-primary-subtle: var(--sv-neutral-800);
    --sv-primary-subtle-fg: var(--sv-neutral-50);

    --sv-focus-ring: var(--sv-neutral-50);

    --sv-warmth: var(--sv-warmth-500);
    --sv-warmth-fg: var(--sv-warmth-300);
    --sv-warmth-subtle: var(--sv-warmth-950);
    --sv-warmth-border: var(--sv-warmth-700);

    --sv-success-bg: var(--sv-success-950);
    --sv-success-border: oklch(0.37 0.105 148);
    --sv-success-fg: oklch(0.81 0.13 150);
    --sv-success-solid: var(--sv-success-500);
    --sv-success-solid-fg: var(--sv-neutral-950);

    --sv-warning-bg: var(--sv-warning-950);
    --sv-warning-border: oklch(0.43 0.11 50);
    --sv-warning-fg: oklch(0.87 0.13 78);
    --sv-warning-solid: oklch(0.82 0.155 75);
    --sv-warning-solid-fg: var(--sv-warning-950);

    --sv-error-bg: var(--sv-error-950);
    --sv-error-border: oklch(0.38 0.14 25);
    --sv-error-fg: oklch(0.81 0.135 25);
    --sv-error-solid: var(--sv-error-500);
    --sv-error-solid-fg: var(--sv-neutral-50);

    --sv-info-bg: var(--sv-info-950);
    --sv-info-border: oklch(0.38 0.125 240);
    --sv-info-fg: oklch(0.81 0.115 240);
    --sv-info-solid: var(--sv-info-500);
    --sv-info-solid-fg: var(--sv-neutral-50);
  }`

export const V1_TOKEN_LAYER = `@source inline("${CANONICAL_COLOR_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${V1_THEME_NONCOLOR_REGISTRATIONS}

  ${V1_ROOT_LIGHT}

  ${V1_ROOT_DARK}`

export const V1_ALIAS_BRIDGE = `:root {
    /* Surface roles */
    --sv-bg: var(--color-background, var(--sv-neutral-50));
    --sv-bg-subtle: var(--color-muted, var(--sv-neutral-100));
    --sv-bg-raised: var(--color-card, oklch(0.995 0.002 75));
    --sv-bg-overlay: var(--color-popover, oklch(0.995 0.002 75));

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
    --sv-fg-muted: var(--color-muted-foreground, var(--sv-neutral-600));
    /* fg-subtle/-disabled/-inverse use the neutral default directly to avoid
       the --color-foreground-* to --sv-fg-* to --color-foreground-* cycle (see border note
       above). Author override still flows through --color-foreground-*. */
    --sv-fg-subtle: var(--sv-neutral-500);
    --sv-fg-disabled: var(--sv-neutral-400);
    --sv-fg-inverse: var(--sv-neutral-50);
    /* --sv-fg-humane has a literal light value set in V1_ROOT_LIGHT */

    /* Primary.
       Neutral defaults are used directly (no var(--color-primary, ...)
       self-reference) to avoid the --color-primary to --sv-primary to
       --color-primary cycle that left bg-primary transparent in zero-config.
       --color-primary-foreground is a distinct author key (not a registered
       --color-primary-fg alias) so it stays a non-cyclic fallback. Author
       override of --color-primary reaches every bg-primary/text-primary
       utility directly via the registration. */
    --sv-primary: var(--sv-neutral-900);
    --sv-primary-hover: var(--sv-neutral-800);
    --sv-primary-active: var(--sv-neutral-950);
    --sv-primary-fg: var(--color-primary-foreground, var(--sv-neutral-50));
    --sv-primary-subtle: var(--sv-neutral-100);
    --sv-primary-subtle-fg: var(--sv-neutral-900);

    /* Focus ring */
    --sv-focus-ring: var(--color-ring, var(--sv-neutral-900));

    /* Warmth accent — neutral/ramp defaults used directly to avoid the
       --color-warmth* to --sv-warmth* to --color-warmth* cycle. */
    --sv-warmth: var(--sv-warmth-500);
    --sv-warmth-fg: var(--sv-warmth-700);
    --sv-warmth-subtle: var(--sv-warmth-100);
    --sv-warmth-border: var(--sv-warmth-300);

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

    /* Error — author 'destructive'/'danger'/'error' override the -solid slot */
    --sv-error-bg: var(--sv-error-100);
    --sv-error-border: var(--sv-error-300);
    --sv-error-fg: var(--sv-error-700);
    --sv-error-solid: var(--color-destructive, var(--color-error, var(--sv-error-600)));
    --sv-error-solid-fg: var(--color-destructive-foreground, var(--sv-neutral-50));

    /* Info */
    --sv-info-bg: var(--sv-info-100);
    --sv-info-border: var(--sv-info-300);
    --sv-info-fg: var(--sv-info-700);
    --sv-info-solid: var(--color-info, var(--sv-info-600));
    --sv-info-solid-fg: var(--sv-neutral-50);
  }`

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
    --sv-warmth-50: #faf8f5;
    --sv-warmth-100: #f0ece6;
    --sv-warmth-300: #c9bdab;
    --sv-warmth-500: #8a7a5f;
    --sv-warmth-700: #5c5340;
    --sv-warmth-900: #332e24;
    --sv-warmth-950: #1f1c16;

    --sv-success-100: #dcfce7;
    --sv-success-300: #86efac;
    --sv-success-500: #22c55e;
    --sv-success-600: #16a34a;
    --sv-success-700: #15803d;
    --sv-success-950: #052e16;

    --sv-warning-100: #fef9c3;
    --sv-warning-300: #fde047;
    --sv-warning-500: #eab308;
    --sv-warning-700: #a16207;
    --sv-warning-950: #422006;

    --sv-error-100: #fee2e2;
    --sv-error-300: #fca5a5;
    --sv-error-500: #ef4444;
    --sv-error-600: #dc2626;
    --sv-error-700: #b91c1c;
    --sv-error-950: #450a0a;

    --sv-info-100: #dbeafe;
    --sv-info-300: #93c5fd;
    --sv-info-500: #3b82f6;
    --sv-info-600: #2563eb;
    --sv-info-700: #1d4ed8;
    --sv-info-950: #172554;

    --sv-fg-humane: #404040;

    /* Scrim — mode-invariant dark modal backdrop (see V1_ROOT_LIGHT). */
    --sv-scrim: var(--sv-neutral-950);
  }`

const NEUTRAL_FLOOR_ROOT_DARK = `:where(.dark, [data-theme='dark']) {
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
    --sv-fg-humane: #d4d4d4;

    --sv-primary: var(--sv-neutral-50);
    --sv-primary-hover: var(--sv-neutral-200);
    --sv-primary-active: #ffffff;
    --sv-primary-fg: var(--sv-neutral-950);
    --sv-primary-subtle: var(--sv-neutral-800);
    --sv-primary-subtle-fg: var(--sv-neutral-50);

    --sv-focus-ring: var(--sv-neutral-50);

    --sv-warmth: var(--sv-warmth-500);
    --sv-warmth-fg: var(--sv-warmth-300);
    --sv-warmth-subtle: var(--sv-warmth-950);
    --sv-warmth-border: var(--sv-warmth-700);

    --sv-success-bg: var(--sv-success-950);
    --sv-success-border: #166534;
    --sv-success-fg: #86efac;
    --sv-success-solid: var(--sv-success-500);
    --sv-success-solid-fg: var(--sv-neutral-950);

    --sv-warning-bg: var(--sv-warning-950);
    --sv-warning-border: #854d0e;
    --sv-warning-fg: #fde047;
    --sv-warning-solid: var(--sv-warning-500);
    --sv-warning-solid-fg: var(--sv-warning-950);

    --sv-error-bg: var(--sv-error-950);
    --sv-error-border: #991b1b;
    --sv-error-fg: #fca5a5;
    --sv-error-solid: var(--sv-error-500);
    --sv-error-solid-fg: var(--sv-neutral-50);

    --sv-info-bg: var(--sv-info-950);
    --sv-info-border: #1e40af;
    --sv-info-fg: #93c5fd;
    --sv-info-solid: var(--sv-info-500);
    --sv-info-solid-fg: var(--sv-neutral-50);
  }`

const NEUTRAL_FLOOR_NONCOLOR = `@theme {
    --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    --font-serif: ui-serif, Georgia, 'Times New Roman', serif;
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

export const NEUTRAL_FLOOR_LAYER = `@source inline("${CANONICAL_COLOR_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${NEUTRAL_FLOOR_NONCOLOR}

  ${NEUTRAL_FLOOR_ROOT_LIGHT}

  ${NEUTRAL_FLOOR_ROOT_DARK}`
