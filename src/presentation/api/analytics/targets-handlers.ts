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
import { analyticsTargetsResponseSchema } from '@/domain/models/api/analytics/analytics'
import { roundedShares } from '@/domain/models/app/analytics/report-rounding-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import {
  answerFailures,
  answerNotFound,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import type { AnalyticsProfile } from '@/domain/models/app/analytics/analytics-profile-service'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'
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

/** The link table as the config declares it, for naming each index. */
export interface TargetLinkView {
  readonly slug: string
  readonly destinations: readonly string[]
}

/** What the handler needs from the analytics route config. */
export interface TargetsHandlerConfig {
  readonly appName: string
  /** The app's role ladder; its top role reads the split beside `admin`. */
  readonly app?: AdminRoleResolvable
  readonly resolveLinks?: () => ReadonlyArray<TargetLinkView>
  /** The effective analytics profile; `audience-only` answers rounded figures. */
  readonly profile: AnalyticsProfile
}

/**
 * The split as the profile answers it. Under `audience-only` each target's
 * clicks are rounded, and the shares and the total are those of the rounded
 * figures, so neither can be worked back to the stored clicks.
 */
const reportedSplit = <E extends { readonly count: number; readonly percentage: number }>(
  targets: readonly E[],
  profile: AnalyticsProfile
) =>
  profile === 'audience-only'
    ? roundedShares(targets)
    : { entries: targets, total: targets.reduce((sum, row) => sum + row.count, 0) }

/**
 * Answer the per-target split.
 *
 * @param c - Hono context.
 * @param config - App name, role ladder and link reader.
 * @returns 200 with the split, 404 for a non-admin, 500 on a read failure.
 */
export function handleTargets(c: Context, config: TargetsHandlerConfig): Promise<Response> {
  return runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const session = getSessionContext(c)
        if (!session) return yield* answerNotFound(c)
        const role = yield* getUserRole(session.userId)
        if (!isAdminEquivalent(role, config.app ?? {})) return yield* answerNotFound(c)

        const eventName = c.req.query('event_name')
        const fromStr = c.req.query('from')
        const toStr = c.req.query('to')

        const result = yield* Effect.gen(function* () {
          const repo = yield* AnalyticsRepository
          return yield* repo.getTargets({
            appName: config.appName,
            eventType: c.req.query('event_type') ?? 'link_click',
            ...(eventName === undefined ? {} : { eventName }),
            from: fromStr === undefined ? new Date(0) : new Date(fromStr),
            to: toStr === undefined ? new Date(Date.now() + ONE_MINUTE_MS) : new Date(toStr),
            granularity: 'day',
          })
        }).pipe(Effect.result)

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
          destination: declared?.destinations[Number(row.name)] ?? null,
        }))

        const split = reportedSplit(targets, config.profile)
        return yield* respondWith(
          c,
          Effect.succeed({ targets: split.entries, total: split.total }),
          analyticsTargetsResponseSchema
        )
      })
    )
  )
}
