/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { BorderRadiusConfig } from '@/domain/models/app/theme/border-radius'
import type { BreakpointsConfig } from '@/domain/models/app/theme/breakpoints'
import type { ColorsConfig } from '@/domain/models/app/theme/colors'
import type { FontsConfig } from '@/domain/models/app/theme/fonts'
import type { ShadowsConfig } from '@/domain/models/app/theme/shadows'
import type { SpacingConfig } from '@/domain/models/app/theme/spacing'

/**
 * Generate Tailwind @theme colors from domain color config
 * Uses hex format directly - Tailwind v4 handles color format conversion
 */
/**
 * Color tokens that require a `-foreground` companion for text contrast.
 * When a base color is defined (e.g., `secondary`) but its foreground pair
 * (`secondary-foreground`) is not, we auto-generate it with white (#ffffff).
 */
const COLORS_NEEDING_FOREGROUND = [
  'primary',
  'secondary',
  'destructive',
  'card',
  'muted',
  'accent',
  'popover',
] as const

/**
 * Mapping from `app.theme.colors` author key → canonical `--sv-*` role token
 * the prestyled-by-default islands consume.
 *
 * Phase 5 follow-up ([internal ref], ROLE_TOKEN_BRIDGE wiring): the islands emit
 * `bg-[var(--sv-X, oklch(...))]` arbitrary-value classes that resolve the
 * `--sv-*` channel first and fall through to the inline OKLCH literal only
 * if unset. The prior architecture bridged `--sv-*` from the canonical
 * `--color-*` author keys via `ROLE_TOKEN_BRIDGE` for *some* tokens, but
 * `--sv-primary` (and several siblings) was DELIBERATELY left direct (no
 * bridge through `--color-primary`) to avoid a `--color-primary ↔ --sv-primary`
 * cascade cycle that left `bg-primary` transparent in zero-config (the
 * canonical `--color-primary` is registered as `var(--sv-primary)` inside the
 * `@theme` block — see V1_THEME_COLOR_REGISTRATIONS).
 *
 * Without a bridge, tenant overrides of `app.theme.colors.primary = '#c45d3f'`
 * reached `--color-primary` (and the legacy `bg-primary` utility) but NOT
 * `--sv-primary` (and the prestyled `bg-[var(--sv-primary,...)]` channel).
 * The result: tenant terracotta showed up on `.btn`-tagged buttons via the
 * legacy component layer, but the prestyled island channel still rendered the
 * neutral-900 OKLCH baseline. The `contract-tenant-override` smoke test
 * documented this gap in its docstring as the "right outcome for the wrong
 * reason" — the prestyled channel was decorative; the legacy channel did the
 * actual override work.
 *
 * Fix: emit `--sv-X: value` directly in a `:root` block (separate from
 * `@theme static`) for each authored color that maps to a v1 role token. The
 * tenant `:root` block emits AFTER `ROLE_TOKEN_BRIDGE` in the pipeline, so its
 * `--sv-X` declaration beats the bridge's neutral fallback by ordinary
 * cascade order (same specificity, later wins). This bypasses the
 * `--color-X ↔ --sv-X` cycle entirely.
 *
 * The mapping mirrors the inverse of ROLE_TOKEN_BRIDGE's `var(--color-X, …)`
 * chain. Author keys without a direct `--sv-*` equivalent (e.g.
 * `secondary`, `accent`) emit only `--color-*` because they have no role
 * slot in v1.
 */
const COLOR_TO_SV_TOKEN: Record<string, string> = {
  primary: 'primary',
  'primary-hover': 'primary-hover',
  'primary-active': 'primary-active',
  'primary-foreground': 'primary-fg',
  'primary-subtle': 'primary-subtle',
  'primary-subtle-foreground': 'primary-subtle-fg',
  background: 'bg',
  'background-subtle': 'bg-subtle',
  'background-raised': 'bg-raised',
  'background-overlay': 'bg-overlay',
  foreground: 'fg',
  'foreground-muted': 'fg-muted',
  'foreground-subtle': 'fg-subtle',
  'foreground-disabled': 'fg-disabled',
  'foreground-inverse': 'fg-inverse',
  muted: 'bg-subtle',
  'muted-foreground': 'fg-muted',
  card: 'bg-raised',
  popover: 'bg-overlay',
  border: 'border',
  ring: 'focus-ring',
  success: 'success-solid',
  warning: 'warning-solid',
  error: 'error-solid',
  destructive: 'error-solid',
  'destructive-foreground': 'error-solid-fg',
  info: 'info-solid',
}

