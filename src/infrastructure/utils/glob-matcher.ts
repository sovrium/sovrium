/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Simple glob pattern matcher for URL paths.
 *
 * Supports:
 * - Exact matches: /admin
 * - Wildcard suffix: /admin/* matches /admin/dashboard, /admin/users/123
 * - Wildcard prefix: star/api matches /v1/api, /public/api
 * - Wildcard anywhere: /admin/star/users matches /admin/123/users
 *
 * Does NOT support:
 * - Character classes: [abc]
 * - Brace expansion: curly braces
 * - Double asterisk: treated same as single asterisk
 *
 * @param pattern - Glob pattern string (e.g., /admin/*)
 * @param path - Path to test (e.g., /admin/dashboard)
 * @returns true if path matches pattern, false otherwise
 */
export function matchGlobPattern(pattern: string, path: string): boolean {
  // Escape special regex characters except *
  const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')

  // Create regex with exact start and end anchors
  const regex = new RegExp(`^${escapedPattern}$`)

  return regex.test(path)
}

/**
 * Check if a path matches any of the provided glob patterns.
 *
 * @param patterns - Array of glob patterns
 * @param path - Path to test
 * @returns true if path matches any pattern, false otherwise
 */
export function matchesAnyGlobPattern(
  patterns: readonly string[] | undefined,
  path: string
): boolean {
  if (!patterns || patterns.length === 0) return false

  return patterns.some((pattern) => matchGlobPattern(pattern, path))
}
