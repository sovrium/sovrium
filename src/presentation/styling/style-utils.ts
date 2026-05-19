/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const isCssValue = (value: string): boolean => {
  return /\d+(rem|px|em|%|vh|vw)/.test(value) && !value.includes(' ')
}

export const isTailwindClass = (value: string): boolean => {
  if (value.includes(' ')) {
    return true
  }
  if (/^(max-w-|mx-|px-|py-|p-|m-|w-|h-)/.test(value)) {
    return true
  }
  return false
}
