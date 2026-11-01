/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The cross-key rule of `design.code.tokens`: every role names a colour the
 * design declares, and that colour is legible wherever a code block draws it.
 *
 * ## Why it refuses rather than corrects
 *
 * The engine already floors the default pair's own colours toward 4.5:1, since
 * nobody chose them and there is nobody to tell. A role's colour is the
 * opposite case: an author named it. Moving it would paint a colour the design
 * does not declare, so the design-system document and the page would disagree,
 * the author would never learn their ink is illegible on code, and the
 * correction would shift silently whenever `muted` changes. The colours are
 * static config, so the measure is exact and is taken once, here.
 *
 * ## The grounds it measures
 *
 * A token is drawn on two grounds per scheme: the block itself, and the 5 %
 * tint of the ink an added or highlighted line lays over it. A colour that
 * clears the bare block can still fall under the floor on that tint, so both
 * are measured and the lower ratio is the one reported.
 *
 * - **Light**: the block is the design's `muted` colour; the tint is 5 % of its
 *   `foreground` over it. Both resolve the way the stylesheet does: a declared
 *   colour (under its own name or an alias), a role defining it, a ramp step it
 *   names, else the platform default.
 * - **Dark**: the block is the fixed near-black chrome the code-block
 *   stylesheet draws in the dark scheme, and the tint is 5 % of that chrome's
 *   own light ink. The role's colour is its `design.darkColors` value, or its
 *   light value when it has none (what the stylesheet paints in that case).
 */

import { measureContrast, overlayColor } from '@/domain/kernel/color/color-contrast'
import { CODE_TOKEN_ROLES } from './code'
import { canonicalColorName, INHERITED_COLOR_TOKENS } from './inherited-tokens'

/** The projection of a `design` block this rule reads. */
export interface CodeTokenDesignInput {
  readonly colors?: Readonly<Record<string, unknown>>
  readonly darkColors?: Readonly<Record<string, unknown>>
  readonly colorRoles?: Readonly<Record<string, { readonly value?: string } | undefined>>
  readonly ramps?: Readonly<Record<string, Readonly<Record<string, string>> | undefined>>
  readonly code?: { readonly tokens?: Readonly<Record<string, string | undefined>> }
}

/** The ratio every declared role must reach, on every ground, in both schemes. */
const CODE_TOKEN_FLOOR = 4.5

/** How much of the ink an added or highlighted line lays over the block. */
const LINE_TINT_ALPHA = 0.05

/** The dark scheme's code-block chrome and its ink, as the stylesheet draws them. */
const DARK_BLOCK = '#0d0d0d'
const DARK_BLOCK_INK = '#e1e4e8'

/** A ramp step reference such as `neutral-200`. */
const RAMP_REF_PATTERN = /^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-(\d{2,3})$/

/** A value read as a string, or `undefined` for anything else. */
const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

/** A ramp reference resolved to its literal, a few steps deep; the value itself otherwise. */
const throughRamps = (design: CodeTokenDesignInput, value: string, depth = 0): string => {
  const match = RAMP_REF_PATTERN.exec(value)
  const step = match === null ? undefined : design.ramps?.[match[1] ?? '']?.[match[2] ?? '']
  return step === undefined || depth > 3 ? value : throughRamps(design, step, depth + 1)
}

/**
 * The light value of one of the platform's own colour roles (`muted`,
 * `foreground`) as this design paints it.
 */
const resolveRoleColor = (design: CodeTokenDesignInput, role: string): string => {
  const declared = Object.entries(design.colors ?? {}).find(
    ([key, value]) => canonicalColorName(key) === role && asString(value) !== undefined
  )?.[1]
  const raw =
    asString(declared) ?? design.colorRoles?.[role]?.value ?? INHERITED_COLOR_TOKENS[role] ?? ''
  return throughRamps(design, raw)
}

