/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The server half of a `url` button's address: what a page may be told of its
 * `url` template before it ships. Kept out of `button-url-service.ts`, which
 * the browser bundle imports, so no island pays for code it never runs.
 */

/**
 * One `$record.<field>` token (a dotted path included), or a `|` fallback
 * chain of them. A token with a backslash directly before it is escaped and
 * printed as written, so it is not matched. A static literal: nothing here is
 * built from input.
 */
const RECORD_TOKEN_CHAIN = /(?<!\\)\$record\.\w+(?:\.\w+)*(?:\|\$record\.\w+(?:\.\w+)*)*/g

/** The field a chain member names: the first segment after `$record.`. */
const memberField = (member: string): string => member.slice('$record.'.length).split('.')[0] ?? ''

/**
 * A `url` template with every token naming a field the reader may not read
 * removed, for a surface that resolves the address in the browser against the
 * record it already holds. The removed token would resolve to nothing there
 * anyway; removing it keeps the hidden field's NAME off the page too. A
 * fallback chain keeps its other members, still chained.
 */
export const withoutHiddenUrlTokens = (
  template: string,
  isHidden: (field: string) => boolean
): string =>
  template.replace(RECORD_TOKEN_CHAIN, (chain: string) =>
    chain
      .split('|')
      .filter((member) => !isHidden(memberField(member)))
      .join('|')
  )

/**
 * A `url` button's url as its reader may be told it, or `undefined` when no
 * button belongs: a url that named only fields she may not read comes out
 * empty, and a button with nowhere to go is not drawn at all.
 */
export const buttonUrlForReader = (
  url: string,
  isHidden: (field: string) => boolean
): string | undefined => {
  const kept = withoutHiddenUrlTokens(url, isHidden)
  return kept === '' && url !== '' ? undefined : kept
}
