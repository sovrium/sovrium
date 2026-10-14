/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A page's automation press once the gate has admitted it and its idempotency
 * key has not answered it (`routes.ts`, `handleFormAction`): the run starts
 * with the input the press sent.
 */

import { Effect } from 'effect'
import { runPagePressedAutomation } from '@/application/use-cases/automations/run-page-pressed-automation'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { triggerResponseAsSeenByCaller } from './trigger-response-body'
import type { PageActionAdmission } from './page-action-gate'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

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
  // A paused or switched-off automation is refused like an unknown name; a
  // signed-in presser (the session the gate judged) is recorded as the starter.
  const program = runPagePressedAutomation({
    ...admitted,
    app,
    processEnv: process.env,
    triggerData,
  })
  const result = await runRequestEffect(c, Effect.result(provideDomain(c, program)))
  if (result._tag === 'Failure') return notFound(c, 'Automation not found')
  if (result.success === undefined) {
    return c.json({ success: false, message: 'Automation dispatch failed' }, 500)
  }
  const started = { automationName: name, result: result.success }
  return c.json(await triggerResponseAsSeenByCaller(c, app, started), 200)
}
