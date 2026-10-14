/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The default CSS token layer — every block Sovrium emits for an app that declares no design.
 *
 * AUTO-GENERATED from `[internal ref]` — DO NOT EDIT.
 *
 * Regenerate: `bun run build:default-design`
 */

const CANONICAL_COLOR_UTILITIES =
  'bg-neutral-50 bg-neutral-100 bg-neutral-200 bg-neutral-300 bg-neutral-400 bg-neutral-500 bg-neutral-600 bg-neutral-700 bg-neutral-800 bg-neutral-900 bg-neutral-950 text-neutral-500 text-neutral-600 text-neutral-700 text-neutral-900 text-neutral-950 border-neutral-200 border-neutral-300 bg-background bg-background-inset bg-foreground text-background border-border border-border-strong border-border-inverse divide-border bg-border bg-border-strong text-foreground text-foreground-subtle text-foreground-disabled text-foreground-inverse text-foreground-humane bg-primary bg-primary-hover bg-primary-active bg-primary-subtle text-primary text-primary-subtle-fg border-primary border-ring bg-success-bg bg-success-solid text-success-fg text-success-solid-fg border-success-border bg-success-50 bg-success-100 bg-success-300 bg-success-500 bg-success-600 bg-success-700 bg-success-950 bg-warning-bg bg-warning-solid text-warning-fg text-warning-solid-fg border-warning-border bg-warning-50 bg-warning-100 bg-warning-300 bg-warning-500 bg-warning-700 bg-warning-950 bg-error-bg text-error-fg text-error-solid-fg border-error-border bg-error-50 bg-error-100 bg-error-300 bg-error-500 bg-error-600 bg-error-700 bg-error-950 bg-info-bg bg-info-solid text-info-fg text-info-solid-fg border-info-border bg-info-50 bg-info-100 bg-info-300 bg-info-500 bg-info-600 bg-info-700 bg-info-950 text-primary-foreground bg-card bg-muted text-muted-foreground bg-popover bg-destructive text-destructive-foreground text-card-foreground text-popover-foreground bg-secondary text-secondary-foreground bg-accent text-accent-foreground border-input ring-ring bg-chart-1 bg-chart-2 bg-chart-3 bg-chart-4 bg-chart-5 bg-sidebar text-sidebar-foreground bg-sidebar-primary text-sidebar-primary-foreground bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border ring-sidebar-ring'

const CANONICAL_FONT_UTILITIES = 'font-sans font-mono'

export const V1_THEME_COLOR_REGISTRATIONS = `@theme {
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
    --color-background: var(--background);
    --color-background-inset: var(--sv-bg-inset);

    /* Border roles */
    --color-border: var(--border);
    --color-border-strong: var(--sv-border-strong);
    --color-border-inverse: var(--sv-border-inverse);

    /* Foreground roles */
    --color-foreground: var(--foreground);
    --color-foreground-subtle: var(--sv-fg-subtle);
    --color-foreground-disabled: var(--sv-fg-disabled);
    --color-foreground-inverse: var(--sv-fg-inverse);

    /* Primary */
    --color-primary: var(--primary);
    --color-primary-hover: var(--sv-primary-hover);
    --color-primary-active: var(--sv-primary-active);
    --color-primary-subtle: var(--sv-primary-subtle);
    --color-primary-subtle-fg: var(--sv-primary-subtle-fg);

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

    /* shadcn-convention utilities. Each name base-nova declares reads its
       shadcn variable (text-primary-foreground / bg-card / bg-muted /
       text-muted-foreground / bg-popover / bg-destructive), so the default theme
       mints them even when no scanned config names them. destructive-foreground
       has no base-nova variable and reads the --sv-error-solid-fg extension role.
       The --sv-* aliases these used to read left in P10. */
    --color-primary-foreground: var(--primary-foreground);
    --color-card: var(--card);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --color-popover: var(--popover);
    --color-destructive: var(--destructive);
    --color-destructive-foreground: var(--sv-error-solid-fg);

    /* shadcn colour variables, registered under their own names */
    --color-card-foreground: var(--card-foreground);
    --color-popover-foreground: var(--popover-foreground);
    --color-secondary: var(--secondary);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-accent: var(--accent);
    --color-accent-foreground: var(--accent-foreground);
    --color-input: var(--input);
    --color-ring: var(--ring);
    --color-chart-1: var(--chart-1);
    --color-chart-2: var(--chart-2);
    --color-chart-3: var(--chart-3);
    --color-chart-4: var(--chart-4);
    --color-chart-5: var(--chart-5);
    --color-sidebar: var(--sidebar);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-ring: var(--sidebar-ring);
  }`

