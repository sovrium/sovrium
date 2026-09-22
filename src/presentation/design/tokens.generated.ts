/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The island fallback catalogue — the LITERAL every prestyled island inlines beside its `--sv-*` override hook.
 *
 * AUTO-GENERATED from `apps/admin/config/design.ts` — DO NOT EDIT.
 *
 * Regenerate: `bun run build:default-design`
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
  bgInset: 'oklch(0.952 0 0)',
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
  error50: '#fefbfa',
  error100: '#fdf5f3',
  error300: '#f0c8bd',
  error500: '#dc472e',
  error600: '#c13520',
  error700: '#a12b1a',
  error950: '#3d0e08',
  errorBg: '#fdf5f3',
  errorBorder: '#f0c8bd',
  errorFg: '#a12b1a',
  errorSolid: '#c13520',
  errorSolidFg: 'oklch(0.985 0.003 75)',

  // ---------- Semantic — Info ----------
  info50: 'oklch(0.985 0 0)',
  info100: 'oklch(0.925 0 0)',
  info300: 'oklch(0.87 0 0)',
  info500: 'oklch(0.56 0 0)',
  info600: '#398ad6',
  info700: 'oklch(0.45 0 0)',
  info950: 'oklch(0.205 0 0)',
  infoBg: 'oklch(0.925 0 0)',
  infoBorder: 'oklch(0.87 0 0)',
  infoFg: 'oklch(0.45 0 0)',
  infoSolid: '#398ad6',
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
  shadowSm: '0 1px 2px rgb(0 0 0 / 0.08)',
  shadowMd: '0 4px 12px rgb(0 0 0 / 0.06)',
  shadowLg: '0 8px 24px rgb(0 0 0 / 0.12)',

  // ---------- Motion — durations ----------
  durationFast: '120ms',
  durationBase: '180ms',
  durationSlow: '260ms',

  // ---------- Motion — easings ----------
  easeDefault: 'cubic-bezier(0.2, 0, 0, 1)',
  easeEnter: 'cubic-bezier(0, 0, 0.2, 1)',
  easeExit: 'cubic-bezier(0.4, 0, 1, 1)',

  // ---------- Typography ----------
  fontSans:
    "'IBM Plex Sans Variable', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  fontMono:
    "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  // No `fontSerif`: [internal ref] amendment A2 withdrew the serif grace note, and the
  // theme layer declares no `--font-serif` for a fallback here to pair with. A
  // fallback whose variable is never emitted is not a fallback — it is a
  // hardcoded face wearing the syntax of an override.

  // No `fontSize*`: this catalogue is the LITERAL an island inlines beside a
  // `--sv-*` override hook, and the type ladder has never had one — it emits
  // `--text-*` (Tailwind's own namespace), so a recipe names `text-base` and the
  // utility carries the value. The twelve entries that used to sit here were read
  // by nothing but a unit test pinning three hand-copied rem literals in the
  // recipes; the recipes now name rungs, so both are gone.

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

  // ---------- Density (the `compact` step — the `:root` default) ----------
  //
  // Mirrors `V1_ROOT_DENSITY` in `default-theme-layer.ts`, and the mirror is
  // ENFORCED: `Design Token Drift` rule 4 compares these four literals against
  // that block, so the two cannot silently disagree about what "compact" is.
  //
  // Unlike every other entry above, these are NOT consumed through
  // `withVarFallback`. The recipes read them with Tailwind v4's arbitrary
  // custom-property syntax — `py-(--sv-density-row-y)`, `text-(length:--sv-density-text)`
  // — which emits a bare `var()` with no inline fallback. The values are held
  // here for the drift mirror and as the one place a reader can see what the
  // default ladder step is worth without opening the CSS layer.
  densityRowY: '5px',
  densityControlH: '36px',
  densityButtonH: '28px',
  densityGap: '7px',
  densityText: '11px',
} as const

/** @public Design-token key vocabulary. */
export type TokenKey = keyof typeof TOKENS
