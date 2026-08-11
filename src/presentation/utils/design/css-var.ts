/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Prestyled-by-default design tokens & helper.
 *
 * Every styled className in `src/presentation/islands/` should reference colors,
 * radii, shadows, and motion through the var-with-fallback pattern emitted by
 * {@link withVarFallback}. The OKLCH / rem / cubic-bezier LITERAL is the default
 * (bakes the Sovrium design into the island bundle); the CSS var name is the
 * override hook that `app.theme.*` and `default-theme-layer.ts` can rebind.
 *
 *   import { withVarFallback as v, TOKENS as T } from '@/presentation/utils/design/css-var'
 *
 *   <button className={cn(
 *     `rounded-[${v('sv-radius-md', T.radiusMd)}]`,
 *     `bg-[${v('sv-primary', T.primary)}]`,
 *     `text-[${v('sv-primary-fg', T.primaryFg)}]`,
 *     `shadow-[${v('sv-shadow-sm', T.shadowSm)}]`,
 *     'px-3 py-2'  // layout/spacing stays raw Tailwind
 *   )}/>
 *
 * The values below mirror the existing `V1_TOKEN_LAYER` in
 * `src/infrastructure/css/theme/default-theme-layer.ts` verbatim, so a tenant
 * who already overrides `--sv-*` sees the SAME computed value either way; only
 * the load-order story changes (the island carries its own default instead of
 * depending on the theme layer being emitted).
 *
 * NOTE: this module is intentionally plain TypeScript (no Effect). It is consumed
 * inside React render passes where pure synchronous helpers are appropriate.
 */

/**
 * Build a `var(--<name>,<fallback>)` expression suitable for a Tailwind
 * arbitrary-value class (`bg-[var(--sv-primary,oklch(0.62_0.18_265))]`).
 *
 * Tailwind's arbitrary-value parser splits on whitespace, so any space inside
 * the fallback (typical for OKLCH like `oklch(0.62 0.18 265)` or multi-stop
 * shadows like `0 1px 2px rgb(...)`) is rewritten to `_`. The browser CSS
 * tokenizer unescapes `_` back into a space when resolving `var()`, so the
 * runtime value is unchanged.
 */
export const withVarFallback = (varName: string, fallback: string): string =>
  `var(--${varName},${fallback.replace(/ /g, '_')})`

/**
 * Centralized OKLCH / rem / cubic-bezier token catalog.
 *
 * Mirrors `V1_TOKEN_LAYER` (`V1_ROOT_LIGHT` + `ROLE_TOKEN_BRIDGE` +
 * `V1_THEME_NONCOLOR_REGISTRATIONS`) so islands share one source of palette
 * values. Phase-5 demotion of the theme layer keeps the same numbers — the only
 * thing that changes is who's responsible for declaring them (the island file
 * via fallback vs the layer via `@theme`).
 *
 * Grouped by category. Keys are camelCase role names; values are the LIGHT-mode
 * defaults (the `:root` cascade) — the dark cascade flips them via `--sv-*`
 * overrides under `.dark`, which still wins because `var(--sv-X, light)` looks
 * up `--sv-X` first.
 */