/** The lowest ratio `ink` reaches on `ground` and on the line tint over it; `undefined` if unmeasurable. */
const lowestRatio = (ink: string, ground: string, tintInk: string): number | undefined => {
  const tint = overlayColor(ground, tintInk, LINE_TINT_ALPHA)
  const onBlock = measureContrast(ink, ground)
  const onTint = tint === undefined ? undefined : measureContrast(ink, tint)
  return onBlock === undefined || onTint === undefined
    ? undefined
    : Math.min(onBlock.ratio, onTint.ratio)
}

/** One scheme's measurement of one role. */
interface SchemeCheck {
  readonly scheme: 'light' | 'dark'
  readonly value: string
  readonly ratio: number | undefined
}

/** The light and the dark measurement of the colour `name`. */
const measureSchemes = (
  design: CodeTokenDesignInput,
  name: string,
  light: string
): readonly SchemeCheck[] => {
  const muted = resolveRoleColor(design, 'muted')
  const foreground = resolveRoleColor(design, 'foreground')
  const dark = throughRamps(design, asString(design.darkColors?.[name]) ?? light)
  return [
    { scheme: 'light', value: light, ratio: lowestRatio(light, muted, foreground) },
    { scheme: 'dark', value: dark, ratio: lowestRatio(dark, DARK_BLOCK, DARK_BLOCK_INK) },
  ]
}

/** The refusal for a role whose colour is unmeasurable or under the floor, or `true`. */
const checkRole = (design: CodeTokenDesignInput, role: string, name: string): string | true => {
  const where = `\`design.code.tokens.${role}\``
  const light = throughRamps(design, asString(design.colors?.[name]) ?? '')
  const failing = measureSchemes(design, name, light).find(
    (check) => check.ratio === undefined || check.ratio < CODE_TOKEN_FLOOR
  )
  if (failing === undefined) return true
  if (failing.ratio === undefined) {
    return `${where} names colour '${name}', whose ${failing.scheme} scheme value '${failing.value}' cannot be measured, so its ${CODE_TOKEN_FLOOR}:1 floor on the code block cannot be shown to hold. Write it as a hex, rgb(), hsl() or oklch() colour.`
  }
  const remedy =
    failing.scheme === 'light'
      ? `Pick a darker colour for '${name}'.`
      : `Give '${name}' a lighter \`design.darkColors\` value.`
  return `${where} names colour '${name}', which reaches only ${failing.ratio.toFixed(2)}:1 on the code block in the ${failing.scheme} scheme, under the ${CODE_TOKEN_FLOOR}:1 floor a code token must reach on the block and on the tint of an added or highlighted line. ${remedy} The engine never adjusts a colour a design names.`
}

/** The refusal for a role whose value is not a declared colour token, or `true`. */
const checkReference = (
  design: CodeTokenDesignInput,
  role: string,
  name: string
): string | true => {
  if (asString(design.colors?.[name]) !== undefined) return true
  const declared = Object.keys(design.colors ?? {}).toSorted()
  const available =
    declared.length > 0
      ? `Declared colours: ${declared.join(', ')}`
      : 'No colours are declared in `design.colors`'
  return `\`design.code.tokens.${role}\` names '${name}', which is not a colour declared in \`design.colors\`. A role takes the NAME of a colour token, never a literal colour, so that the dark scheme can follow its \`design.darkColors\` value. ${available}.`
}

/**
 * Every role of `design.code.tokens` names a declared colour that reaches
 * 4.5:1 on the code block and on the tint of a highlighted line, in both
 * schemes. Roles are checked in their declared order; first failure wins.
 *
 * @returns `true` when clean, or the first violation as a human-readable message
 */
export const validateCodeTokenColors = (
  design: CodeTokenDesignInput | undefined
): string | true => {
  const tokens = design?.code?.tokens
  if (design === undefined || tokens === undefined) return true
  const failure = CODE_TOKEN_ROLES.flatMap((role) => {
    const name = tokens[role]
    if (name === undefined) return []
    const reference = checkReference(design, role, name)
    const result = reference === true ? checkRole(design, role, name) : reference
    return result === true ? [] : [result]
  }).at(0)
  return failure ?? true
}
