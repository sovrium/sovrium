/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Emit a `form_submission` row to the unified `system.analytics_events`
 * table after a successful form submission lands.
 *
 * Per the [internal ref] locked plan: form submissions become the 7th `event_type`
 * on the existing unified analytics_events table (the unified analytics events table extended, no
 * new DEC). Gated by:
 *   - `ECO_FORM_ANALYTICS` env (default ON; frugal-by-default per
 *     ecoconception R-2 — operators opt OUT, never IN)
 *   - `app.analytics` truthy (omitted or `false` → no events)
 *   - per-form `analytics.enabled !== false` (form-level opt-out for
 *     PHI/PCI/legal-hold sensitive surfaces)
 *   - the submitter's browser privacy signal (`DNT` / `Sec-GPC`), honoured
 *     exactly as page views honour it, judged at the route
 *
 * Failures inside this emission MUST NOT roll back the submission.
 * Wrapped in `Effect.ignore` so analytics errors silently no-op — the
 * canonical record of the submission is the `system.form_submissions`
 * ledger row written upstream.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import { analyticsIsEnabled } from '@/domain/models/app/analytics/analytics-enabled'
import {
  SHARED_IDENTIFIERS,
  profiledProperties,
  resolveAnalyticsProfile,
} from '@/domain/models/app/analytics/analytics-profile-service'
import { isFormAnalyticsEnabled } from '@/infrastructure/process/env'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * Check whether the per-form opt-out has explicitly disabled aggregate
 * analytics for this form. Default (omitted, or `enabled` omitted) is
 * enabled — only an explicit `analytics.enabled: false` opts out.
 */
const isFormOptedOut = (form: Readonly<Form>): boolean =>
  form.analytics !== undefined && form.analytics.enabled === false

export interface EmitFormSubmissionAnalyticsInput {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly submissionId: string | undefined
  readonly submitterIpHash: string | undefined
  /** The submitter's browser sent a privacy signal the app honours. */
  readonly declinesTracking: boolean
}

export const emitFormSubmissionAnalyticsEvent = (
  input: EmitFormSubmissionAnalyticsInput
): Effect.Effect<void, never, AnalyticsRepository> =>
  Effect.gen(function* () {
    const { app, form, submissionId, submitterIpHash } = input

    // Four-layer gate: env, app, form, the submitter's privacy signal.
    if (!isFormAnalyticsEnabled()) return
    if (!analyticsIsEnabled(app)) return
    if (isFormOptedOut(form)) return
    if (input.declinesTracking) return

    const analytics = yield* AnalyticsRepository
    // Under `audience-only` every submission shares one identifier and names
    // no submission, so the event counts the form without pointing at a person.
    const profile = resolveAnalyticsProfile(app.analytics)
    const submitter = submitterIpHash ?? 'anonymous'
    const identifiers =
      profile === 'full' ? { visitorHash: submitter, sessionHash: submitter } : SHARED_IDENTIFIERS
    const properties = profiledProperties(profile, 'form_submission', {
      formName: form.name,
      formId: form.id,
      ...(submissionId !== undefined ? { submissionId } : {}),
    })

    yield* analytics
      .recordEvent({
        appName: app.name,
        eventType: 'form_submission',
        eventName: form.name,
        ...identifiers,
        properties,
      })
      .pipe(
        // effect-swallow: an analytics row about a submission that has already succeeded. Failing here would turn a completed form submission into an error the user sees, to record that it happened.
        Effect.ignore
      )
  }).pipe(Effect.withSpan('forms.emit-form-submission-analytics-event'))
