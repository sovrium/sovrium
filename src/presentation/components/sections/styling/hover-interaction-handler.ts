/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { HoverInteraction } from '@/domain/models/app/page/common/interactions/hover-interaction'

/**
 * Maps hover interaction properties to CSS property names
 *
 * @param hover - Hover interaction configuration
 * @returns Array of CSS property names
 */
function getAnimatableProperties(hover: HoverInteraction): ReadonlyArray<string> {
  return [
    (hover.scale !== undefined || hover.transform) && 'transform',
    hover.opacity !== undefined && 'opacity',
    hover.backgroundColor && 'background-color',
    hover.color && 'color',
    hover.borderColor && 'border-color',
    hover.shadow && 'box-shadow',
  ].filter((prop): prop is string => Boolean(prop))
}

/**
 * Build CSS transition styles for base element state
 *
 * Generates transition property for smooth hover animations.
 * Applied to the base element to define which properties should animate.
 * Uses explicit transition properties (transition-property, transition-duration, transition-timing-function)
 * instead of shorthand to ensure proper CSS property testing.
 *
 * @param hover - Hover interaction configuration
 * @returns Transition style object or undefined
 */
export function buildHoverTransitionStyles(
  hover: HoverInteraction | undefined
): Record<string, string> | undefined {
  if (!hover) return undefined

  const duration = hover.duration ?? '200ms'
  const easing = hover.easing ?? 'ease-out'
  const transitionProps = getAnimatableProperties(hover)

  if (transitionProps.length === 0) return undefined

  return {
    'transition-property': transitionProps.join(', '),
    'transition-duration': duration,
    'transition-timing-function': easing,
  }
}

/**
 * Converts scale number to transform string
 *
 * @param scale - Scale factor (e.g., 1.05)
 * @returns CSS transform string (e.g., 'scale(1.05)')
 */
function scaleToTransform(scale: number): string {
  return `scale(${scale})`
}

/**
 * Build hover effect data for component
 *
 * Returns data attributes and style tag content for hover interactions.
 * Uses a unique identifier to scope hover styles to specific elements.
 *
 * @param hover - Hover interaction configuration
 * @param uniqueId - Unique identifier for the element
 * @returns Hover data object with attributes and styles
 */
export function buildHoverData(
  hover: HoverInteraction | undefined,
  uniqueId: string
):
  | {
      readonly attributes: Record<string, string>
      readonly styleContent: string
    }
  | undefined {
  if (!hover) return undefined

  // Convert scale to transform if present (scale takes priority over transform)
  const transformValue = hover.scale !== undefined ? scaleToTransform(hover.scale) : hover.transform

  // Build hover rules list (immutable)
  // Use !important to override inline styles from props.style
  const hoverRules = [
    transformValue && `transform: ${transformValue} !important`,
    hover.opacity !== undefined && `opacity: ${hover.opacity} !important`,
    hover.backgroundColor && `background-color: ${hover.backgroundColor} !important`,
    hover.color && `color: ${hover.color} !important`,
    hover.borderColor && `border-color: ${hover.borderColor} !important`,
    hover.shadow && `box-shadow: ${hover.shadow} !important`,
  ].filter((rule): rule is string => Boolean(rule))

  if (hoverRules.length === 0) return undefined

  return {
    attributes: { 'data-hover-id': uniqueId },
    styleContent: `[data-hover-id="${uniqueId}"]:hover { ${hoverRules.join('; ')} }`,
  }
}
