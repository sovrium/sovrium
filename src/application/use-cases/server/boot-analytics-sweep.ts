/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import { minimiseStoredAnalyticsEvents } from '@/application/use-cases/analytics/minimise-stored-events'
import { analyticsIsEnabled } from '@/domain/models/app/analytics/analytics-enabled'
import { resolveAnalyticsProfile } from '@/domain/models/app/analytics/analytics-profile-service'
import type { App } from '@/domain/models/app'
import type { Logger } from '@/infrastructure/logging/logger'
import type { Context } from 'effect'

/**
 * Strip the fields the `audience-only` analytics profile excludes from the
 * events already stored, once, at the first start on that profile.
 *
 * The profile the last start ran under is kept in the database
 * (`readSweptProfile`). A start on `audience-only` sweeps only when that record
 * is absent or another profile, then records `audience-only`, so a restart on
 * an unchanged profile never scans the events table. A start on `full` sweeps
 * nothing and records `full`, so the next start back on `audience-only` sweeps
 * the events it stored. Restoring a backup restores its record with its events.
 * An app without analytics is left untouched.
 *
 * Best-effort like the interrupted-run sweep beside it: a sweep that cannot run
 * is logged with its cause, records nothing and is retried at the next start,
 * never a reason to refuse the boot.
 */
export const sweepAnalyticsToProfile = (
  validatedApp: App,
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<void, never, AnalyticsRepository> =>
  (!analyticsIsEnabled(validatedApp)
    ? Effect.void
    : sweepWhenProfileChanged(validatedApp, logger).pipe(
        Effect.tapCause((cause) =>
          logger.warn(`Analytics profile sweep skipped: ${Cause.pretty(cause)}`)
        ),
        // effect-swallow: see the doc comment — a failed sweep never fails the boot.
        Effect.ignoreCause
      )
  ).pipe(Effect.withSpan('server.sweep-analytics-to-profile'))

/** Sweep on a switch to `audience-only`, then record the profile this start runs under. */
const sweepWhenProfileChanged = (validatedApp: App, logger: Context.Service.Shape<typeof Logger>) =>
  Effect.gen(function* () {
    const repository = yield* AnalyticsRepository
    const profile = resolveAnalyticsProfile(validatedApp.analytics)
    const previous = yield* repository.readSweptProfile
    if (profile === 'audience-only' && previous !== 'audience-only') {
      const rewritten = yield* minimiseStoredAnalyticsEvents(validatedApp.name)
      if (rewritten > 0) {
        yield* logger.info(
          `Removed the fields the audience-only analytics profile excludes from ${rewritten} stored event(s)`
        )
      }
    }
    if (previous !== profile) yield* repository.recordSweptProfile(profile)
  })
