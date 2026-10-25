/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { SPECIMEN_INSTANT } from '@/domain/models/app/pages/specimen-sample-service'
import { commentTableKeysOf } from '@/domain/models/app/tables/comment-address-service'
import {
  resolveClientRuntimePreloads,
  resolveClientScriptPaths,
} from '@/infrastructure/assets/client-entries'
import { readInvitationFacts } from '@/infrastructure/auth/better-auth/invitation-page-reader'
import { readTwoFactorAttempt } from '@/infrastructure/auth/better-auth/two-factor-attempt-reader'
import { readCommentSummaries } from '@/infrastructure/database/table-queries/query-helpers/comment-summary-queries'
import { cachedLinkPreviews } from '@/infrastructure/egress/link-preview-cache'
import { getSovriumVersion } from '@/infrastructure/process/version'
import { buildIslands } from '@/infrastructure/server/route-setup/island-assets'
import { atRenderInstant } from '@/presentation/render/page/render-clock'
import { renderErrorPage, renderNotFoundPage } from '@/presentation/render/page/render-error-pages'
import { renderPage } from '@/presentation/render/page/render-page'
import { renderRssFeed } from '@/presentation/render/page/render-rss-feed'
import { asSpecimenDrawing } from '@/presentation/render/page/specimen-drawing'
import { signedOutReaderRows } from '@/presentation/render/resolve/reader-row-admission'
import {
  specimenDbOf,
  specimenSessionOf,
  specimenSystemRows,
} from '@/presentation/render/resolve/specimen-sample-db'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

/**
 * Creates a DataSourceDb adapter from the Effect DataSourceRepository.
 *
 * Bridges the Effect-based repository (infrastructure layer) to the
 * plain async interface expected by the presentation rendering layer.
 */
function createDataSourceDbAdapter(
  repo: DataSourceRepository['Service'],
  auth: AuthRepository['Service']
): DataSourceDb {
  return {
    fetchRecords: (tableName, options) => Effect.runPromise(repo.fetchRecords(tableName, options)),
    countRecords: (tableName, filter, options) =>
      Effect.runPromise(repo.countRecords(tableName, filter, options)),
    // eslint-disable-next-line max-params -- implements the port's positional signature; `options` is its optional fifth argument
    fetchSingleRecord: (tableName, paramField, paramValue, fields, options) =>
      Effect.runPromise(repo.fetchSingleRecord(tableName, paramField, paramValue, fields, options)),
    fetchManyToManyLinks: (tableName, recordId, fields) =>
      Effect.runPromise(repo.fetchManyToManyLinks(tableName, recordId, fields)),
    fetchUserAssignments: (userId, tableSlug, role) =>
      Effect.runPromise(repo.fetchUserAssignments(userId, tableSlug, role)),
    // [internal ref] / a pages collection spec: overlay user_access roles onto the
    // Better Auth session role so page access checks see the engineer role.
    fetchUserAccessRoles: (userId) => Effect.runPromise(repo.fetchUserAccessRoles(userId)),
    // The accounts an embedded form's `user` picker offers a signed-in visitor.
    fetchAccountChoices: (limit) => Effect.runPromise(auth.listAccountChoices(limit)),
    // A `page.invitation` page's lookup of the token in its address.
    readInvitation: readInvitationFacts,
    // A code page's lookup of the sign-in waiting for its code.
    readTwoFactorAttempt,
    // The rows a render bringing no reader of its own may list — a feed, a
    // mounted console surface: a signed-out visitor's. The page route folds its
    // request's own reader over it.
    readReaderRows: signedOutReaderRows,
    // The link-preview cards already read for a stored message; reads nothing.
    readLinkPreviews: async (addresses) => cachedLinkPreviews(addresses),
    // A conversation turn's reply summary: approved comments only.
    readCommentSummaries: (table, recordIds) =>
      readCommentSummaries(commentTableKeysOf(table), recordIds),
  }
}

/**
 * Live implementation of PageRenderer using React SSR
 *
 * This Layer provides production page rendering logic,
 * wrapping the presentation layer rendering functions in an
 * Effect Context service.
 *
 * Located in Infrastructure layer because Effect Layer "Live"
 * implementations are adapters (ports/adapters pattern).
 * Infrastructure adapters CAN depend on presentation utilities
 * for rendering logic.
 *
 * @example
 * ```typescript
 * // Provide PageRendererLive to use cases
 * const program = startServer(appConfig).pipe(
 *   Effect.provide(PageRendererLive)
 * )
 * ```
 */
/** What a route hands a render: everything it knows of the request and its caller. */
type RenderRequestContext = Parameters<PageRenderer['Service']['renderPage']>[2]

