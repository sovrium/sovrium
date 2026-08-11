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
 * Per the F-04 locked plan: form submissions become the 7th `event_type`
 * on the existing unified analytics_events table ([internal ref] extended, no
 * new DEC). Gated by:
 *   - `ECO_FORM_ANALYTICS` env (default ON; frugal-by-default per
 *     ecoconception R-2 — operators opt OUT, never IN)
 *   - `app.analytics` truthy (omitted or `false` → no events)
 *   - per-form `analytics.enabled !== false` (form-level opt-out for
 *     PHI/PCI/legal-hold sensitive surfaces)
 *
 * Failures inside this emission MUST NOT roll back the submission.
 * Wrapped in `Effect.ignore` so analytics errors silently no-op — the
 * canonical record of the submission is the `system.form_submissions`
 * ledger row written upstream.
 */

import { Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import { isFormAnalyticsEnabled } from '@/infrastructure/utils/env'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * Check whether the per-form opt-out has explicitly disabled aggregate
 * analytics for this form. Default (omitted, or `enabled` omitted) is
 * enabled — only an explicit `analytics.enabled: false` opts out.
 */
const isFormOptedOut = (form: Readonly<Form>): boolean =>
  form.analytics !== undefined && form.analytics.enabled === false

/**
 * Check whether the app-level analytics block enables analytics. The
 * `BuiltInAnalyticsSchema` accepts `true | false | {...}`. Treat the
 * struct form and `true` as enabled; `false` and omitted as disabled.
 */
const isAppAnalyticsEnabled = (app: Readonly<App>): boolean => {
  if (app.analytics === undefined) return false
  if (app.analytics === true) return true
  if (app.analytics === false) return false
  // Struct form — `enabled` is optional; default = true when omitted.
  return true
}

export interface EmitFormSubmissionAnalyticsInput {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly submissionId: string | undefined
  readonly submitterIpHash: string | undefined
}

export const emitFormSubmissionAnalyticsEvent = (
  input: EmitFormSubmissionAnalyticsInput
): Effect.Effect<void, never, AnalyticsRepository> =>
  Effect.gen(function* () {
    const { app, form, submissionId, submitterIpHash } = input

    // Three-layer gate: env, app, form.
    if (!isFormAnalyticsEnabled()) return
    if (!isAppAnalyticsEnabled(app)) return
    if (isFormOptedOut(form)) return

    const analytics = yield* AnalyticsRepository
    const visitorHash = submitterIpHash ?? 'anonymous'
    const properties: Readonly<Record<string, unknown>> = {
      formName: form.name,
      formId: form.id,
      ...(submissionId !== undefined ? { submissionId } : {}),
    }

    yield* analytics
      .recordEvent({
        appName: app.name,
        eventType: 'form_submission',
        eventName: form.name,
        visitorHash,
        sessionHash: visitorHash,
        properties,
      })
      .pipe(Effect.ignore)
  })