const V1_THEME_NONCOLOR_REGISTRATIONS = `@theme {
    /* ---------- Typography ---------- */
    --font-sans: 'Geist Variable', sans-serif;
    --font-mono: 'Geist Mono Variable', monospace;
    --font-display: var(--font-sans);

    --text-2xs: 0.625rem;
    --text-2xs--line-height: calc(0.875 / 0.625);
    --text-xs: 0.6875rem;
    --text-xs--line-height: calc(1 / 0.6875);
    --text-sm: 0.75rem;
    --text-sm--line-height: calc(1.125 / 0.75);
    --text-base: 0.8125rem;
    --text-base--line-height: calc(1.25 / 0.8125);
    --text-md: 0.875rem;
    --text-md--line-height: calc(1.375 / 0.875);
    --text-lg: 1rem;
    --text-lg--line-height: calc(1.5 / 1);
    --text-xl: 1.125rem;
    --text-xl--line-height: calc(1.75 / 1.125);
    --text-2xl: 1.25rem;
    --text-2xl--line-height: calc(1.75 / 1.25);
    --text-3xl: 1.5rem;
    --text-3xl--line-height: calc(2 / 1.5);
    --text-4xl: 1.875rem;
    --text-4xl--line-height: calc(2.25 / 1.875);
    --text-5xl: 2.5rem;
    --text-5xl--line-height: 1;
    --text-6xl: 3rem;
    --text-6xl--line-height: 1;

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
    --radius-sm: calc(var(--radius, 0.625rem) * 0.6);
    --radius-base: 4px;
    --radius-md: calc(var(--radius, 0.625rem) * 0.8);
    --radius-lg: var(--radius, 0.625rem);
    --radius-xl: calc(var(--radius, 0.625rem) * 1.4);
    --radius-2xl: calc(var(--radius, 0.625rem) * 1.8);
    --radius-3xl: calc(var(--radius, 0.625rem) * 2.2);
    --radius-4xl: calc(var(--radius, 0.625rem) * 2.6);
    --radius-full: 9999px;

    /* ---------- Shadows ---------- */
    --shadow-none: none;
    --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.08);
    --shadow-md: 0 4px 12px rgb(0 0 0 / 0.06);
    --shadow-lg: 0 8px 24px rgb(0 0 0 / 0.12);

    /* ---------- Motion ---------- */
    --duration-fast: 120ms;
    --duration-base: 180ms;
    --duration-slow: 260ms;

    --ease-default: cubic-bezier(0.2, 0, 0, 1);
    --ease-enter: cubic-bezier(0, 0, 0.2, 1);
    --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  }`

