/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  isCssProperty,
  normalizeStyleAnimations,
  parseStyle,
} from '@/presentation/render/styling/parse-style'
import { applyComponentAnimations } from './animation-composer-wrapper'
import { buildFlexClasses, buildGridClasses } from './class-builders'
import { getComponentShadow } from './shadow-resolver'
import type { Design } from '@/domain/models/app/design'
import type { Component } from '@/domain/models/app/pages/components'
import type { Interactions } from '@/domain/models/app/pages/components/interactions/interactions'
import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'

/**
 * Extract CSS properties from props object
 * Separates CSS properties (e.g., maxWidth, backgroundColor) from other props
 *
 * @param props - Props object that may contain CSS properties
 * @returns Object with cssProps and remainingProps
 */
export function extractCssProperties(props: Record<string, unknown> | undefined): {
  readonly cssProps: Record<string, unknown>
  readonly remainingProps: Record<string, unknown>
} {
  if (!props) {
    return { cssProps: {}, remainingProps: {} }
  }

  // Use reduce for immutable accumulation
  return Object.entries(props).reduce<{
    readonly cssProps: Record<string, unknown>
    readonly remainingProps: Record<string, unknown>
  }>(
    (acc, [key, value]) => {
      if (isCssProperty(key)) {
        return {
          ...acc,
          cssProps: { ...acc.cssProps, [key]: value },
        }
      }
      return {
        ...acc,
        remainingProps: { ...acc.remainingProps, [key]: value },
      }
    },
    { cssProps: {}, remainingProps: {} }
  )
}

/**
 * Parse and normalize style object
 * Extracts CSS properties from the root of the props object and merges them with the style property
 */
export function parseComponentStyle(
  styleValue: unknown,
  props: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  // Parse the explicit style property
  const explicitStyle = styleValue
    ? normalizeStyleAnimations(
        typeof styleValue === 'string'
          ? parseStyle(styleValue)
          : (styleValue as Record<string, unknown>)
      )
    : undefined

  // Extract CSS properties from props (excluding the style property itself)
  const { cssProps } = extractCssProperties(props)

  // Remove the style property from cssProps if it exists (already handled above)
  const { style: _style, ...cssPropsWithoutStyle } = cssProps

  // Merge CSS properties with explicit style
  const mergedStyle = {
    ...cssPropsWithoutStyle,
    ...explicitStyle,
  }

  return Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined
}

/**
 * Maps component types to the bare marker class written onto the element.
 *
 * These names are INERT. This comment used to say `button` maps to `btn`
 * "because the CSS components layer uses `.btn`" — it no longer does.
 * `component-layer-generators.ts` retired `.card`, `.badge`, `.btn` and its
 * variants; `.btn-icon` is the only button rule left. Nothing paints from these
 * markers, and nothing is supposed to: the paint comes from the recipes
 * (`computeButtonDefaultClasses` and friends), which resolve to arbitrary-value
 * utilities.
 *
 * They are kept rather than deleted because removing a class an operator may
 * already target from `app.design` custom CSS is not cascade-safe — the same
 * reasoning recorded beside the `card` marker in `structural-components.tsx`.
 * Treat them as a stable hook for author CSS, never as a styling channel: adding
 * a NEW entry here paints nothing and only widens that compatibility surface.
 */
const COMPONENT_TYPE_CLASS_MAP: Partial<Record<string, string>> = {
  card: 'card',
  badge: 'badge',
  btn: 'btn',
  button: 'btn',
}

/**
 * Build entrance animation class from interactions
 *
 * @param interactions - Component interactions
 * @returns Animation class or undefined
 */
function buildEntranceAnimationClass(interactions: Interactions | undefined): string | undefined {
  if (!interactions?.entrance?.animation) return undefined

  return `animate-${interactions.entrance.animation}`
}

/**
 * Configuration for building final className
 */
type BuildClassNameConfig = {
  readonly type: Component['type']
  readonly className: unknown
  readonly substitutedProps: Record<string, unknown> | undefined
  readonly interactions: Interactions | undefined
  readonly variant?: string
  readonly size?: string
  readonly badgeVariant?: string
  /**
   * `design.components[<type>]`, pre-resolved by the caller. Its `root` string
   * is the APP layer — between the recipe and the author — and its `floor` is
   * applied after both. Absent for an app that declares no block for this type,
   * in which case this function behaves exactly as it did before the key
   * existed, down to the byte.
   */
  readonly designStyles?: ComponentDesignResolution
}

