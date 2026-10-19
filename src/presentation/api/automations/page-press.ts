/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A page's automation press once the gate has admitted it and its idempotency
 * key has not answered it (`routes.ts`, `handleFormAction`): the run starts
 * with the input the press sent, once the record it names (`press`), if any,
 * is judged.
 */

import { Effect, Schema } from 'effect'
import { runPagePressedAutomation } from '@/application/use-cases/automations/run-page-pressed-automation'
import { pressReferenceSchema } from '@/domain/models/api/automations/automations'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { pressDisabledResponse } from '@/presentation/api/runtime/press-disabled-response'
import { triggerResponseAsSeenByCaller } from './trigger-response-body'
import type { PageActionAdmission } from './page-action-gate'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The record a row action or a record-bound button names (`press`), or
 * `undefined` when the body names none. A reference that does not read as one
 * is `'malformed'`, answered as an unknown name: it can name no control.
 */
const pressOf = (body: object) => {
  const sent = (body as { readonly press?: unknown }).press
  if (sent === undefined) return undefined
  const decoded = Schema.decodeUnknownOption(pressReferenceSchema)(sent)
  return decoded._tag === 'Some' ? decoded.value : 'malformed'
}

/** A press past the gate: the automation started with the input it was sent. */
export async function startPagePress(
  c: Context,
  app: App,
  press: { readonly name: string; readonly admitted: PageActionAdmission; readonly body: object }
) {
  const { name, admitted } = press
  const inputData = (press.body as { inputData?: Record<string, unknown> }).inputData ?? {}
  // The payload is exposed at BOTH `trigger.data.body.X` (the form/webhook shape)
  // AND `trigger.input.X` (the manual-trigger input shape a `manual` run reads).
  const triggerData = { body: inputData, input: inputData }
  const reference = pressOf(press.body)
  if (reference === 'malformed') return notFound(c, 'Automation not found')
  // A press naming no record runs only through a control the server does not
  // judge: when every one the caller can reach is judged, it answers as unknown.
  if (reference === undefined && !admitted.reachesUnjudged()) {
    return notFound(c, 'Automation not found')
  }
  // A paused or switched-off automation is refused like an unknown name; a
  // signed-in presser (the session the gate judged) is recorded as the starter.
  const program = runPagePressedAutomation({
    automation: admitted.automation,
    userId: admitted.userId,
    app,
    processEnv: process.env,
    triggerData,
    ...(reference === undefined ? {} : { press: reference }),
  })
  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  if (result._tag === 'Failure') {
    const { failure } = result
    return failure._tag === 'AutomationPressDisabled'
      ? pressDisabledResponse(c, failure.message)
      : notFound(c, 'Automation not found')
  }
  if (result.success === undefined) {
    return c.json({ success: false, message: 'Automation dispatch failed' }, 500)
  }
  const started = { automationName: name, result: result.success }
  return c.json(await triggerResponseAsSeenByCaller(c, app, started), 200)
}
