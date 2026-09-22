/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/admin/releases` and `GET /api/admin/releases/:hash` — the boot
 * ledger: every start whose app version or config hash changed, and the
 * row-to-row diff between any boot and the one before it.
 *
 * Authorised by [internal ref] **amendment A6**, surface 8, on A1's invariant —
 * reading the running configuration is observability, mutating it is authoring
 * — plus the one A1 could not state because it had no ledger to reason about:
 * *has what this surface describes already happened?* Every row does.
 *
 * Two GET handlers and **no request schema** in either, because there is no
 * shape a caller can send: the row is written by the boot path, and no HTTP
 * verb here creates, edits or deletes one. There is no revert either — A6
 * refuses it by name, and restoring a previous configuration is `git revert`
 * plus a redeploy, D2's only channel, which this ledger records rather than
 * replaces.
 *
 * ─── THE GUARD IS UPSTREAM, AND IT NEEDS BOTH SPELLINGS ─────────────────────
 *
 * Anti-enumeration 404 (S1) is wired by `requireAdminTier()` in
 * `presentation/api/middleware/admin-route-guards.ts`, in BOTH the auth-enabled
 * and the no-`app.auth` mirror, on the exact path `/api/admin/releases` AND on
 * `/api/admin/releases/*`. Neither entry substitutes for the other: Hono needs
 * at least one segment to match `/*`, so a wildcard-only guard leaves the
 * SEGMENT-LESS list open to anonymous callers, while a bare-path-only guard
 * leaves the detail read open. `[internal ref]` asserts the list
 * path specifically for exactly that reason.
 *
 * A 403 is never the answer. An authenticated non-admin receiving one learns
 * the endpoint exists, and the boot history of an instance is a map of its
 * deploys.
 */

import { Effect } from 'effect'
import { listBootLedger, readBootLedgerEntry } from '@/application/use-cases/admin/boot-ledger'
import {
  releaseDetailResponseSchema,
  releasesListResponseSchema,
} from '@/domain/models/api/admin/releases/ledger'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

const INTERNAL_ERROR = {
  success: false,
  message: 'Failed to read the boot ledger',
  code: 'INTERNAL_ERROR',
} as const

/**
 * The ledger grows on every changed boot, so a cached list answers "what has
 * this instance run?" with what it had run some time ago — the same reason the
 * two config-introspection reads next door are `no-store`.
 */
const noStore = (c: Context): void => c.header('Cache-Control', 'no-store')

/**
 * `GET /api/admin/releases` — every retained boot, newest first, with flat
 * totals beside it.
 *
 * An instance whose ledger was pruned to nothing answers 200 with an empty list
 * and zeroes rather than 404: a 404-when-empty is indistinguishable from a route
 * that was never mounted, and the console draws its empty state from the 200.
 */
export async function handleGetReleases(c: Context, app: App): Promise<Response> {
  const result = await runRequestEffect(
    c,
    provideDomain(c, listBootLedger(app.name)).pipe(Effect.result)
  )
  if (result._tag === 'Failure') {
    logError('[admin] boot-ledger list failed', result.failure)
    return c.json(INTERNAL_ERROR, 500)
  }

  const parsed = decodeSafe(releasesListResponseSchema)(result.success)
  if (!parsed.success) {
    logError('[admin] boot-ledger list response validation failed', parsed.error)
    return c.json(INTERNAL_ERROR, 500)
  }

  noStore(c)
  return c.json(parsed.data, 200)
}

/**
 * `GET /api/admin/releases/:hash` — one boot, its derived DDL and engine
 * migrations, and its diff against the boot before it.
 *
 * The path parameter takes either a twelve-hex config hash or a row id. A hash
 * is the address the console links and an operator reads off a diff, so it has
 * to work — but A → B → A is a legitimate sequence of three boots in which two
 * rows carry the same hash, so a hash resolves to the NEWEST row carrying it
 * while `id` addresses any row exactly.
 *
 * Anything resolving to neither is **404**, never 400. To a caller it is
 * indistinguishable from a hash belonging to another instance, and a 400 would
 * tell an anonymous prober the shape was right — which is also why nothing here
 * validates the parameter's SHAPE before looking it up.
 */
export async function handleGetRelease(c: Context, app: App): Promise<Response> {
  const address = c.req.param('hash') ?? ''
  const result = await runRequestEffect(
    c,
    provideDomain(c, readBootLedgerEntry(app.name, address)).pipe(Effect.result)
  )
  if (result._tag === 'Failure') {
    logError('[admin] boot-ledger detail failed', result.failure)
    return c.json(INTERNAL_ERROR, 500)
  }
  if (result.success === undefined) return notFound(c)

  const parsed = decodeSafe(releaseDetailResponseSchema)(result.success)
  if (!parsed.success) {
    logError('[admin] boot-ledger detail response validation failed', parsed.error)
    return c.json(INTERNAL_ERROR, 500)
  }

  noStore(c)
  return c.json(parsed.data, 200)
}

/**
 * Chain both boot-ledger reads onto a Hono instance.
 *
 * `resolveApp` is the LIVE-App resolver rather than the boot-time `app`, and it
 * is used for ONE thing: the ledger is scoped by `app.name`, and a reload that
 * renamed the app must not make the timeline appear empty.
 */
export function chainAdminReleasesRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .get('/api/admin/releases', (c) => handleGetReleases(c, resolveApp()))
    .get('/api/admin/releases/:hash', (c) => handleGetRelease(c, resolveApp())) as T
}