/**
 * A render's request context, its caller's own readers taken out and folded
 * onto `db`. The route's table reader travels on `db`, beside the other readers
 * the data-source pass is handed, so it reaches every grid that pass stamps
 * without a parameter threaded through each page stage — and so does the
 * mounted console caller's field reader, which her record sheet reads.
 */
const splitCallerReaders = (db: DataSourceDb, requestContext: RenderRequestContext) => {
  const {
    readTableAsCaller,
    callerFieldReader,
    viewerIdentity,
    readRecordLabels,
    readReadPosition,
    loadRowRuleContext,
    readReaderRows,
    readQueryMasks,
    signFileUrl,
    specimen,
    specimenSeed,
    drawnAt,
    ...context
  } = requestContext ?? {}
  const readers: Partial<DataSourceDb> = {
    readTableAsCaller,
    callerFieldReader,
    viewerIdentity,
    readRecordLabels,
    readReadPosition,
    loadRowRuleContext,
    readReaderRows,
    readQueryMasks,
    signFileUrl,
  }
  // Only the readers the route supplied: an absent one keeps the adapter's own.
  const callerDb: DataSourceDb = {
    ...db,
    ...Object.fromEntries(Object.entries(readers).filter(([, reader]) => reader !== undefined)),
  }
  return { specimen, specimenSeed, drawnAt, context, callerDb }
}

export const PageRendererLive = Layer.effect(
  PageRenderer,
  Effect.gen(function* () {
    const dataSourceRepo = yield* DataSourceRepository
    const authRepo = yield* AuthRepository
    const db = createDataSourceDbAdapter(dataSourceRepo, authRepo)
    const islandBuilder = {
      buildIslands,
      clientScriptPaths: resolveClientScriptPaths,
      clientRuntimePreloads: resolveClientRuntimePreloads,
    }
    // `$app.engineVersion` — the engine's OWN version, read ONCE while this
    // Layer is built (before the listener binds) and handed to every render.
    //
    // It is injected HERE rather than threaded from the two route funnels for
    // the reason it is a process constant: a value that cannot vary per request
    // should not travel on one, and the two funnels that would each have to
    // carry it are exactly the pair that has already diverged once over an
    // optional render input. Injecting it beside `db` and `islandBuilder` also
    // keeps `presentation/render/**` free of any `@/infrastructure/process`
    // import — it receives a string and asks no questions about where a version
    // comes from.
    // effect-promise: total -- `getSovriumVersion` falls back to the build-time define and wraps its `package.json` read in a try/catch, so it always resolves a string.
    const engineVersion = yield* Effect.promise(() => getSovriumVersion())

    return {
      renderPage: (app, path, requestContext) => {
        const { specimen, specimenSeed, drawnAt, context, callerDb } = splitCallerReaders(
          db,
          requestContext
        )
        // A specimen reads nothing of the instance: sample readers (or a seed
        // folder's rows) only, none of the caller's own readers, and the sample
        // person (or the seeded account) as its viewer, at the specimen instant
        // (or the one it is drawn at) rather than at whatever the clock says.
        if (specimen === true) {
          return atRenderInstant(drawnAt ?? SPECIMEN_INSTANT, () =>
            asSpecimenDrawing(() =>
              renderPage(app, path, {
                ...context,
                session: specimenSessionOf(specimenSeed),
                db: specimenDbOf(app, specimenSeed),
                fetchSystemRows: specimenSystemRows,
                islandBuilder,
                engineVersion,
                // Nor anything the hosting environment adds around a page: no dev-mode notice.
                devNotice: false,
                // The address is the caller's sample, never a visitor's request.
                sampleAddress: true,
              })
            )
          )
        }
        const render = () =>
          renderPage(app, path, { ...context, db: callerDb, islandBuilder, engineVersion })
        return drawnAt === undefined ? render() : atRenderInstant(drawnAt, render)
      },
      // The `/404` page is a page: it gets the same process facts a page render
      // does, so `$app.engineVersion` resolves and `$session.*` text is filled.
      renderNotFound: (app, detectedLanguage, requestPath) =>
        renderNotFoundPage(app, detectedLanguage, requestPath, {
          db,
          islandBuilder,
          engineVersion,
        }),
      renderError: renderErrorPage,
      // The route's masks reader steers the feed's filter as a signed-out
      // reader's records list steers it, on the counts and lookups it names.
      renderRssFeed: (app, baseUrl, readQueryMasks) =>
        renderRssFeed(app, baseUrl, readQueryMasks === undefined ? db : { ...db, readQueryMasks }),
      fetchSitemapRecords: (tableName, options) => db.fetchRecords(tableName, options),
    }
  })
)