export const V1_ROOT_LIGHT = `:root {
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

    /* Error — the ONE hue the system spends on consequence, so it is the one
       ramp written as exact sRGB rather than as a formula. Four steps are the
       reference values verbatim: 100 is the alert ground, 300 its hairline,
       600 the solid, 700 the text. The remaining three are interpolated on the
       same hue (~32) and chroma envelope so the ladder stays one family.

       Warmer and less saturated than the ramp it replaces (hue 25, chroma up
       to 0.205): at that chroma a destructive button reads as an alarm rather
       than as a consequence, and next to the neutral ramp it fluoresced. */
    --sv-error-50: #fefbfa;
    --sv-error-100: #fdf5f3;
    --sv-error-300: #f0c8bd;
    --sv-error-500: #dc472e;
    --sv-error-600: #c13520;
    --sv-error-700: #a12b1a;
    --sv-error-950: #3d0e08;

    --sv-info-50: var(--sv-neutral-50);
    --sv-info-100: var(--sv-neutral-200);
    --sv-info-300: var(--sv-neutral-300);
    --sv-info-500: var(--sv-neutral-500);
    /* Info's SOLID step, and only this step, carries a hue: --sv-info-solid
       refs 600, so this is what an informational mark is painted with. The
       rest of this ramp stays monochrome on purpose: an informational surface
       is a hairline on a neutral well carrying a coloured mark, not a blue
       box. */
    --sv-info-600: #398ad6;
    --sv-info-700: var(--sv-neutral-600);
    --sv-info-950: var(--sv-neutral-900);

    /* Humane fg — literal, no author alias */

    /* shadcn 4.21.4, base-nova neutral, light — scripts/baselines/shadcn-registry */
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    --chart-1: #d4d4d4;
    --chart-2: #737373;
    --chart-3: #525252;
    --chart-4: #404040;
    --chart-5: #262626;
    --radius: 0.625rem;
    --sidebar: oklch(0.985 0 0);
    --sidebar-foreground: oklch(0.145 0 0);
    --sidebar-primary: oklch(0.205 0 0);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.97 0 0);
    --sidebar-accent-foreground: oklch(0.205 0 0);
    --sidebar-border: oklch(0.922 0 0);
    --sidebar-ring: oklch(0.708 0 0);
  }`

export const V1_ROOT_DARK = `html:is(.dark, [data-theme='dark']) {
    color-scheme: dark;

    --sv-bg-inset: oklch(0.289 0 0);

    --sv-border-strong: var(--sv-neutral-700);
    --sv-border-inverse: var(--sv-neutral-50);
    /* fg-subtle is a TEXT token, so it is pinned slightly lighter than
       --sv-neutral-500 (oklch L 0.56) to clear WCAG AA (>= 4.5:1) on
       bg-background in dark mode while staying clearly darker than fg-muted. */
    --sv-fg-subtle: oklch(0.59 0 0);
    /* fg-disabled sat on neutral-700, the SAME step as border-strong, so
       disabled ink and the strongest rule in the system were one colour,
       and disabled text read at 1.95:1 on the page, below the 2.48:1 its
       light counterpart gets. 0.475 is the reference drawing verbatim
       (oklch(0.475 0 0) renders #5c5c5c, the drawing hex): it clears
       border-strong by 0.100 L, stays 0.115 L under fg-subtle, and lifts
       disabled ink to 2.98:1 — still plainly disabled, no longer illegible.
       (Founder call, 2026-09-10.) */
    --sv-fg-disabled: oklch(0.475 0 0);
    --sv-fg-inverse: var(--sv-neutral-950);

    --sv-primary-hover: var(--sv-neutral-200);
    --sv-primary-active: oklch(1 0 0);
    --sv-primary-subtle: var(--sv-neutral-800);
    --sv-primary-subtle-fg: var(--sv-neutral-50);


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

    --sv-error-bg: #3a2323;
    --sv-error-border: #6b3a32;
    --sv-error-fg: #e88a79;
    --sv-error-solid-fg: var(--sv-neutral-950);

    --sv-info-bg: var(--sv-info-950);
    --sv-info-border: var(--sv-neutral-700);
    --sv-info-fg: var(--sv-neutral-300);
    --sv-info-solid: #398ad6;
    --sv-info-solid-fg: var(--sv-neutral-50);

    /* shadcn 4.21.4, base-nova neutral, dark — scripts/baselines/shadcn-registry */
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: #d4d4d4;
    --chart-2: #737373;
    --chart-3: #525252;
    --chart-4: #404040;
    --chart-5: #262626;
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
  }`

export const V1_ROOT_DENSITY = `:root {
    --sv-density-row-y: 5px;
    --sv-density-control-h: 36px;
    --sv-density-button-h: 28px;
    --sv-density-gap: 7px;
    --sv-density-text: 11px;
  }`

