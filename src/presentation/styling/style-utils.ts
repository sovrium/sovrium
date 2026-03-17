/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Checks if a value is a CSS value with units (rem, px, em, %, vh, vw)
 * CSS values must contain units and not include spaces (to distinguish from Tailwind classes)
 *
 * @param value - String value to check
 * @returns true if value is a raw CSS value, false if it's a Tailwind class
 *
 * @example
 * isCssValue('4rem') // true
 * isCssValue('80rem') // true
 * isCssValue('py-16') // false
 * isCssValue('py-16 sm:py-20') // false
 */
export const isCssValue = (value: string): boolean => {
  return /\d+(rem|px|em|%|vh|vw)/.test(value) && !value.includes(' ')
}

/**
 * Checks if a container spacing value is a Tailwind class (not a raw CSS value)
 * Tailwind classes include utility classes like "max-w-7xl", "mx-auto", "px-4"
 * CSS values like "80rem" or "1280px" should return false
 *
 * @param value - Container spacing value to check
 * @returns true if value contains Tailwind classes, false if it's a raw CSS value
 *
 * @example
 * isTailwindClass('max-w-7xl mx-auto px-4') // true
 * isTailwindClass('max-w-7xl') // true
 * isTailwindClass('80rem') // false
 * isTailwindClass('1280px') // false
 */
export const isTailwindClass = (value: string): boolean => {
  // If it has spaces, it's multiple classes (Tailwind)
  if (value.includes(' ')) {
    return true
  }
  // If it matches Tailwind patterns (max-w-*, mx-*, px-*, etc.), it's a class
  if (/^(max-w-|mx-|px-|py-|p-|m-|w-|h-)/.test(value)) {
    return true
  }
  // Otherwise, assume it's a CSS value
  return false
}