export function generateThemeColors(colors?: ColorsConfig): string {
  if (!colors || Object.keys(colors).length === 0) return ''

  const colorEntries = Object.entries(colors).map(([name, value]) => {
    return `    --color-${name}: ${value};`
  })

  // Auto-generate foreground companions for semantic colors missing them
  const derivedForegrounds = COLORS_NEEDING_FOREGROUND.flatMap((base) => {
    const foregroundKey = `${base}-foreground`
    if (colors[base] && !colors[foregroundKey]) {
      return [`    --color-${foregroundKey}: #ffffff;`]
    }
    return []
  })

  // Also ensure 'foreground' (the base text color) exists when 'background' is defined
  const baseForeground =
    colors['background'] && !colors['foreground'] ? ['    --color-foreground: #09090b;'] : []

  return [...colorEntries, ...derivedForegrounds, ...baseForeground].join('\n')
}

/**
 * Generate a `:root` block of `--sv-X: value` declarations for each authored
 * color that maps to a v1 role token ([internal ref] / Phase 5 follow-up).
 *
 * Emitted in a separate `:root` block (NOT inside `@theme static`) because the
 * `--sv-*` tokens are not Tailwind theme tokens — they're the canonical role
 * vars consumed by the prestyled-by-default islands via `withVarFallback`.
 * Going through `:root` keeps the engine from misinterpreting them as
 * utility-minting tokens.
 *
 * The cascade contract: this `:root` block is concatenated AFTER
 * `ROLE_TOKEN_BRIDGE` in `compiler.ts`, so a tenant `--sv-primary: #c45d3f`
 * declaration beats `ROLE_TOKEN_BRIDGE`'s `--sv-primary: var(--sv-neutral-900)`
 * fallback by ordinary cascade order (same specificity, later wins). The
 * `--color-X: value` declarations stay in `@theme static` so existing
 * `bg-X` / `text-X` utilities continue to resolve through the registration
 * chain — the two channels stay independent and each picks up the tenant
 * override directly.
 */
export function generateAuthorSvBridge(colors?: ColorsConfig): string {
  if (!colors || Object.keys(colors).length === 0) return ''

  const svBridgeEntries = Object.entries(colors).flatMap(([name, value]) => {
    const svKey = COLOR_TO_SV_TOKEN[name]
    if (!svKey) return []
    return [`    --sv-${svKey}: ${value};`]
  })

  // Derived companion: the `border-strong` role (a darker step of `border`,
  // consumed by the scroll-area thumb via `--sv-border-strong`) is not a
  // standalone author key, so an author `theme.colors.border` override would
  // otherwise leave the thumb stuck on the zero-config neutral fallback. Mirror
  // the authored `border` onto `--sv-border-strong` so the custom-scrollbar
  // chrome shifts with the rest of the author surface intent. The default theme
  // layer still supplies the darker neutral step when `border` is unset.
  const derivedBorderStrong =
    colors['border'] && !colors['border-strong']
      ? [`    --sv-border-strong: ${colors['border']};`]
      : []

  // Derived companion: the first chart series slot. A chart's leading series is
  // the app's own headline number, so it should read as the app's colour — and
  // since a chart in practice almost always has exactly ONE series, anchoring
  // slot 1 to the authored primary makes the common case on-brand without the
  // author touching the chart at all. Only slot 1 moves: slots 2-5 stay a fixed
  // categorical ramp so a multi-series chart remains readable. The default theme
  // layer supplies the blue when `primary` is unset, which is why this is a
  // derivation here rather than a `var(--sv-primary, …)` in the bridge — the
  // zero-config primary is a near-black neutral and would render a chart unusable.
  const derivedChartAnchor = colors['primary'] ? [`    --sv-chart-1: ${colors['primary']};`] : []

  const allEntries = [...svBridgeEntries, ...derivedBorderStrong, ...derivedChartAnchor]
  if (allEntries.length === 0) return ''

  return `:root {\n${allEntries.join('\n')}\n  }`
}

