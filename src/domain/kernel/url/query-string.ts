/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

type QueryScalar = string | number | boolean

const isScalar = (value: unknown): value is QueryScalar =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value))

const pair = (key: string, value: QueryScalar): string =>
  `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`

/**
 * Encode a query object: each value percent-encoded on its own, an array
 * repeating its key once per item, in the object's order. Anything that is
 * not a string, a finite number or a boolean (a nested object, `null`) is
 * skipped — the schema refuses it at load, and a value the engine cannot
 * encode unambiguously is never guessed at.
 */
export const encodeQueryObject = (query: unknown): string => {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) return ''
  return Object.entries(query as Record<string, unknown>)
    .flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.filter(isScalar).map((item) => pair(key, item))
        : isScalar(value)
          ? [pair(key, value)]
          : []
    )
    .join('&')
}

/**
 * Append an encoded query object to a url, after the parameters the url
 * already carries and before any `#fragment`. The url itself is left verbatim.
 */
export const appendQueryObject = (url: string, query: unknown): string => {
  const encoded = encodeQueryObject(query)
  if (url === '' || encoded === '') return url
  const hashIndex = url.indexOf('#')
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const fragment = hashIndex === -1 ? '' : url.slice(hashIndex)
  const separator = !base.includes('?') ? '?' : base.endsWith('?') || base.endsWith('&') ? '' : '&'
  return `${base}${separator}${encoded}${fragment}`
}
