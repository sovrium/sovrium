/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export type RouteParams = Readonly<Record<string, string>>

export type RouteMatch = {
  readonly matched: boolean
  readonly params: RouteParams
}

function patternToRegex(pattern: string): Readonly<RegExp> {
  const regexPattern = pattern
    .split('/')
    .map((segment, index, segments) => {
      const isLast = index === segments.length - 1
      if (segment.startsWith(':') && segment.endsWith('*') && isLast) {
        return '(.+)'
      }
      if (segment.startsWith(':')) {
        return '([^/]+)'
      }
      if (segment === '*' && isLast) {
        return '.*'
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')

  return new RegExp(`^${regexPattern}$`)
}

function extractParamNames(pattern: string): readonly string[] {
  return pattern
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => {
      const body = segment.slice(1)
      return body.endsWith('*') ? body.slice(0, -1) : body
    })
}

export function matchRoute(pattern: string, urlPath: string): RouteMatch {
  if (!pattern.includes(':') && !pattern.includes('*')) {
    return {
      matched: pattern === urlPath,
      params: {},
    }
  }

  const regex = patternToRegex(pattern)
  const match = urlPath.match(regex)

  if (!match) {
    return {
      matched: false,
      params: {},
    }
  }

  const paramNames = extractParamNames(pattern)
  const paramValues = match.slice(1)

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

export function findMatchingRoute(
  patterns: readonly string[],
  urlPath: string
): { readonly index: number; readonly params: RouteParams } | undefined {
  const matchResult = patterns
    .map((pattern, index) => ({ pattern, index }))
    .filter(({ pattern }) => pattern !== '')
    .find(({ pattern }) => matchRoute(pattern, urlPath).matched)

  if (!matchResult) {
    return undefined
  }

  const match = matchRoute(matchResult.pattern, urlPath)
  return { index: matchResult.index, params: match.params }
}
