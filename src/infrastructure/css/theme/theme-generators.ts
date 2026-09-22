/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { COLOR_TO_SV_TOKEN } from '@/domain/models/app/design/default-design.generated'
import { DENSITY_STEPS, type Density, type DensityStep } from '@/domain/models/app/design/density'
import { TYPE_SCALE_STEPS, type TypeScaleSteps } from '@/domain/models/app/design/type-scale'
import type { DesignBreakpoints } from '@/domain/models/app/design/breakpoints'
import type { DesignColors, DesignDarkColors } from '@/domain/models/app/design/colors'
import type { DesignElevation } from '@/domain/models/app/design/elevation'
import type { FontsConfig } from '@/domain/models/app/design/fonts'
import type { DesignMotion } from '@/domain/models/app/design/motion'
import type { DesignRadius } from '@/domain/models/app/design/radius'
import type { DesignSpacing } from '@/domain/models/app/design/spacing'

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
 * Mapping from `app.design.colors` author key → canonical `--sv-*` role token
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
 * Without a bridge, tenant overrides of `app.design.colors.primary = '#c45d3f'`
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
 *
 * The map itself now lives in `default-design.generated.ts`, emitted from the
 * same source as the bridge it inverts — so the two cannot drift.
 */

/**
 * The selector the platform's own dark cascade uses, and the default for
 * {@link generateDarkColorOverrides}.
 *
 * The `html` type prefix is load-bearing — see that function's own note.
 */
const DEFAULT_DARK_SELECTOR = "html:is(.dark, [data-theme='dark'])"

