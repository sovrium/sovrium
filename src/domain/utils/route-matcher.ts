/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Route parameters extracted from a dynamic path
 *
 * @example
 * ```typescript
 * const params = { slug: 'hello-world', id: '123' }
 * ```
 */
export type RouteParams = Readonly<Record<string, string>>

/**
 * Result of matching a URL against a route pattern
 */
export type RouteMatch = {
  readonly matched: boolean
  readonly params: RouteParams
}

/**
 * Converts a route pattern with dynamic segments into a regular expression
 *
 * Dynamic segments are defined with a colon prefix (e.g., :id, :slug)
 *
 * @param pattern - Route pattern (e.g., '/blog/:slug', '/products/:id')
 * @returns Regular expression to match URLs and capture parameters
 *
 * @example
 * ```typescript
 * const regex = patternToRegex('/blog/:slug')
 * // Returns: /^\/blog\/([^/]+)$/
 *
 * const regex2 = patternToRegex('/users/:userId/posts/:postId')
 * // Returns: /^\/users\/([^/]+)\/posts\/([^/]+)$/
 * ```
 */
function patternToRegex(pattern: string): Readonly<RegExp> {
  // Escape forward slashes and convert :param to capture groups
  const regexPattern = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        // Dynamic segment - capture any characters except forward slash
        return '([^/]+)'
      }
      // Static segment - escape special regex characters
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')

  return new RegExp(`^${regexPattern}$`)
}

/**
 * Extracts parameter names from a route pattern
 *
 * @param pattern - Route pattern (e.g., '/blog/:slug')
 * @returns Array of parameter names (e.g., ['slug'])
 *
 * @example
 * ```typescript
 * const params = extractParamNames('/blog/:slug')
 * // Returns: ['slug']
 *
 * const params2 = extractParamNames('/users/:userId/posts/:postId')
 * // Returns: ['userId', 'postId']
 * ```
 */
function extractParamNames(pattern: string): readonly string[] {
  return pattern
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1)) // Remove colon prefix
}

/**
 * Matches a URL path against a route pattern and extracts parameters
 *
 * Pure function with no side effects
 *
 * @param pattern - Route pattern with optional dynamic segments (e.g., '/blog/:slug')
 * @param urlPath - Actual URL path to match (e.g., '/blog/hello-world')
 * @returns Match result with extracted parameters
 *
 * @example
 * ```typescript
 * // Static route
 * matchRoute('/about', '/about')
 * // Returns: { matched: true, params: {} }
 *
 * // Dynamic route with single parameter
 * matchRoute('/blog/:slug', '/blog/hello-world')
 * // Returns: { matched: true, params: { slug: 'hello-world' } }
 *
 * // Dynamic route with multiple parameters
 * matchRoute('/users/:userId/posts/:postId', '/users/123/posts/456')
 * // Returns: { matched: true, params: { userId: '123', postId: '456' } }
 *
 * // No match
 * matchRoute('/blog/:slug', '/products/123')
 * // Returns: { matched: false, params: {} }
 * ```
 */
export function matchRoute(pattern: string, urlPath: string): RouteMatch {
  // Static route - exact match
  if (!pattern.includes(':')) {
    return {
      matched: pattern === urlPath,
      params: {},
    }
  }

  // Dynamic route - use regex matching
  const regex = patternToRegex(pattern)
  const match = urlPath.match(regex)

  if (!match) {
    return {
      matched: false,
      params: {},
    }
  }

  // Extract parameter names and values
  const paramNames = extractParamNames(pattern)
  const paramValues = match.slice(1) // Remove full match, keep capture groups

  // Use reduce to build params object functionally (no mutation)
  const params = paramNames.reduce<Record<string, string>>((acc, name, i) => {
    const value = paramValues[i]
    if (name && value) {
      return { ...acc, [name]: value }
    }
    return acc
  }, {})

  return {
    matched: true,
    params,
  }
}

/**
 * Finds the first matching route from a list of patterns
 *
 * Pure function with no side effects
 *
 * @param patterns - Array of route patterns to try
 * @param urlPath - URL path to match
 * @returns Index of matched pattern and extracted parameters, or undefined if no match
 *
 * @example
 * ```typescript
 * const patterns = ['/about', '/blog/:slug', '/products/:id']
 * const result = findMatchingRoute(patterns, '/blog/hello-world')
 * // Returns: { index: 1, params: { slug: 'hello-world' } }
 *
 * const result2 = findMatchingRoute(patterns, '/not-found')
 * // Returns: undefined
 * ```
 */
export function findMatchingRoute(
  patterns: readonly string[],
  urlPath: string
): { readonly index: number; readonly params: RouteParams } | undefined {
  // Use findIndex + map to avoid imperative loop
  const matchResult = patterns
    .map((pattern, index) => ({ pattern, index }))
    .filter(({ pattern }) => pattern !== undefined && pattern !== '')
    .find(({ pattern }) => matchRoute(pattern, urlPath).matched)

  if (!matchResult) {
    return undefined
  }

  const match = matchRoute(matchResult.pattern, urlPath)
  return { index: matchResult.index, params: match.params }
}
