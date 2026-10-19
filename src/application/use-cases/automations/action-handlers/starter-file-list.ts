/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { logError } from '@/infrastructure/logging/logger'
import { listFilesUnder, optionalNumber } from './file-ops'
import { actionAttributes, stringProp } from './shared'
import { starterMayReach, starterStanding, type StarterStanding } from './starter-file-gate'
import type { ActionHandler, ActionOutcome, AutomationContext } from './shared'
import type { App } from '@/domain/models/app'

/**
 * `file/list` in a run someone started by hand: what its starter may reach,
 * and nothing else, judged by THE one decision of `starter-file-gate.ts`.
 *
 * The store is read a page at a time, each page judged with ONE catalog read,
 * and the walk stops at the page that fills `limit` with keys she may reach:
 * a limit of two behind a thousand keys she may not reach reads the pages that
 * hold them, never the whole prefix past them.
 */

type Storage = Effect.Success<typeof StorageService>

/** How many keys one page of a hand-started listing reads. */
export const STARTER_LIST_PAGE = 1000

/**
 * The keys among one page the starter may reach, in order, judged with one
 * catalog read. A page whose catalog rows cannot be read is left out whole:
 * an unjudged key is never shown.
 */
const reachableInPage = (
  storage: Storage,
  judge: { readonly app: App; readonly automation: AutomationContext },
  standing: Extract<StarterStanding, { readonly kind: 'judged' }>,
  keys: readonly string[]
) =>
  storage.catalogBuckets(keys).pipe(
    Effect.map((rows) =>
      keys.filter((key) =>
        // No row: a key the store holds out of band, which no bucket serves.
        starterMayReach(judge.app, judge.automation, { key, bucket: rows.get(key) }, standing)
      )
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[automations] a listing page could not be judged for its starter', cause)
      )
    ),
    // effect-swallow: an unreadable catalog leaves the page out, which only narrows the listing; logged just above.
    Effect.orElseSucceed((): readonly string[] => [])
  )

/**
 * The keys under `prefix` the starter may reach, page after page, until
 * `limit` of them are found (every page when there is no limit). `found`
 * holds one array per page read, so the walk copies no key twice; the
 * cursor's `seen` holds every cursor the store has given.
 */
const walkPages = (
  storage: Storage,
  scope: {
    readonly judge: { readonly app: App; readonly automation: AutomationContext }
    readonly standing: Extract<StarterStanding, { readonly kind: 'judged' }>
    readonly prefix: string
    readonly limit: number | undefined
  },
  cursor: { readonly after: string | undefined; readonly seen: ReadonlySet<string> },
  found: readonly (readonly string[])[]
): Effect.Effect<readonly string[] | undefined> =>
  Effect.gen(function* () {
    const { after, seen } = cursor
    const listed = yield* Effect.result(
      storage.listPage({ prefix: scope.prefix, after, size: STARTER_LIST_PAGE })
    )
    if (listed._tag === 'Failure') return undefined
    // A store that hands back a cursor it already gave — the last one, or one
    // many pages back — would be read forever: the listing fails. Repeats are
    // detected, not order: the database provider's key order is its
    // collation's, which need not be the byte order of the object stores.
    const next = listed.success.after
    if (next !== undefined && (next === after || seen.has(next))) {
      yield* Effect.sync(() =>
        logError('[automations] a listing page repeated its cursor', undefined, {
          'sovrium.storage.prefix': scope.prefix,
        })
      )
      return undefined
    }
    const page = yield* reachableInPage(storage, scope.judge, scope.standing, listed.success.keys)
    const pages = [...found, page]
    const total = pages.reduce((sum, keys) => sum + keys.length, 0)
    const filled = scope.limit !== undefined && total >= scope.limit
    if (filled || next === undefined) return pages.flat()
    return yield* walkPages(storage, scope, { after: next, seen: new Set([...seen, next]) }, pages)
  })

/** The listing of a judged run: its reachable keys, `limit` applied, or the listing error. */
const pagedListing = (
  action: Readonly<Record<string, unknown>>,
  judge: { readonly app: App; readonly automation: AutomationContext },
  standing: Extract<StarterStanding, { readonly kind: 'judged' }>
): Effect.Effect<ActionOutcome, never, StorageService> =>
  Effect.gen(function* () {
    const p = (action['props'] as Readonly<Record<string, unknown>> | undefined) ?? {}
    const prefix = stringProp(p, 'prefix')
    const limit = optionalNumber(p, 'limit')
    const storage = yield* StorageService
    const keys = yield* walkPages(
      storage,
      { judge, standing, prefix, limit },
      { after: undefined, seen: new Set() },
      []
    )
    if (keys === undefined) {
      return { status: 'success', output: { error: `failed to list files under ${prefix}` } }
    }
    const listed = limit !== undefined ? keys.slice(0, limit) : keys
    return { status: 'success', output: { files: listed.map((key) => ({ key })) } } as const
  })

/**
 * `file/list` behind the gate: a run started by hand lists only the keys its
 * starter may reach, and `limit` counts those, never the keys left out, so a
 * prefix holding only refused files lists like one holding nothing. A run
 * whose gate is open lists as `listFilesUnder` always did.
 */
export const gatedFileList: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const standing = yield* starterStanding(app, automation)
    if (standing.kind === 'open') return yield* listFilesUnder(action, Effect.succeed)
    return yield* pagedListing(action, { app, automation }, standing)
  }).pipe(Effect.withSpan('automations.gated-file-list', { attributes: actionAttributes(action) }))
