/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AnalyticsRepository } from '@/application/ports/repositories/analytics-repository'
import { isFormAnalyticsEnabled } from '@/infrastructure/utils/env'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

const isFormOptedOut = (form: Readonly<Form>): boolean =>
  form.analytics !== undefined && form.analytics.enabled === false

const isAppAnalyticsEnabled = (app: Readonly<App>): boolean => {
  if (app.analytics === undefined) return false
  if (app.analytics === true) return true
  if (app.analytics === false) return false
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