/**
 * Generate the dark-scheme override block for `theme.darkColors`.
 *
 * `theme.colors` feeds TWO independent channels (see {@link generateThemeColors}
 * and {@link generateAuthorSvBridge}), so a dark palette has to re-point both or
 * the two disagree at runtime: the `bg-X` utility would keep its light value
 * while a prestyled island reading `--sv-X` follows the platform's dark ramp.
 * One block therefore emits `--color-*` (utility channel) AND `--sv-*` (role
 * channel) for every authored dark key.
 *
 * ## Selector
 *
 * `html:is(.dark, [data-theme='dark'])` — the same form the platform's own dark
 * cascade uses, and NOT a bare `.dark`. Two things depend on the `html` prefix:
 *
 * - Specificity (0,1,1) beats every `:root` block (0,1,0). `--color-*` values
 *   land in `:root` via `@theme static`, and Tailwind emits further `:root`
 *   blocks AFTER this one, so a (0,1,0) selector here would be masked by
 *   source order and the override would silently do nothing.
 * - It ties with `V1_ROOT_DARK` (also (0,1,1)), which re-points every `--sv-*`
 *   role var. This block is concatenated AFTER the default theme layer in
 *   `buildSourceCSS`, so the authored value wins on "later wins" cascade order.
 *
 * ## Deliberately NOT mirrored from the light path
 *
 * {@link generateThemeColors} derives a `#ffffff` companion for semantic colors
 * missing a `-foreground`, and a `#09090b` `foreground` when `background` is set
 * alone. Neither is mirrored here: both derive a value for the LIGHT surface, and
 * re-deriving them under the dark selector would either be a no-op (`#ffffff`) or
 * actively wrong (near-black body text on a dark page). A token left out of
 * `darkColors` keeps its light value — the documented way to express a
 * mode-invariant brand colour.
 *
 * A key present in `darkColors` but absent from `colors` still emits here, but
 * mints no utility: `bg-X`/`text-X` only exist when `--color-X` is registered by
 * the `@theme` block, which only `colors` writes. `darkColors` overrides the
 * palette; it does not extend it.
 */
export function generateDarkColorOverrides(darkColors?: ColorsConfig): string {
  if (!darkColors || Object.keys(darkColors).length === 0) return ''

  const colorEntries = Object.entries(darkColors).map(
    ([name, value]) => `    --color-${name}: ${value};`
  )

  const svBridgeEntries = Object.entries(darkColors).flatMap(([name, value]) => {
    const svKey = COLOR_TO_SV_TOKEN[name]
    if (!svKey) return []
    return [`    --sv-${svKey}: ${value};`]
  })

  // Mirrors the light bridge's `border-strong` companion so an authored dark
  // `border` also shifts the scroll-area thumb instead of leaving it on the
  // platform's dark neutral step.
  const derivedBorderStrong =
    darkColors['border'] && !darkColors['border-strong']
      ? [`    --sv-border-strong: ${darkColors['border']};`]
      : []

  // Mirrors the light bridge's chart anchor. Without it an app declaring a dark
  // primary would keep painting its leading chart series in the LIGHT brand
  // colour after the page flipped to dark — the asymmetry, not the colour, being
  // the bug.
  const derivedChartAnchor = darkColors['primary']
    ? [`    --sv-chart-1: ${darkColors['primary']};`]
    : []

  const allEntries = [
    ...colorEntries,
    ...svBridgeEntries,
    ...derivedBorderStrong,
    ...derivedChartAnchor,
  ]

  return `html:is(.dark, [data-theme='dark']) {\n${allEntries.join('\n')}\n  }`
}

/**
 * Generate Tailwind @theme font families from domain font config
 */
