/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  ContentDirReader,
  type ContentDirEntry,
  type ContentDirReadError,
} from '@/application/ports/services/content-dir-reader'
import { validateLanguageSubdirectory } from '@/domain/models/app/languages/language-detection'
import { isPublicArticle } from '@/domain/models/app/pages/content-dir-access'
import { isPublicPage } from '@/domain/models/app/pages/is-public'
import type { App, Page } from '@/domain/models/app'

/**
 * The `/llms.txt` and `/llms-full.txt` documents (llmstxt.org): the site's pages
 * and content entries, grouped, as a language model reads them.
 */

/** Resolved title + description for the `/llms.txt` header block. */
interface LlmsHeader {
  readonly title: string
  readonly description: string
}

/**
 * Resolve the H1 title + blockquote description for `/llms.txt`.
 *
 * `app.llms.title` / `app.llms.description` win; otherwise the app `name` and
 * `description` are used. A description always exists (falls back to a generic
 * sentence) so the llmstxt.org blockquote is never empty.
 */
const resolveLlmsHeader = (app: App): LlmsHeader => {
  const title = app.llms?.title ?? app.name
  const description =
    app.llms?.description ?? app.description ?? `Documentation and content for ${app.name}.`
  return { title, description }
}

/**
 * Humanize a raw group key into a section heading
 * ("get-started" → "Get Started"). Mirrors the content-dir lister fallback.
 */