const V1_DENSITY_STEP_BLOCKS = `[data-density='cozy'] {
    --sv-density-row-y: 8px;
    --sv-density-control-h: 40px;
    --sv-density-button-h: 32px;
    --sv-density-gap: 10px;
    --sv-density-text: 13px;
  }

  [data-density='roomy'] {
    --sv-density-row-y: 14px;
    --sv-density-control-h: 44px;
    --sv-density-button-h: 36px;
    --sv-density-gap: 16px;
    --sv-density-text: 14px;
  }`

export const V1_DENSITY_LAYER = `${V1_ROOT_DENSITY}

  ${V1_DENSITY_STEP_BLOCKS}`

export const V1_TOKEN_LAYER = `@source inline("${CANONICAL_COLOR_UTILITIES} ${CANONICAL_FONT_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${V1_THEME_NONCOLOR_REGISTRATIONS}

  ${V1_ROOT_LIGHT}

  ${V1_ROOT_DARK}

  ${V1_DENSITY_LAYER}`

export const V1_THEME_REGISTRATIONS = `@source inline("${CANONICAL_COLOR_UTILITIES} ${CANONICAL_FONT_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${V1_THEME_NONCOLOR_REGISTRATIONS}`

export const ROLE_TOKEN_BRIDGE = `:root {
    /* Inset — the fourth ground, and the only one that goes DOWN.
       raised and overlay sit above the page; subtle is the page, quieter. Inset
       is a hole in it: a gutter, a disabled control fill, the well a frozen
       table column casts its shadow into. Those were being painted with
       bg-subtle, which made a recess and a panel the same colour and left the
       recess reading as a slightly grubby card. */
    --sv-bg-inset: oklch(0.952 0 0);

    --sv-border-strong: var(--sv-neutral-300);
    --sv-border-inverse: var(--sv-neutral-900);
    /* fg-subtle is a TEXT token, so it is pinned slightly darker than
       --sv-neutral-500 (oklch L 0.56) to clear WCAG AA (>= 4.5:1) on
       bg-background in light mode while staying clearly lighter than fg-muted. */
    --sv-fg-subtle: oklch(0.54 0 0);
    --sv-fg-disabled: var(--sv-neutral-400);
    --sv-fg-inverse: var(--sv-neutral-50);

    --sv-primary-hover: var(--sv-neutral-800);
    --sv-primary-active: var(--sv-neutral-950);
    --sv-primary-subtle: var(--sv-neutral-100);
    --sv-primary-subtle-fg: var(--sv-neutral-900);




    /* Success — an authored 'success' reaches the -solid slot only, through the author bridge */
    --sv-success-bg: var(--sv-success-100);
    --sv-success-border: var(--sv-success-300);
    --sv-success-fg: var(--sv-success-700);
    --sv-success-solid: var(--sv-success-600);
    --sv-success-solid-fg: var(--sv-neutral-50);

    /* Warning */
    --sv-warning-bg: var(--sv-warning-100);
    --sv-warning-border: var(--sv-warning-300);
    --sv-warning-fg: var(--sv-warning-700);
    --sv-warning-solid: var(--sv-warning-500);
    --sv-warning-solid-fg: var(--sv-warning-950);

    --sv-error-bg: var(--sv-error-100);
    --sv-error-border: var(--sv-error-300);
    --sv-error-fg: var(--sv-error-700);
    --sv-error-solid-fg: var(--sv-neutral-50);

    /* Info */
    --sv-info-bg: var(--sv-info-100);
    --sv-info-border: var(--sv-info-300);
    --sv-info-fg: var(--sv-info-700);
    --sv-info-solid: var(--sv-info-600);
    --sv-info-solid-fg: var(--sv-neutral-50);
  }`

export const NEUTRAL_FLOOR_ROOT_LIGHT = `:root {
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

    /* shadcn 4.21.4, base-nova neutral, light — scripts/baselines/shadcn-registry */
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    --chart-1: #d4d4d4;
    --chart-2: #737373;
    --chart-3: #525252;
    --chart-4: #404040;
    --chart-5: #262626;
    --radius: 0.625rem;
    --sidebar: oklch(0.985 0 0);
    --sidebar-foreground: oklch(0.145 0 0);
    --sidebar-primary: oklch(0.205 0 0);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.97 0 0);
    --sidebar-accent-foreground: oklch(0.205 0 0);
    --sidebar-border: oklch(0.922 0 0);
    --sidebar-ring: oklch(0.708 0 0);
  }`