export function generateThemeFonts(fonts?: FontsConfig): string {
  if (!fonts || Object.keys(fonts).length === 0) return ''

  const fontEntries = Object.entries(fonts).flatMap(([category, config]) => {
    // Type assertion needed because Record values are unknown in TypeScript
    const fontConfig = config as {
      family: string
      fallback?: string
      style?: string
      transform?: string
      letterSpacing?: string
    }
    const fontStack = fontConfig.fallback
      ? `${fontConfig.family}, ${fontConfig.fallback}`
      : fontConfig.family

    const baseEntry = `    --font-${category}: ${fontStack};`

    // Build entries array immutably
    const styleEntry =
      fontConfig.style && fontConfig.style !== 'normal'
        ? `    --font-${category}-style: ${fontConfig.style};`
        : undefined

    const transformEntry =
      fontConfig.transform && fontConfig.transform !== 'none'
        ? `    --font-${category}-transform: ${fontConfig.transform};`
        : undefined

    const letterSpacingEntry = fontConfig.letterSpacing
      ? `    --font-${category}-letter-spacing: ${fontConfig.letterSpacing};`
      : undefined

    return [baseEntry, styleEntry, transformEntry, letterSpacingEntry].filter(
      (entry): entry is string => entry !== undefined
    )
  })

  return fontEntries.join('\n')
}

/**
 * Render a flat `key → value` config as a block of `@theme` CSS custom
 * properties (`    --<var>: <value>;`), one per line.
 *
 * The four single-axis generators below (spacing / shadows / border-radius /
 * breakpoints) share the exact same shape — guard empty, `Object.entries`,
 * optionally filter, map to a `--prefix-key` declaration, join with newlines.
 * This consolidates that body; per-axis quirks are passed as options:
 *
 *   - `filter` — drop entries (spacing keeps only raw CSS lengths).
 *   - `varName` — override the emitted var name when it isn't simply
 *     `<prefix>-<key>` (border-radius maps `DEFAULT` → `radius`).
 *
 * Returns `''` for a missing or empty config (callers concatenate the result
 * into a larger `@theme` block, where an empty string is a no-op).
 */
function generateVarBlock(
  config: Readonly<Record<string, string>> | undefined,
  prefix: string,
  options?: {
    readonly filter?: (key: string, value: string) => boolean
    readonly varName?: (key: string) => string
  }
): string {
  if (!config || Object.keys(config).length === 0) return ''

  const varName = options?.varName ?? ((key: string) => `${prefix}-${key}`)

  return Object.entries(config)
    .filter(([key, value]) => options?.filter?.(key, value) ?? true)
    .map(([key, value]) => `    --${varName(key)}: ${value};`)
    .join('\n')
}

/**
 * Generate Tailwind @theme spacing from domain spacing config
 * Only includes raw CSS values (rem, px, em), not Tailwind classes
 */
export function generateThemeSpacing(spacing?: SpacingConfig): string {
  return generateVarBlock(spacing as Record<string, string> | undefined, 'spacing', {
    // Only include raw CSS values (not Tailwind classes)
    filter: (_key, value) => /^[0-9.]+(?:rem|px|em|%)$/.test(value),
  })
}

/**
 * Generate Tailwind @theme shadows from domain shadow config
 */
export function generateThemeShadows(shadows?: ShadowsConfig): string {
  // Preserve original shadow values as-is — the .shadow-none utility class
  // override handles the actual rendering.
  return generateVarBlock(shadows as Record<string, string> | undefined, 'shadow')
}

/**
 * Generate Tailwind @theme border radius from domain border radius config
 */
export function generateThemeBorderRadius(borderRadius?: BorderRadiusConfig): string {
  return generateVarBlock(borderRadius as Record<string, string> | undefined, 'radius', {
    varName: (key) => (key === 'DEFAULT' ? 'radius' : `radius-${key}`),
  })
}

/**
 * Generate Tailwind @theme breakpoints from domain breakpoints config
 */
export function generateThemeBreakpoints(breakpoints?: BreakpointsConfig): string {
  return generateVarBlock(breakpoints as Record<string, string> | undefined, 'breakpoint')
}
