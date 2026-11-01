/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeCssValue } from '@/domain/kernel/sanitize/css-value-escaping'
import { TYPE_SCALE_STEPS, type TypeScaleSteps } from '@/domain/models/app/design/type-scale'
import { withoutNoneShadows } from './shadow-token-values'
import type { DesignBreakpoints } from '@/domain/models/app/design/breakpoints'
import type { DesignElevation } from '@/domain/models/app/design/elevation'
import type { FontsConfig } from '@/domain/models/app/design/fonts'
import type { DesignMotion } from '@/domain/models/app/design/motion'
import type { DesignRadius } from '@/domain/models/app/design/radius'
import type { DesignSpacing } from '@/domain/models/app/design/spacing'

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

    const baseEntry = `    --font-${category}: ${escapeCssValue(fontStack)};`

    // Build entries array immutably
    const styleEntry =
      fontConfig.style && fontConfig.style !== 'normal'
        ? `    --font-${category}-style: ${escapeCssValue(fontConfig.style)};`
        : undefined

    const transformEntry =
      fontConfig.transform && fontConfig.transform !== 'none'
        ? `    --font-${category}-transform: ${escapeCssValue(fontConfig.transform)};`
        : undefined

    const letterSpacingEntry = fontConfig.letterSpacing
      ? `    --font-${category}-letter-spacing: ${escapeCssValue(fontConfig.letterSpacing)};`
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
    .map(([key, value]) => `    --${varName(key)}: ${escapeCssValue(value)};`)
    .join('\n')
}

/**
 * Generate Tailwind `@theme` spacing tokens from `design.spacing`.
 *
 * ## Why there is no value filter
 *
 * A filter dropping any value failing `/^[0-9.]+(?:rem|px|em|%)$/` only makes
 * sense for an open string record, where an author could write a Tailwind
 * class name where a length belonged and emitting it would produce a broken
 * custom property.
 *
 * `design.spacing` is a ladder of `DimensionValueSchema`, so the decoder has
 * already refused anything that is not a number followed by `px` or `rem` —
 * every value reaching here is a valid length by construction, and a filter
 * would be a second, weaker copy of a check the schema owns.
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

/** Generate Tailwind @theme shadows from `design.elevation` (`none` written transparent). */
export function generateThemeShadows(shadows?: DesignElevation): string {
  return generateVarBlock(withoutNoneShadows(shadows), 'shadow')
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
 *    "the utility always exists". A design spec pins the end-to-end path an
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
  // A design spec established it — an E2E assertion on stylesheet order
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
      value === undefined
        ? undefined
        : `    --text-${step}--${suffix}: ${escapeCssValue(String(value))};`

    return [
      `    --text-${step}: ${escapeCssValue(declared.size)};`,
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
 * client-hydrated island. A design foundations spec pins the fix.
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
