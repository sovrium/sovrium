/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line no-restricted-syntax -- beside `command-search.ts`, whose page half reads this corpus: one module per search surface, not a phase
import { Data, Effect } from 'effect'
import {
  articleDocument,
  declaredPageDocuments,
  documentsReadableBy,
  searchPageDocuments,
  type PageSearchDocument,
  type PageSearchHit,
} from '@/domain/models/app/pages/page-search-corpus-service'
import { logError } from '@/infrastructure/logging/logger'
import { readContentDirBodies } from '@/infrastructure/markdown/content-dir-enumerator'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/**
 * Assemble the page corpus for one caller: the declared pages plus every
 * `contentDir` article, filtered by the router's own page-access check.
 *
 * The declared half is built once per `app` object and memoized. A hot swap of
 * `pages` builds a new `App` and a new Hono app with it, so the memo dies with
 * the app it was built from — nothing to invalidate. The article half is read
 * from disk per query, as the palette always has: a markdown edit triggers no
 * reload, and a cache keyed on the app would keep serving the old words.
 */

const declaredDocumentsMemo = new WeakMap<App, readonly PageSearchDocument[]>()

const declaredDocumentsFor = (app: App): readonly PageSearchDocument[] => {
  const cached = declaredDocumentsMemo.get(app)
  if (cached !== undefined) return cached
  const built = declaredPageDocuments(app)
  // eslint-disable-next-line functional/no-expression-statements -- the memo IS the mutation
  declaredDocumentsMemo.set(app, built)
  return built
}

const readArticleDocuments = async (app: App): Promise<readonly PageSearchDocument[]> => {
  // FAN-OUT WIDTH: config-bounded by the `contentDir` pages, and every branch is
  // a directory read, not a pooled database connection — the same reasoning as
  // the palette's content scan this replaces.
  // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- filesystem fan-out, no pooled connection; see the note above.
  const perPage = await Promise.all(
    (app.pages ?? [])
      .filter((page) => page.contentDir !== undefined && typeof page.path === 'string')
      .map(async (page) => {
        const bodies = await readContentDirBodies(page.contentDir!, page.path)
        return bodies.map(({ entry, body }) => articleDocument(app, page, entry, body))
      })
  )
  return perPage.flat()
}

class ContentDirScanError extends Data.TaggedError('ContentDirScanError')<{
  readonly cause: unknown
}> {}

/**
 * Every article, or none when a content directory cannot be read — a search
 * missing its articles is degraded, a search that 500s is no search at all.
 */
const articleDocuments = (app: App): Effect.Effect<readonly PageSearchDocument[], never> =>
  Effect.tryPromise({
    try: () => readArticleDocuments(app),
    catch: (cause) => new ContentDirScanError({ cause }),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[page-search] content directory scan failed', cause)
      })
    ),
    // effect-swallow: logged with its cause above; see the doc comment for why
    // a degraded answer beats an error here.
    Effect.orElseSucceed(() => [] as readonly PageSearchDocument[])
  )

/** The pages and articles `session` may open (or a visitor, when undefined). */
export const loadReadablePageDocuments = (
  app: App,
  session: SessionInfo | undefined
): Effect.Effect<readonly PageSearchDocument[], never> =>
  Effect.gen(function* () {
    const articles = yield* articleDocuments(app)
    return documentsReadableBy([...declaredDocumentsFor(app), ...articles], app, session)
  }).pipe(Effect.withSpan('pages.load-readable-page-documents'))

/**
 * `GET /api/search/pages` — the pages this reader may open that match `query`,
 * title and text alike, capped at ten.
 */
export const SearchReadablePages = (
  app: App,
  query: string,
  session: SessionInfo | undefined
): Effect.Effect<readonly PageSearchHit[], never> =>
  Effect.gen(function* () {
    const documents = yield* loadReadablePageDocuments(app, session)
    return searchPageDocuments(documents, query, { matchText: () => true, titleFirst: true })
  }).pipe(Effect.withSpan('pages.search-readable-pages'))