/**
 * Build button-specific modifier classes (variant and size)
 */
function buildButtonModifierClasses(
  type: Component['type'],
  variant: string | undefined,
  size: string | undefined
): { variantClass: string | undefined; sizeClass: string | undefined } {
  const isButton = type === 'button' || type === 'btn'
  return {
    variantClass: isButton && variant && variant !== 'default' ? `btn-${variant}` : undefined,
    sizeClass: isButton && size && size !== 'md' ? `btn-${size}` : undefined,
  }
}

/**
 * Build badge-specific modifier class from badgeVariant
 */
function buildBadgeModifierClass(
  type: Component['type'],
  badgeVariant: string | undefined
): string | undefined {
  const isBadge = type === 'badge'
  return isBadge && badgeVariant && badgeVariant !== 'default' ? `badge-${badgeVariant}` : undefined
}

/**
 * Build final className based on component type
 */
export function buildFinalClassName(config: BuildClassNameConfig): string | undefined {
  const { type, className, substitutedProps, interactions, variant, size, badgeVariant } = config

  // Build classes array immutably
  const typeClass = COMPONENT_TYPE_CLASS_MAP[type]
  const { variantClass, sizeClass } = buildButtonModifierClasses(type, variant, size)
  const badgeVariantClass = buildBadgeModifierClass(type, badgeVariant)
  const flexClass = type === 'flex' ? buildFlexClasses(substitutedProps) : undefined
  const gridClass = type === 'grid' ? buildGridClasses(substitutedProps) : undefined
  const customClass = className as string | undefined
  const entranceClass = buildEntranceAnimationClass(interactions)
  // Don't add scroll animation class to initial className - it will be added by scroll-animation.js
  const scrollClass = undefined

  // Three precedence layers, not one flat join. The array order used to BE the
  // precedence — later fragments were assumed to win at the Tailwind cascade —
  // which is false for same-property conflicts, because Tailwind v4 emits
  // utilities in its own order rather than in the order this function
  // concatenated them. `resolveClasses` drops the loser instead, so the winner
  // is decided here.
  //
  // The split preserves the array's original ordering semantics exactly:
  // everything BEFORE `customClass` is the recipe, `customClass` is the author,
  // and `entranceClass` — which sat AFTER `customClass` and so won by position —
  // becomes the floor. An entrance animation is config-driven chrome the author
  // did not ask to remove via `className`, so it keeps beating them.
  // `design.components[<type>].replace` drops SOVRIUM's recipe wherever it is
  // computed, and part of it is computed here: `typeClass` is the legacy
  // component-layer marker (`.btn`, `.badge`), which paints a background of its
  // own. Dropping the renderer's recipe while leaving that class behind would
  // make `replace: true` look like it half-worked.
  const recipe = config.designStyles?.replace
    ? ''
    : [typeClass, variantClass, sizeClass, badgeVariantClass, flexClass, gridClass]
        .filter(Boolean)
        .join(' ')
  // `design.components` joins as the APP layer, and its accessibility floor
  // rides with the entrance/scroll chrome that was already unremovable.
  const floor = [entranceClass, scrollClass, config.designStyles?.floor].filter(Boolean).join(' ')
  const classes = resolveClasses(recipe, config.designStyles?.root, customClass, floor)
  return classes || undefined
}

/**
 * Apply shadow to style based on component type
 */
export function applyComponentShadow(
  type: Component['type'],
  style: Record<string, unknown> | undefined,
  design: Design | undefined
): Record<string, unknown> | undefined {
  const componentShadow = getComponentShadow(type, design)
  return componentShadow ? { ...style, ...componentShadow } : style
}

/**
 * Process style with animations and shadows
 */
export function processComponentStyle(
  type: Component['type'],
  styleValue: unknown,
  design: Design | undefined,
  props?: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const baseStyle = parseComponentStyle(styleValue, props)
  const styleWithAnimations = applyComponentAnimations(type, baseStyle, design)
  return applyComponentShadow(type, styleWithAnimations, design)
}
