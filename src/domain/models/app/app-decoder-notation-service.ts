/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The decoder's own location notation — `["pages"][0]["meta"]` and the
 * indented `at [...]` line under a message — read back into the dotted paths
 * the config report publishes — and the one check whose failure is about a
 * KEY rather than a value.
 */

/** One segment of the decoder's `["key"][0]` path notation. */
const DECODER_PATH_SEGMENT = /\["((?:[^"\\]|\\.)*)"\]|\[(\d+)\]/g

/**
 * Convert the decoder's `["pages"][0]["meta"]["title"]` notation into the
 * dotted form `ConfigFinding.path` uses — `pages[0].meta.title`. Pure.
 */
export const decoderPathToFindingPath = (notation: string): string =>
  [...notation.matchAll(DECODER_PATH_SEGMENT)].reduce((path, match) => {
    if (match[2] !== undefined) return `${path}[${match[2]}]`
    const key = match[1] ?? ''
    return path === '' ? key : `${path}.${key}`
  }, '')

/** The `at [...]` line under a decoder message, or `undefined` for any other line. */
export const decoderAtNotation = (line: string): string | undefined =>
  /^\s+at (\[.*\])\s*$/.exec(line)?.[1]

/** The representation id `Schema.isPropertyNames` stamps on its check. */
const PROPERTY_NAMES_CHECK_ID = 'effect/schema/isPropertyNames'

/**
 * Whether a failed check, read from its annotations, is a record's key rule
 * (`Schema.isPropertyNames`): its failures name a key the author wrote. Pure.
 */
export const isPropertyNamesCheck = (annotations: unknown): boolean => {
  const representation = (annotations as Record<string, unknown> | undefined)?.[
    'representation'
  ] as { readonly id?: unknown } | undefined
  return representation?.id === PROPERTY_NAMES_CHECK_ID
}
