/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/analytics/targets` — how one link's clicks split across its targets.
 *
 * A sibling module rather than a sixth handler in `analytics.ts` because this
 * reader diverges from the five that live there in two ways that would otherwise
 * read as inconsistency, and both divergences are load-bearing:
 *
 *  1. **404, not 401/403**, for an anonymous or non-admin caller. The five
 *     sibling readers predate the S1 anti-enumeration contract and answer 401
 *     via `unauthorized()`; a new endpoint has no back-compatibility to keep, so
 *     it does not confirm its own existence to a prober. Its middleware
 *     therefore attaches the session WITHOUT `requireAuth`, which would
 *     short-circuit with a 401 before this handler could mask the route.
 *  2. **`from`/`to` are optional.** The siblings answer 400 without them, and
 *     that is pinned by a shipped spec which must keep holding. A split is read
 *     per LINK rather than per window, so demanding a range to ask "how did this
 *     link's traffic divide" would be ceremony.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideAnalyticsLive } from '@/presentation/api/routes/analytics/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Context } from 'hono'

/**
 * One minute of slack on the open-ended `to` bound.
 *
 * The window is unbounded by default, but the underlying `between` still needs
 * an upper bound; taking it slightly into the future keeps a click recorded in
 * the same wall-clock second as the request inside the range — exactly the case
 * a caller that clicks and immediately reads exercises.
 */
const ONE_MINUTE_MS = 60_000

/** The link table as the live config declares it, for naming each index. */
export interface TargetLinkView {
  readonly slug: string
  readonly destinations: readonly string[]
}

/** What the handler needs from the analytics route config. */
export interface TargetsHandlerConfig {
  readonly appName: string
  readonly resolveLinks?: () => ReadonlyArray<TargetLinkView>
}

/**
 * Answer the per-target split.
 *
 * @param c - Hono context.
 * @param config - App name plus the live link resolver.
 * @returns 200 with the split, 404 for a non-admin, 500 on a read failure.
 */
export async function handleTargets(c: Context, config: TargetsHandlerConfig): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) return c.notFound()
  const role = await getUserRole(session.userId)
  if (!isAdminRole(role)) return c.notFound()

  const eventName = c.req.query('event_name')
  const fromStr = c.req.query('from')
  const toStr = c.req.query('to')

  const result = await runRequestEffect(
    c,
    Effect.gen(function* () {
      const repo = yield* AnalyticsRepository
      return yield* repo.getTargets({
        appName: config.appName,
        eventType: c.req.query('event_type') ?? 'link_click',
        ...(eventName === undefined ? {} : { eventName }),
        from: fromStr === undefined ? new Date(0) : new Date(fromStr),
        to: toStr === undefined ? new Date(Date.now() + ONE_MINUTE_MS) : new Date(toStr),
        granularity: 'day',
      })
    }).pipe(provideAnalyticsLive, Effect.result)
  )

  if (result._tag === 'Failure') {
    return c.json(
      { success: false, message: 'Failed to read the split', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // Resolve each recorded index against the link's CURRENT target list. An index
  // the list no longer covers reports a null destination rather than being
  // dropped: dropping it would stop the percentages summing and would discard
  // exactly the traffic the operator re-pointed the link because of.
  const declared =
    eventName === undefined
      ? undefined
      : config.resolveLinks?.().find((link) => link.slug === eventName)

  const targets = result.success.map((row) => ({
    ...row,
    // eslint-disable-next-line unicorn/no-null -- JSON wire contract: the spec asserts `destination === null` for an orphaned index, and `undefined` would drop the key entirely
    destination: declared?.destinations[Number(row.name)] ?? null,
  }))

  return c.json({ targets, total: targets.reduce((sum, row) => sum + row.count, 0) }, 200)
}