export const TOKENS = {
  // ---------- Neutral ramp (warm cast) ----------
  neutral50: 'oklch(0.985 0 0)',
  neutral100: 'oklch(0.965 0 0)',
  neutral200: 'oklch(0.92 0 0)',
  neutral300: 'oklch(0.87 0 0)',
  neutral400: 'oklch(0.71 0 0)',
  neutral500: 'oklch(0.56 0 0)',
  neutral600: 'oklch(0.445 0 0)',
  neutral700: 'oklch(0.375 0 0)',
  neutral800: 'oklch(0.272 0 0)',
  neutral900: 'oklch(0.205 0 0)',
  neutral950: 'oklch(0.14 0 0)',

  // ---------- Surface roles ----------
  bg: 'oklch(0.985 0 0)', // neutral-50
  bgSubtle: 'oklch(0.965 0 0)', // neutral-100
  bgRaised: 'oklch(0.995 0 0)',
  bgOverlay: 'oklch(0.995 0 0)',
  scrim: 'oklch(0.14 0 0)', // neutral-950 (mode-invariant)

  // ---------- Border roles ----------
  border: 'oklch(0.92 0 0)', // neutral-200
  borderStrong: 'oklch(0.87 0 0)', // neutral-300
  borderInverse: 'oklch(0.205 0 0)', // neutral-900

  // ---------- Foreground roles ----------
  fg: 'oklch(0.14 0 0)', // neutral-950
  fgMuted: 'oklch(0.445 0 0)', // neutral-600
  fgSubtle: 'oklch(0.54 0 0)', // off-ramp: neutral-500 (0.56) computes 4.46:1 and fails AA
  fgDisabled: 'oklch(0.71 0 0)', // neutral-400
  fgInverse: 'oklch(0.985 0 0)', // neutral-50
  primary: 'oklch(0.205 0 0)', // neutral-900
  primaryHover: 'oklch(0.272 0 0)', // neutral-800
  primaryActive: 'oklch(0.14 0 0)', // neutral-950
  primaryFg: 'oklch(0.985 0 0)', // neutral-50
  primarySubtle: 'oklch(0.965 0 0)', // neutral-100
  primarySubtleFg: 'oklch(0.205 0 0)', // neutral-900

  // ---------- Focus ring ----------
  focusRing: 'oklch(0.205 0 0)', // neutral-900 by default

  // ---------- Warmth accent ----------

  // ---------- Semantic — Success ----------
  success50: 'oklch(0.985 0 0)',
  success100: 'oklch(0.925 0 0)',
  success300: 'oklch(0.87 0 0)',
  success500: 'oklch(0.56 0 0)',
  success600: 'oklch(0.45 0 0)',
  success700: 'oklch(0.45 0 0)',
  success950: 'oklch(0.205 0 0)',
  successBg: 'oklch(0.925 0 0)',
  successBorder: 'oklch(0.87 0 0)',
  successFg: 'oklch(0.45 0 0)',
  successSolid: 'oklch(0.45 0 0)',
  successSolidFg: 'oklch(0.985 0 0)',

  // ---------- Semantic — Warning ----------
  warning50: 'oklch(0.985 0 0)',
  warning100: 'oklch(0.965 0 0)',
  warning300: 'oklch(0.87 0 0)',
  warning500: 'oklch(0.72 0 0)',
  warning700: 'oklch(0.45 0 0)',
  warning950: 'oklch(0.27 0 0)',
  warningBg: 'oklch(0.965 0 0)',
  warningBorder: 'oklch(0.87 0 0)',
  warningFg: 'oklch(0.45 0 0)',
  warningSolid: 'oklch(0.72 0 0)',
  warningSolidFg: 'oklch(0.27 0 0)',

  // ---------- Semantic — Error ----------
  error50: 'oklch(0.975 0.015 25)',
  error100: 'oklch(0.945 0.04 25)',
  error300: 'oklch(0.81 0.135 25)',
  error500: 'oklch(0.605 0.205 25)',
  error600: 'oklch(0.53 0.195 25)',
  error700: 'oklch(0.455 0.17 25)',
  error950: 'oklch(0.225 0.08 25)',
  errorBg: 'oklch(0.945 0.04 25)',
  errorBorder: 'oklch(0.81 0.135 25)',
  errorFg: 'oklch(0.455 0.17 25)',
  errorSolid: 'oklch(0.53 0.195 25)',
  errorSolidFg: 'oklch(0.985 0.003 75)',

  // ---------- Semantic — Info ----------
  info50: 'oklch(0.985 0 0)',
  info100: 'oklch(0.925 0 0)',
  info300: 'oklch(0.87 0 0)',
  info500: 'oklch(0.56 0 0)',
  info600: 'oklch(0.45 0 0)',
  info700: 'oklch(0.45 0 0)',
  info950: 'oklch(0.205 0 0)',
  infoBg: 'oklch(0.925 0 0)',
  infoBorder: 'oklch(0.87 0 0)',
  infoFg: 'oklch(0.45 0 0)',
  infoSolid: 'oklch(0.45 0 0)',
  infoSolidFg: 'oklch(0.985 0 0)',

  // ---------- Radii ----------
  radiusNone: '0px',
  radiusSm: '2px',
  radiusBase: '4px',
  radiusMd: '6px',
  radiusLg: '8px',
  radiusXl: '12px',
  radiusFull: '9999px',

  // ---------- Shadows (warm-cast Sovrium elevation) ----------
  shadowNone: 'none',
  shadowXs: '0 1px 0 0 rgb(0 0 0 / 0.04)',
  shadowSm: '0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 1px -1px rgb(0 0 0 / 0.04)',
  shadowMd: '0 4px 12px -2px rgb(0 0 0 / 0.07), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
  shadowLg: '0 12px 28px -4px rgb(0 0 0 / 0.09), 0 4px 8px -2px rgb(0 0 0 / 0.04)',
  shadowXl: '0 24px 48px -8px rgb(0 0 0 / 0.13), 0 8px 16px -4px rgb(0 0 0 / 0.06)',

  // ---------- Motion — durations ----------
  durationInstant: '0ms',
  durationFast: '120ms',
  durationBase: '180ms',
  durationSlow: '260ms',
  durationDeliberate: '340ms',

  // ---------- Motion — easings ----------
  easeDefault: 'cubic-bezier(0.2, 0, 0, 1)',
  easeEnter: 'cubic-bezier(0, 0, 0.2, 1)',
  easeExit: 'cubic-bezier(0.4, 0, 1, 1)',
  easeEmphasized: 'cubic-bezier(0.3, 0, 0.1, 1.1)',

  // ---------- Typography ----------
  fontSans:
    "'IBM Plex Sans Variable', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  fontMono:
    "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  fontSerif:
    "'Source Serif 4 Variable', 'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif",

  fontSize2xs: '0.6875rem',
  fontSizeXs: '0.75rem',
  fontSizeSm: '0.8125rem',
  fontSizeBase: '0.875rem',
  fontSizeMd: '1rem',
  fontSizeLg: '1.125rem',
  fontSizeXl: '1.25rem',
  fontSize2xl: '1.5rem',
  fontSize3xl: '1.875rem',
  fontSize4xl: '2.25rem',
  fontSize5xl: '3rem',
  fontSize6xl: '3.75rem',

  fontWeightRegular: '400',
  fontWeightMedium: '500',
  fontWeightSemibold: '600',
  fontWeightBold: '700',

  lineHeightNone: '1',
  lineHeightTight: '1.1',
  lineHeightSnug: '1.25',
  lineHeightNormal: '1.55',
  lineHeightRelaxed: '1.7',

  letterSpacingTighter: '-0.022em',
  letterSpacingTight: '-0.012em',
  letterSpacingNormal: '0',
  letterSpacingWide: '0.02em',
  letterSpacingCaps: '0.04em',
} as const

/**
 * @public Design-token key vocabulary (`keyof typeof TOKENS`). Exported as the
 * type-safe surface for token lookups; consumed by token-driven call sites as
 * they adopt the typed key.
 */
export type TokenKey = keyof typeof TOKENS