export const NEUTRAL_FLOOR_ROOT_DARK = `html:is(.dark, [data-theme='dark']) {
    color-scheme: dark;

    --sv-bg-inset: #2b2b2b;

    --sv-border-strong: var(--sv-neutral-700);
    --sv-border-inverse: var(--sv-neutral-50);

    --sv-fg-subtle: var(--sv-neutral-500);
    --sv-fg-disabled: #5c5c5c;
    --sv-fg-inverse: var(--sv-neutral-950);

    --sv-primary-hover: var(--sv-neutral-200);
    --sv-primary-active: #ffffff;
    --sv-primary-subtle: var(--sv-neutral-800);
    --sv-primary-subtle-fg: var(--sv-neutral-50);


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
    --sv-error-solid-fg: var(--sv-neutral-50);

    --sv-info-bg: var(--sv-info-950);
    --sv-info-border: var(--sv-neutral-700);
    --sv-info-fg: var(--sv-neutral-300);
    --sv-info-solid: var(--sv-info-500);
    --sv-info-solid-fg: var(--sv-neutral-50);

    /* shadcn 4.21.4, base-nova neutral, dark — scripts/baselines/shadcn-registry */
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: #d4d4d4;
    --chart-2: #737373;
    --chart-3: #525252;
    --chart-4: #404040;
    --chart-5: #262626;
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
  }`

const NEUTRAL_FLOOR_NONCOLOR = `@theme {
    --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    --font-display: var(--font-sans);

    --text-2xs: 0.625rem;
    --text-2xs--line-height: calc(0.875 / 0.625);
    --text-xs: 0.6875rem;
    --text-xs--line-height: calc(1 / 0.6875);
    --text-sm: 0.75rem;
    --text-sm--line-height: calc(1.125 / 0.75);
    --text-base: 0.8125rem;
    --text-base--line-height: calc(1.25 / 0.8125);
    --text-md: 0.875rem;
    --text-md--line-height: calc(1.375 / 0.875);
    --text-lg: 1rem;
    --text-lg--line-height: calc(1.5 / 1);
    --text-xl: 1.125rem;
    --text-xl--line-height: calc(1.75 / 1.125);
    --text-2xl: 1.25rem;
    --text-2xl--line-height: calc(1.75 / 1.25);
    --text-3xl: 1.5rem;
    --text-3xl--line-height: calc(2 / 1.5);
    --text-4xl: 1.875rem;
    --text-4xl--line-height: calc(2.25 / 1.875);
    --text-5xl: 2.5rem;
    --text-5xl--line-height: 1;
    --text-6xl: 3rem;
    --text-6xl--line-height: 1;

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
    --radius-sm: calc(var(--radius, 0.625rem) * 0.6);
    --radius-base: 4px;
    --radius-md: calc(var(--radius, 0.625rem) * 0.8);
    --radius-lg: var(--radius, 0.625rem);
    --radius-xl: calc(var(--radius, 0.625rem) * 1.4);
    --radius-2xl: calc(var(--radius, 0.625rem) * 1.8);
    --radius-3xl: calc(var(--radius, 0.625rem) * 2.2);
    --radius-4xl: calc(var(--radius, 0.625rem) * 2.6);
    --radius-full: 9999px;

    --shadow-none: none;
    --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.08);
    --shadow-md: 0 4px 12px rgb(0 0 0 / 0.06);
    --shadow-lg: 0 8px 24px rgb(0 0 0 / 0.12);
  }`

export const NEUTRAL_FLOOR_LAYER = `@source inline("${CANONICAL_COLOR_UTILITIES} ${CANONICAL_FONT_UTILITIES}");

  ${V1_THEME_COLOR_REGISTRATIONS}

  ${NEUTRAL_FLOOR_NONCOLOR}

  ${NEUTRAL_FLOOR_ROOT_LIGHT}

  ${NEUTRAL_FLOOR_ROOT_DARK}

  ${V1_DENSITY_LAYER}`
