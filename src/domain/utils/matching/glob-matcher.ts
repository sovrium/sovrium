/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export function matchGlobPattern(pattern: string, path: string): boolean {
  const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')

  const regex = new RegExp(`^${escapedPattern}$`)

  return regex.test(path)
}

export function matchesAnyGlobPattern(
  patterns: readonly string[] | undefined,
  path: string
): boolean {
  if (!patterns || patterns.length === 0) return false

  return patterns.some((pattern) => matchGlobPattern(pattern, path))
}
