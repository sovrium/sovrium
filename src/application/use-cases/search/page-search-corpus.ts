/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  ContentDirReader,
  type ContentDirReadError,
} from '@/application/ports/services/content-dir-reader'
import { primaryPagePath } from '@/domain/kernel/matching/localized-path'
import {
  articleDocument,
  declaredPageDocuments,
  documentsReadableBy,
  searchPageDocuments,
  type PageSearchDocument,
  type PageSearchHit,
} from '@/domain/models/app/pages/page-search-corpus-service'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'

/**
 * Assemble the page corpus for one caller: the declared pages plus every
 * `contentDir` article, filtered by the router's own page-access check.
 *
 * The declared half is built once per `app` object and memoized. A hot swap of
 * `pages` builds a new `App` and a new Hono app with it, so the memo dies with
 * the app it was built from — nothing to invalidate.
 *
 * The article half is built once per state of the content directories on disk:
 * every query asks the reader for each collection's corpus checksum (a stat
 * scan, a millisecond or two for a few hundred files) and rebuilds the article
 * documents — reading every body and stripping it to plain text, the part that
 * grows with the manual — only when one of them changed. A markdown edit
 * triggers no reload, and is still found by the next query.
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

/** One collection page's articles, as search documents. */
interface CollectionDocuments {
  readonly page: Page
  readonly documents: readonly PageSearchDocument[]
}

/** The article documents of an app, and the corpus checksums they were built from. */
interface ArticleIndex {
  readonly key: string
  readonly collections: readonly CollectionDocuments[]
}

const articleIndexMemo = new WeakMap<App, ArticleIndex>()

/** The pages that list a content directory's articles. */
const collectionPages = (app: App): readonly Page[] =>
  (app.pages ?? []).filter((page) => page.contentDir !== undefined && typeof page.path === 'string')

/**
 * Every collection's articles as search documents, read from disk.
 *
 * FAN-OUT WIDTH: config-bounded by the `contentDir` pages, and every branch is a
 * directory read, not a pooled database connection.
 */
const buildCollections = (
  app: App,
  pages: readonly Page[]
): Effect.Effect<readonly CollectionDocuments[], ContentDirReadError, ContentDirReader> =>
  Effect.gen(function* () {
    const reader = yield* ContentDirReader
    // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- filesystem fan-out bounded by the config's `contentDir` pages, no pooled connection; see the doc comment.
    return yield* Effect.forEach(
      pages,
      (page) =>
        reader.readBodies(page.contentDir!, primaryPagePath(page.path)).pipe(
          Effect.map((bodies) => ({
            page,
            documents: bodies.map(({ entry, body }) => articleDocument(app, page, entry, body)),
          }))
        ),
      { concurrency: 'unbounded' }
    )
  }).pipe(Effect.withSpan('pages.build-search-index'))

/**
 * Every collection's articles, or none when a content directory cannot be read
 * — a search missing its articles is degraded, a search that 500s is no search
 * at all. Rebuilt only when a collection's corpus checksum moved.
 */
const articleCollections = (
  app: App
): Effect.Effect<readonly CollectionDocuments[], never, ContentDirReader> =>
  Effect.gen(function* () {
    const reader = yield* ContentDirReader
    const pages = collectionPages(app)
    // eslint-disable-next-line sovrium/no-unbounded-promise-fanout -- filesystem stat scans bounded by the config's `contentDir` pages, no pooled connection.
    const checksums = yield* Effect.forEach(
      pages,
      (page) => reader.corpusChecksum(page.contentDir!),
      { concurrency: 'unbounded' }
    )
    const key = checksums.join('|')
    const cached = articleIndexMemo.get(app)
    if (cached !== undefined && cached.key === key) return cached.collections
    const collections = yield* buildCollections(app, pages)
    // eslint-disable-next-line functional/no-expression-statements -- the memo IS the mutation
    articleIndexMemo.set(app, { key, collections })
    return collections
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[page-search] content directory scan failed', cause)
      })
    ),
    // effect-swallow: logged with its cause above; see the doc comment for why
    // a degraded answer beats an error here.
    Effect.orElseSucceed(() => [] as readonly CollectionDocuments[])
  )

/** The pages and articles `session` may open (or a visitor, when undefined). */
export const loadReadablePageDocuments = (
  app: App,
  session: SessionInfo | undefined
): Effect.Effect<readonly PageSearchDocument[], never, ContentDirReader> =>
  Effect.gen(function* () {
    const collections = yield* articleCollections(app)
    const articles = collections.flatMap((collection) => collection.documents)
    return documentsReadableBy([...declaredDocumentsFor(app), ...articles], app, session)
  }).pipe(Effect.withSpan('pages.load-readable-page-documents'))

/**
 * The articles of the one collection page named `pageName` that `session` may
 * open: none when no page of that name lists a content directory.
 */
const loadReadableCollectionDocuments = (
  app: App,
  session: SessionInfo | undefined,
  pageName: string
): Effect.Effect<readonly PageSearchDocument[], never, ContentDirReader> =>
  Effect.gen(function* () {
    const collections = yield* articleCollections(app)
    const collection = collections.find((candidate) => candidate.page.name === pageName)
    return documentsReadableBy(collection?.documents ?? [], app, session)
  })

/**
 * `GET /api/search/pages` — the pages this reader may open that match `query`,
 * title and text alike, capped at ten. With `pageName`, only the articles of
 * that collection page: the docs sidebar's field searches its own collection.
 */
export const searchReadablePages = (
  app: App,
  query: string,
  session: SessionInfo | undefined,
  pageName?: string
): Effect.Effect<readonly PageSearchHit[], never, ContentDirReader> =>
  Effect.gen(function* () {
    const documents =
      pageName === undefined
        ? yield* loadReadablePageDocuments(app, session)
        : yield* loadReadableCollectionDocuments(app, session, pageName)
    return searchPageDocuments(documents, query, { matchText: () => true, titleFirst: true })
  }).pipe(Effect.withSpan('pages.search-readable-pages'))
