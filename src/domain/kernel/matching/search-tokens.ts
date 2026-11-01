/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one tokenizer of the public-pages search.
 *
 * The build-time indexer (`generateSearchIndex`) tokenizes page bodies and
 * titles into the index's `tokens[]` table, and the browser matcher tokenizes
 * the visitor's query to look those tokens up. The two MUST agree token for
 * token, or a word that is on the page silently stops matching — so both
 * import this module rather than each keeping a copy.
 *
 *   - Unicode `NFC` normalize.
 *   - Lowercase.
 *   - Split on `\W+` (any non-word character).
 *   - Drop tokens shorter than {@link MIN_SEARCH_TOKEN_LENGTH}.
 *   - Drop the {@link SEARCH_STOPWORDS}.
 *
 * Pure, with no imports: it ships in the search island and in the standalone
 * `runtime.js` the indexer compiles.
 */

/** English function words that carry no search signal. */
export const SEARCH_STOPWORDS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'by',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'can',
  'could',
  'should',
  'may',
  'might',
])

/** The shortest token kept. */
export const MIN_SEARCH_TOKEN_LENGTH = 2

/**
 * The search tokens of `text`, in input order, duplicates preserved (each
 * occurrence drives an independent posting lookup). A non-string — a query
 * read from somewhere untyped in the browser — has none.
 */
export const tokenizeForSearch = (text: string): readonly string[] => {
  if (typeof text !== 'string') return []
  return text
    .normalize('NFC')
    .toLowerCase()
    .split(/\W+/u)
    .filter((token) => token.length >= MIN_SEARCH_TOKEN_LENGTH && !SEARCH_STOPWORDS.has(token))
}