const humanizeGroup = (key: string): string =>
  key
    .split(/[-_\s]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')

/** Group key used for entries with no resolvable `group`/`section`. */
const UNGROUPED_KEY = 'Other'

/**
 * How many `contentDir` pages are read at once. Filesystem reads, not the
 * shared database pool — but a stated ceiling all the same, so an app with
 * many collection pages does not open every directory in the same tick.
 */
const CONTENT_DIR_READ_CONCURRENCY = 4

/**
 * The pages ONE locale's llms document is built from.
 *
 * A page belongs to a locale by the `/{lang}/` prefix it declares in its own
 * `path`, resolved with the router's own primitive so an llms route and a page
 * route can never disagree about which segment is a language. A page carrying
 * no DECLARED prefix is locale-NEUTRAL and belongs to every locale — that rule,
 * rather than a special case, is what keeps an app with no `languages` block
 * serving exactly what it served before: no code is declared, so every page is
 * neutral and nothing is filtered out.
 *
 * It is also the whole of the changelog de-duplication. A site declaring its
 * changelog collection once per locale over ONE source directory would otherwise
 * concatenate the single English body twice into one document; the two
 * declarations differ precisely by their path prefix, so scoping by prefix
 * contributes that body once per locale route and never twice to one.
 *
 * `language === undefined` means "every page", which is what the root routes of
 * an app declaring no `languages` ask for.
 *
 * Only PUBLIC pages are ever returned (`isPublicPage`, the rule the sitemap
 * follows). Both llms documents are served to anyone who asks, so a content
 * collection whose `access` requires a session or a role must contribute
 * neither a listing nor a body — filtering here, at the one entry both
 * generators share, covers every `/{lang}/` route at once.
 */
const pagesForLanguage = (app: App, language: string | undefined): readonly Page[] => {
  const pages = (app.pages ?? []).filter(isPublicPage)
  if (language === undefined) return pages
  return pages.filter((page) => {
    const declared = validateLanguageSubdirectory(app, page.path)
    return declared === undefined || declared === language
  })
}

/**
 * Collect every content-directory entry across the app's pages, in page +
 * file order. Pages without a `contentDir` contribute nothing.
 */
const collectContentEntries = (
  pages: readonly Page[]
): Effect.Effect<readonly ContentDirEntry[], ContentDirReadError, ContentDirReader> =>
  Effect.gen(function* () {
    const reader = yield* ContentDirReader
    const perPage = yield* Effect.forEach(
      pages,
      (page) =>
        page.contentDir ? reader.enumerate(page.contentDir, page.path) : Effect.succeed([]),
      { concurrency: CONTENT_DIR_READ_CONCURRENCY }
    )
    // A public artefact carries no article gated by its own front matter.
    return perPage.flat().filter((entry) => isPublicArticle(entry.access))
  })

/**
 * Group entries by their resolved `group` key, preserving first-seen order for
 * both the groups and the entries within each group.
 */
const groupEntries = (
  entries: readonly ContentDirEntry[]
): ReadonlyArray<readonly [string, readonly ContentDirEntry[]]> => {
  const keys = entries.map((entry) => entry.group ?? UNGROUPED_KEY)
  const orderedKeys = keys.filter((key, index) => keys.indexOf(key) === index)
  return orderedKeys.map(
    (key) => [key, entries.filter((entry) => (entry.group ?? UNGROUPED_KEY) === key)] as const
  )
}

/** Render a single page bullet: `- [title](url): description`. */
const renderEntryBullet = (entry: ContentDirEntry, baseUrl: string): string => {
  const url = `${baseUrl}${entry.path}`
  const suffix = entry.description ? `: ${entry.description}` : ''
  return `- [${entry.title}](${url})${suffix}`
}

/** The `/llms.txt` text for entries already read. */
const renderLlmsIndex = (
  app: App,
  baseUrl: string,
  entries: readonly ContentDirEntry[]
): string => {
  const { title, description } = resolveLlmsHeader(app)
  const grouped = groupEntries(entries)

  const sections = grouped.map(([key, groupEntriesList]) => {
    const heading = `## ${humanizeGroup(key)}`
    const bullets = groupEntriesList.map((entry) => renderEntryBullet(entry, baseUrl))
    return [heading, '', ...bullets].join('\n')
  })

  const header = [`# ${title}`, '', `> ${description}`].join('\n')
  const sectionsBlock = sections.length > 0 ? `\n\n${sections.join('\n\n')}` : ''
  return `${header}${sectionsBlock}\n`
}

/**
 * Generate the llmstxt.org-structured `/llms.txt` document.
 *
 * Structure (per https://llmstxt.org):
 *  - `# <title>` (H1)
 *  - `> <description>` (blockquote)
 *  - one `## <Group>` (H2) section per `contentDir.nav.groupBy` value, each
 *    followed by `- [title](url): description` bullets.
 *
 * `baseUrl` is prefixed to each page path; pass an empty string to emit
 * relative URLs (`/docs/getting-started`).
 *
 * `language` scopes the index to ONE locale (see {@link pagesForLanguage}), so
 * each article is listed once at the URL that locale reaches it by. Omitting it
 * lists every page, which is what an app declaring no `languages` wants.
 *
 * An Effect over {@link ContentDirReader} because `contentDir` pages are
 * enumerated from disk.
 */
export const generateLlmsTxtContent = (
  app: App,
  baseUrl: string,
  language?: string
): Effect.Effect<string, ContentDirReadError, ContentDirReader> =>
  Effect.map(collectContentEntries(pagesForLanguage(app, language)), (entries) =>
    renderLlmsIndex(app, baseUrl, entries)
  ).pipe(Effect.withSpan('server.generate-llms-txt'))

/**
 * Generate the `/llms-full.txt` document — the full markdown body of every
 * content-directory page concatenated in order, separated by blank lines.
 *
 * `language` scopes the concatenation to ONE locale (see
 * {@link pagesForLanguage}); omitting it concatenates every page, which is what
 * an app declaring no `languages` wants. An agent asking a multilingual site
 * for its documentation reads one corpus rather than paying for every
 * translation at once.
 *
 * An Effect over {@link ContentDirReader} because each page body is read from
 * disk.
 */
export const generateLlmsFullTxtContent = (
  app: App,
  language?: string
): Effect.Effect<string, ContentDirReadError, ContentDirReader> =>
  Effect.gen(function* () {
    const reader = yield* ContentDirReader
    const perPage = yield* Effect.forEach(
      pagesForLanguage(app, language),
      (page) =>
        page.contentDir ? reader.readBodies(page.contentDir, page.path) : Effect.succeed([]),
      { concurrency: CONTENT_DIR_READ_CONCURRENCY }
    )
    const bodies = perPage
      .flat()
      .filter(({ entry }) => isPublicArticle(entry.access))
      .map(({ body }) => body.trim())
    return bodies.join('\n\n').concat('\n')
  }).pipe(Effect.withSpan('server.generate-llms-full-txt'))
