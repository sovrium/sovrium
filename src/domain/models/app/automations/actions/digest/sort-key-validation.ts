/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What is wrong with a digest release's sort key, or `undefined` when it is a
 * key the released items can be sorted by.
 *
 * The key names a key of the collected items. A key starting with `$` reads
 * as a JSON path on SQLite and as a plain key on PostgreSQL, so the same
 * release sorted two ways; it is refused on both, as is an empty key. A key
 * written as a template (`{{trigger.data.sortBy}}`) is checked once it is
 * filled, when the release runs.
 */
export const digestSortKeyProblem = (key: string): string | undefined => {
  if (key.includes('{{')) return undefined
  if (key.trim() === '') return 'A digest sort key must name a key of the collected items'
  if (key.startsWith('$')) {
    const refused = `Digest sort key ${JSON.stringify(key)} starts with "$": name a key of the collected items, not a JSON path`
    const suggested = keyWithoutPathPrefix(key)
    return suggested === '' ? refused : `${refused} (write ${JSON.stringify(suggested)})`
  }
  return undefined
}

/**
 * The key a `$`-prefixed sort key most plausibly meant: `$.priority` and
 * `$priority` both name `priority`. Empty when nothing is left to suggest.
 */
const keyWithoutPathPrefix = (key: string): string => key.replace(/^\$\.?/, '').trim()
