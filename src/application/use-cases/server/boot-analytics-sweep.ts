/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Effect } from 'effect'
import { minimiseStoredAnalyticsEvents } from '@/application/use-cases/analytics/minimise-stored-events'
import { analyticsIsEnabled } from '@/domain/models/app/analytics/analytics-enabled'
import { resolveAnalyticsProfile } from '@/domain/models/app/analytics/analytics-profile-service'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type { App } from '@/domain/models/app'
import type { Logger } from '@/infrastructure/logging/logger'
import type { Context } from 'effect'

/**
 * Strip the fields the `audience-only` analytics profile excludes from the
 * events already stored, once per start, when that is the app's profile.
 *
 * An app on `full`, or without analytics, is left untouched. Best-effort like
 * the interrupted-run sweep beside it: a sweep that cannot run is logged with
 * its cause and retried at the next start, never a reason to refuse the boot.
 */
export const sweepAnalyticsToProfile = (
  validatedApp: App,
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<void, never, AnalyticsRepository> =>
  (!analyticsIsEnabled(validatedApp) ||
  resolveAnalyticsProfile(validatedApp.analytics) !== 'audience-only'
    ? Effect.void
    : minimiseStoredAnalyticsEvents(validatedApp.name).pipe(
        Effect.flatMap((rewritten) =>
          rewritten === 0
            ? Effect.void
            : logger.info(
                `Removed the fields the audience-only analytics profile excludes from ${rewritten} stored event(s)`
              )
        ),
        Effect.tapCause((cause) =>
          logger.warn(`Analytics profile sweep skipped: ${Cause.pretty(cause)}`)
        ),
        // effect-swallow: see the doc comment — a failed sweep never fails the boot.
        Effect.ignoreCause
      )
  ).pipe(Effect.withSpan('server.sweep-analytics-to-profile'))
