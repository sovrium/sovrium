/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface SearchIndexPage {
  readonly url: string
  readonly title: string
  readonly excerptText: string
}

export interface SearchIndexPosting {
  readonly url: string
  readonly score: number
}

export interface SearchIndex {
  readonly pages: ReadonlyArray<SearchIndexPage>
  readonly tokens: Readonly<Record<string, ReadonlyArray<SearchIndexPosting>>>
}

export interface SearchResult {
  readonly url: string
  readonly title: string
  readonly excerpt: string
  readonly score: number
}

const STOPWORDS: ReadonlySet<string> = new Set([
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

const MIN_TOKEN_LENGTH = 2
const DEFAULT_MAX_RESULTS = 10

export const tokenize = (text: string): ReadonlyArray<string> => {
  if (typeof text !== 'string') return []
  return text
    .normalize('NFC')
    .toLowerCase()
    .split(/\W+/u)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token))
}

export const searchIndex = (
  index: SearchIndex,
  query: string,
  maxResults: number = DEFAULT_MAX_RESULTS
): ReadonlyArray<SearchResult> => {
  if (!index || !index.tokens || !index.pages) return []
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  const scoresByUrl = queryTokens.reduce<Record<string, number>>((acc, token) => {
    const postings = index.tokens[token]
    if (!postings) return acc
    return postings.reduce<Record<string, number>>(
      (inner, posting) => ({
        ...inner,
        [posting.url]: (inner[posting.url] ?? 0) + posting.score,
      }),
      acc
    )
  }, {})

  const pagesByUrl: Readonly<Record<string, SearchIndexPage>> = index.pages.reduce<
    Record<string, SearchIndexPage>
  >((acc, page) => ({ ...acc, [page.url]: page }), {})

  const results: ReadonlyArray<SearchResult> = Object.entries(scoresByUrl)
    .map<SearchResult | undefined>(([url, score]) => {
      const page = pagesByUrl[url]
      if (!page) return undefined
      return {
        url,
        title: page.title || '',
        excerpt: page.excerptText || '',
        score,
      }
    })
    .filter((r): r is SearchResult => r !== undefined)

  const sorted = results.reduce<ReadonlyArray<SearchResult>>((sortedAcc, item) => {
    const insertAt = sortedAcc.findIndex((existing) => existing.score < item.score)
    return insertAt === -1
      ? [...sortedAcc, item]
      : [...sortedAcc.slice(0, insertAt), item, ...sortedAcc.slice(insertAt)]
  }, [])

  return sorted.slice(0, maxResults)
}
