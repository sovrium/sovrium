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
  'bg-success-50',
  'bg-success-100',
  'bg-success-300',
  'bg-success-500',
  'bg-success-600',
  'bg-success-700',
  'bg-success-950',
  'bg-warning-bg',
  'bg-warning-solid',
  'text-warning-fg',
  'text-warning-solid-fg',
  'border-warning-border',
  'bg-warning-50',
  'bg-warning-100',
  'bg-warning-300',
  'bg-warning-500',
  'bg-warning-700',
  'bg-warning-950',
  'bg-error-bg',
  'bg-error-solid',
  'text-error-fg',
  'text-error-solid-fg',
  'border-error-border',
  'bg-error-50',
  'bg-error-100',
  'bg-error-300',
  'bg-error-500',
  'bg-error-600',
  'bg-error-700',
  'bg-error-950',
  'bg-info-bg',
  'bg-info-solid',
  'text-info-fg',
  'text-info-solid-fg',
  'border-info-border',
  'bg-info-50',
  'bg-info-100',
  'bg-info-300',
  'bg-info-500',
  'bg-info-600',
  'bg-info-700',
  'bg-info-950',
].join(' ')

const CANONICAL_FONT_UTILITIES = ['font-sans', 'font-mono', 'font-serif'].join(' ')

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
    --sv-fg-subtle: oklch(0.59 0.011 60);
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

export const V1_TOKEN_LAYER = `@source inline("${CANONICAL_COLOR_UTILITIES} ${CANONICAL_FONT_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${V1_THEME_NONCOLOR_REGISTRATIONS}

  ${V1_ROOT_LIGHT}

  ${V1_ROOT_DARK}`

export const V1_THEME_REGISTRATIONS = `@source inline("${CANONICAL_COLOR_UTILITIES} ${CANONICAL_FONT_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${V1_THEME_NONCOLOR_REGISTRATIONS}`

export const V1_ALIAS_BRIDGE = `:root {
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
    --sv-bg-raised: oklch(0.995 0.002 75);
    --sv-bg-overlay: oklch(0.995 0.002 75);

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
    /* fg-subtle is a TEXT token, so it is pinned slightly darker than
       --sv-neutral-500 (oklch L 0.56) to clear WCAG AA (>= 4.5:1) on
       bg-background in light mode while staying clearly lighter than fg-muted. */
    --sv-fg-subtle: oklch(0.54 0.011 60);
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

    --sv-success-50: #f0fdf4;
    --sv-success-100: #dcfce7;
    --sv-success-300: #86efac;
    --sv-success-500: #22c55e;
    --sv-success-600: #16a34a;
    --sv-success-700: #15803d;
    --sv-success-950: #052e16;

    --sv-warning-50: #fefce8;
    --sv-warning-100: #fef9c3;
    --sv-warning-300: #fde047;
    --sv-warning-500: #eab308;
    --sv-warning-700: #a16207;
    --sv-warning-950: #422006;

    --sv-error-50: #fef2f2;
    --sv-error-100: #fee2e2;
    --sv-error-300: #fca5a5;
    --sv-error-500: #ef4444;
    --sv-error-600: #dc2626;
    --sv-error-700: #b91c1c;
    --sv-error-950: #450a0a;

    --sv-info-50: #eff6ff;
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

export const NEUTRAL_FLOOR_LAYER = `@source inline("${CANONICAL_COLOR_UTILITIES} ${CANONICAL_FONT_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${NEUTRAL_FLOOR_NONCOLOR}

  ${NEUTRAL_FLOOR_ROOT_LIGHT}

  ${NEUTRAL_FLOOR_ROOT_DARK}`

export const SOURCE_SERIF_ITALIC_FONT_FACE = `@font-face {
    font-family: 'Source Serif 4 Variable';
    src: url('data:font/woff2;base64,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') format('woff2');
    font-weight: 200 900;
    font-style: italic;
    font-display: swap;
  }`