export function generateThemeColors(colors?: DesignColors): string {
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
 *
 * @param colors - the authored `design.colors`.
 * @param selector - where the block lands. `:root` for the app's own
 *   stylesheet; a scope selector when the design system is drawn as a SUBTREE
 *   of a document themed by someone else (the design-system console — see
 *   `scoped-theme-layer.ts`). Parameterised rather than duplicated so the
 *   author-override semantics cannot drift between the two.
 */
export function generateAuthorSvBridge(colors?: DesignColors, selector = ':root'): string {
  if (!colors || Object.keys(colors).length === 0) return ''

  const svBridgeEntries = Object.entries(colors).flatMap(([name, value]) => {
    const svKey = COLOR_TO_SV_TOKEN[name]
    if (!svKey) return []
    return [`    --sv-${svKey}: ${value};`]
  })

  // Derived companion: the `border-strong` role (a darker step of `border`,
  // consumed by the scroll-area thumb via `--sv-border-strong`) is not a
  // standalone author key, so an author `design.colors.border` override would
  // otherwise leave the thumb stuck on the zero-config neutral fallback. Mirror
  // the authored `border` onto `--sv-border-strong` so the custom-scrollbar
  // chrome shifts with the rest of the author surface intent. The default theme
  // layer still supplies the darker neutral step when `border` is unset.
  const derivedBorderStrong =
    colors['border'] && !colors['border-strong']
      ? [`    --sv-border-strong: ${colors['border']};`]
      : []

  // NOTE: `--sv-chart-1` is deliberately NOT derived from the authored primary.
  // The series is five hues held at one lightness and one chroma, which is the
  // only reason they read as peers rather than as a ranking; substituting an
  // arbitrary brand colour into slot 1 pulls one series off that plane and the
  // other four stop looking like the same set. The anchor existed when slot 1
  // was a Tailwind blue unrelated to anything, where borrowing the app's
  // primary was better than nothing; it is not better than a designed set.
  //
  // Not derived does NOT mean not authorable. All five `chart-N` keys are in
  // COLOR_TO_SV_TOKEN, so `design.colors['chart-1']` reaches `--sv-chart-1`
  // through the same bridge as every other role, and the charts read exactly
  // that var (see islands/chart/chart-series-shared.ts). An author who wants a
  // brand hue in the series names it; what this block declines to do is guess
  // one on their behalf from `primary`.
  const allEntries = [...svBridgeEntries, ...derivedBorderStrong]
  if (allEntries.length === 0) return ''

  return `${selector} {\n${allEntries.join('\n')}\n  }`
}

/**
 * Generate the dark-scheme override block for `design.darkColors`.
 *
 * `design.colors` feeds TWO independent channels (see {@link generateThemeColors}
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
 *
 * @param darkColors - the authored `design.darkColors`.
 * @param selector - where the block lands, defaulting to the platform's own
 *   dark cascade selector. A SCOPED design system passes its own dark arm
 *   instead: keying a scope off `html.dark` would tie the specimen's scheme to
 *   the console's, and those are two independent axes once the preview renders
 *   inside the console's own document.
 */
export function generateDarkColorOverrides(
  darkColors?: DesignDarkColors,
  selector = DEFAULT_DARK_SELECTOR
): string {
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

  // No chart anchor here either — see the light bridge for why slot 1 is not
  // derived from the authored primary. A `darkColors['chart-N']` an author DOES
  // declare still crosses, on the same bridge as every other role.
  const allEntries = [...colorEntries, ...svBridgeEntries, ...derivedBorderStrong]

  return `${selector} {\n${allEntries.join('\n')}\n  }`
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
 * Generate Tailwind `@theme` spacing tokens from `design.spacing`.
 *
 * ## Why there is no value filter any more
 *
 * This used to drop any value failing `/^[0-9.]+(?:rem|px|em|%)$/`, because the
 * old `theme.spacing` was an open string record: an author could write a
 * Tailwind class name where a length belonged, and emitting it would have
 * produced a broken custom property.
 *
 * `design.spacing` is a ladder of `DimensionValueSchema`, so the decoder has
 * already refused anything that is not a number followed by `px` or `rem` —
 * every value reaching here is a valid length by construction, and the filter
 * became a second, weaker copy of a check the schema now owns.
 *
 * Weaker in the one direction that matters: `DIMENSION_PATTERN` admits a
 * leading `-`, and the filter's `^[0-9.]` does not. So the only values the
 * filter could still discard were NEGATIVE steps — which are legal ladder
 * entries (a pull-up margin is exactly what one is for). Keeping it would have
 * made a declared step silently emit nothing, which is the class of defect the
 * flattening exists to remove. Every non-negative length emits exactly as
 * before, so no existing stylesheet moves.
 */
export function generateSpacingScale(spacing?: DesignSpacing): string {
  return generateVarBlock(spacing as Record<string, string> | undefined, 'spacing')
}

/**
 * Generate Tailwind @theme shadows from domain shadow config
 */
export function generateThemeShadows(shadows?: DesignElevation): string {
  // Preserve original shadow values as-is — the .shadow-none utility class
  // override handles the actual rendering.
  return generateVarBlock(shadows as Record<string, string> | undefined, 'shadow')
}

/**
 * Generate Tailwind @theme border radius from domain border radius config
 */
export function generateThemeBorderRadius(borderRadius?: DesignRadius): string {
  return generateVarBlock(borderRadius as Record<string, string> | undefined, 'radius', {
    varName: (key) => (key === 'DEFAULT' ? 'radius' : `radius-${key}`),
  })
}

/**
 * Generate Tailwind @theme breakpoints from domain breakpoints config
 */
export function generateThemeBreakpoints(breakpoints?: DesignBreakpoints): string {
  return generateVarBlock(breakpoints as Record<string, string> | undefined, 'breakpoint')
}

/**
 * Generate Tailwind `@theme` typography tokens from `design.typeScale.steps`.
 *
 * ─── WHY THE `--text-*` NAMESPACE ───────────────────────────────────────────
 *
 * This is not a Sovrium-invented variable shape. Tailwind v4 reserves the
 * `--text-*` namespace for font sizes and recognises three MODIFIERS on it —
 * `--line-height`, `--letter-spacing` and `--font-weight`. An author declaring
 * `typeScale.h1` can write `class: 'text-h1'` and get all four properties at
 * once.
 *
 * That is the whole difference between this key and the three it supersedes.
 * `design.typeScale.families.*.size` never becomes a variable at all; `--text-h1`
 * is both a
 * variable and the basis of a utility.
 *
 * ─── WHAT IS UNCONDITIONAL AND WHAT IS NOT (MEASURED) ───────────────────────
 *
 * Stated separately because the two halves have different guarantees, and
 * conflating them is how a claim about CSS quietly becomes false:
 *
 *  - **The custom properties are unconditional.** They land inside
 *    `@theme static`, which reaches `:root` whether or not any candidate
 *    references them. `var(--text-h1)` always resolves — which matters because
 *    client-hydrated islands read these at runtime, beyond the build-time scan.
 *  - **The `text-{step}` UTILITY is candidate-gated**, exactly like every other
 *    Tailwind utility. It is generated only when the build-time scan sees the
 *    class name in the app's own `className` props. An app that declares a step
 *    and never writes `text-h1` anywhere gets the variables and no rule — which
 *    is correct (an unused utility is dead CSS) but is NOT the same sentence as
 * "the utility always exists". `[internal ref]` pins the end-to-end path an
 *    author takes: declare the step, use the class, get the styles.
 *
 * ─── WHAT EACH LINE ACTUALLY BUYS, MEASURED ─────────────────────────────────
 *
 * Stated precisely rather than optimistically, because a generator that
 * over-claims is how the superseded fields got into the schema in the first
 * place:
 *
 *  - `--text-{step}`, `--…--line-height`, `--…--letter-spacing`,
 *    `--…--font-weight` — Tailwind modifiers. They populate `:root` AND fold
 *    into the `text-{step}` utility.
 *  - `--text-{step}--font-family` — NOT a Tailwind modifier. Tailwind does not
 *    fold it into the utility, so this one is a plain custom property for
 *    direct use (`font-family: var(--text-h1--font-family)`). It resolves
 *    through `--font-{category}`, which `generateThemeFonts` emits, so the
 *    binding follows the face wherever the author retunes it. Emitted because
 *    a charter that says "h1 is set in the title face" should have somewhere
 *    for that to be true; named honestly here because it behaves differently
 *    from the four above.
 *
 * Everything lands inside `@theme static`, so the variables reach `:root`
 * whether or not any candidate references them — which matters because
 * client-hydrated islands may read them at runtime, beyond the build-time scan.
 */
export function generateThemeTypeScale(steps?: TypeScaleSteps): string {
  if (!steps) return ''

  // Iterate the canonical ladder rather than `Object.entries`, so the emitted
  // order is the charter's order (display → caption) regardless of the order
  // the author happened to write the keys in.
  //
  // WHAT THAT DOES AND DOES NOT BUY, measured rather than assumed: the CSS
  // pipeline REORDERS `--text-*` declarations downstream of this function, so
  // this order does not survive into the served stylesheet. A vacuity probe on
  // `[internal ref]` established it — an E2E assertion on stylesheet order
  // passed with this loop deliberately rewired to authoring order, which is
  // why that spec now asserts the EXPORT instead.
  //
  // The ordering is kept regardless, for the two consumers where it IS
  // Sovrium's and a reader depends on it: the DTCG `typography` group and the
  // markdown ladder, neither of which passes through the CSS pipeline. All
  // three read `TYPE_SCALE_STEPS`, so they cannot disagree.
  return TYPE_SCALE_STEPS.flatMap((step) => {
    const declared = steps[step]
    if (!declared) return []

    const modifier = (suffix: string, value: string | number | undefined): string | undefined =>
      value === undefined ? undefined : `    --text-${step}--${suffix}: ${value};`

    return [
      `    --text-${step}: ${declared.size};`,
      modifier('line-height', declared.lineHeight),
      modifier('font-weight', declared.weight),
      modifier('letter-spacing', declared.letterSpacing),
      modifier('font-family', declared.font ? `var(--font-${declared.font})` : undefined),
    ].filter((entry): entry is string => entry !== undefined)
  }).join('\n')
}

/**
 * Generate Tailwind `@theme` motion tokens from `design.motion`.
 *
 * ## Why this exists at all
 *
 * `design.motion.durations` and `design.motion.easings` are ordered ladders in
 * exactly the sense `spacing` and `radius` are — an author names `fast`,
 * `base`, `slow` once and every animation spends one of them. Until the
 * flattening they were declared under `theme.animations.duration` /
 * `.easing`, where the only reader was the token RESOLVER
 * (`theme-token-resolver.ts`), which substitutes a name inside a composed
 * animation shorthand. Nothing emitted them as custom properties, so a
 * declared curve was unreachable from a `className` and invisible to a
 * client-hydrated island. `[internal ref]` pins the fix.
 *
 * ## Namespaces
 *
 * `--duration-*` and `--ease-*` are both Tailwind v4 theme namespaces, so a
 * declared step additionally mints `duration-{name}` and `ease-{name}`
 * utilities — candidate-gated like every utility, while the custom properties
 * themselves are unconditional inside `@theme static`.
 *
 * Durations emit before easings: a reader scanning the block sees how long
 * before how, which is the order the two are chosen in.
 *
 * @param motion - the authored `design.motion`.
 */
export function generateMotionScale(motion?: DesignMotion): string {
  return [
    generateVarBlock(motion?.durations as Record<string, string> | undefined, 'duration'),
    generateVarBlock(motion?.easings as Record<string, string> | undefined, 'ease'),
  ]
    .filter(Boolean)
    .join('\n')
}

/** The five `--sv-density-*` declarations of one step, as CSS block body text. */
const densityDeclarations = (step: DensityStep): string =>
  [
    `    --sv-density-row-y: ${step.rowY};`,
    `    --sv-density-control-h: ${step.controlH};`,
    `    --sv-density-button-h: ${step.buttonH};`,
    `    --sv-density-gap: ${step.gap};`,
    `    --sv-density-text: ${step.text};`,
  ].join('\n')

/**
 * Generate the author's density ladder as plain `:root` + `[data-density='…']`
 * blocks, overriding the platform default in {@link V1_DENSITY_LAYER}.
 *
 * ## Why plain `:root`, not `@theme`
 *
 * Same reason as {@link generateAuthorSvBridge}: `--sv-*` is not a Tailwind
 * theme namespace. The recipes read these through the arbitrary
 * custom-property form (`py-(--sv-density-row-y)`), which resolves a bare
 * `var()`; registering them in `@theme` would mint utilities nobody asks for
 * and invite the engine to tree-shake a value that client-hydrated islands
 * read at runtime.
 *
 * ## Cascade contract
 *
 * `buildSourceCSS` appends this AFTER `buildDefaultLayer`, and both the
 * platform default and this block are `:root` (0,1,0), so the author wins on
 * ordinary "later wins" source order — the identical contract
 * `generateAuthorSvBridge` documents for the colour roles.
 *
 * ## Which step is the default
 *
 * `steps.compact` lands at `:root`. That is a deliberate choice and not the
 * only defensible one — `cozy` is the "ordinary application surface" step by
 * the schema's own description — but the platform default IS compact (the four
 * literals the recipes used to hard-code), so anchoring `:root` anywhere else
 * would make declaring a density ladder silently loosen every existing table
 * even when the author copied the shipped numbers verbatim. `cozy` and `roomy`
 * stay reachable through `[data-density]`.
 *
 * `byZone` is decoded and validated but reaches no DOM attribute yet — the
 * recorded follow-up. Emitting all three steps regardless is what makes that
 * follow-up a wiring change rather than a CSS change.
 *
 * Deliberately takes NO `selector` parameter, unlike its colour sibling. That
 * one is parameterised because `scoped-theme-layer.ts` genuinely calls it with
 * a scope selector; nothing scopes a density ladder today, and a parameter with
 * no caller is an inert surface that reads as a capability.
 *
 * @param density - the authored `design.density`.
 */
export function generateDensityLayer(density?: Density): string {
  if (!density) return ''

  // The default step at the root selector, then every step behind its
  // `[data-density]` attribute — including the default one, so switching a
  // subtree back to it is expressible rather than requiring the attribute to
  // be removed.
  const rootBlock = `:root {\n${densityDeclarations(density.steps.compact)}\n  }`
  const stepBlocks = DENSITY_STEPS.map(
    (step) => `[data-density='${step}'] {\n${densityDeclarations(density.steps[step])}\n  }`
  )

  return [rootBlock, ...stepBlocks].join('\n\n  ')
}
