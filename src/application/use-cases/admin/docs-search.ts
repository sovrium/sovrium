/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SEARCHING THE MANUAL — the same matcher the platform's own content search
 * uses, pointed at the embedded fragments.
 *
 * `stripMarkdownToPlainText` and `extractMatchExcerpt`
 * (`src/domain/models/app/pages/content-dir-excerpt.ts`) already back the
 * command palette's content search: they flatten a markdown body to one line
 * and cut a window around the hit with the matched span marked. Reusing them
 * costs no dependency and no index file, and means a reader searching the
 * manual from the CLI gets the same excerpt shape they get searching a docs
 * site built with Sovrium.
 *
 * ─── AN ARTICLE IS MATCHED ON ITS ADDRESS AS WELL AS ITS BODY ──────────────
 *
 * The title, the slug and the keywords are searched beside the prose, and a hit
 * there RANKS ABOVE a body hit. `sovrium docs search llms` must answer with the
 * article about `llms.txt` rather than with whichever body happens to mention
 * it first — a reader searching a topic is naming a subject, and the subject of
 * an article is its title.
 */

import {
  extractMatchExcerpt,
  stripMarkdownToPlainText,
} from '@/domain/models/app/pages/content-dir-excerpt'

/** One article, flattened to what a search reads. */
export interface SearchableArticle {
  /** `app-schema/llms-txt`. */
  readonly address: string
  readonly title: string
  readonly description: string
  readonly keywords: readonly string[]
  readonly body: string
}

/** One hit, in the order the command prints them. */
export interface DocsSearchHit {
  readonly address: string
  readonly title: string
  /** A line of context around the match, the match itself flagged. */
  readonly excerpt: string
  /** Whether the query hit the address, title or keywords rather than the body. */
  readonly inHeading: boolean
}

/** How many hits are worth printing before a reader should narrow the query. */
export const DOCS_SEARCH_RESULT_CAP = 20

const contains = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle.toLowerCase())

/** The address, title, description and keywords as one searchable line. */
const headingText = (article: SearchableArticle): string =>
  [article.address, article.title, article.description, ...article.keywords].join(' ')

/**
 * Every article matching `query`, heading hits first.
 *
 * Sorted by (heading hit, address) rather than by a relevance score: the corpus
 * is under two hundred articles, a score nobody can reproduce is worse than an
 * order anybody can, and `--full` is not the only output that has to be
 * byte-stable across two runs.
 *
 * @returns At most {@link DOCS_SEARCH_RESULT_CAP} hits; an empty query matches
 *   nothing, which the caller reports as a refusal rather than as the manual.
 */
export const searchDocs = (
  articles: readonly SearchableArticle[],
  query: string
): readonly DocsSearchHit[] => {
  const trimmed = query.trim()
  if (trimmed.length === 0) return []

  return articles
    .flatMap((article): readonly DocsSearchHit[] => {
      const heading = headingText(article)
      const plain = stripMarkdownToPlainText(article.body)
      const inHeading = contains(heading, trimmed)
      if (!inHeading && !contains(plain, trimmed)) return []
      return [
        {
          address: article.address,
          title: article.title,
          excerpt: extractMatchExcerpt(plain, trimmed).excerpt,
          inHeading,
        },
      ]
    })
    .toSorted(
      (left, right) =>
        Number(right.inHeading) - Number(left.inHeading) ||
        left.address.localeCompare(right.address)
    )
    .slice(0, DOCS_SEARCH_RESULT_CAP)
}

/** The hits as the markdown the command prints. */
export const renderSearchResults = (query: string, hits: readonly DocsSearchHit[]): string =>
  [
    `# Search — \`${query}\``,
    '',
    `> ${hits.length} match(es). Read one with \`sovrium docs <address>\`.`,
    ...hits.flatMap((hit) => ['', `## ${hit.title} — \`${hit.address}\``, '', hit.excerpt]),
    '',
  ].join('\n')
