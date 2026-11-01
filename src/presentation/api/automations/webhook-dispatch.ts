/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TemplateEngine } from '@/application/ports/services/template-engine'
import { runWebhookAutomation } from '@/application/use-cases/automations/run-automation'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { presentsApiKeyOnly } from '@/presentation/api/middleware/request-credential'
import { webhookNotFound, webhookRegistrySeedFailure } from './webhook-refusals'
import { answerWebhook } from './webhook-revalidation'
import { buildSyncResponse } from './webhook-sync-response'
import { webhookJson } from './webhook-wire-json'
import type { Trigger } from './webhook-methods'
import type { TriggerData } from '@/application/use-cases/automations/resolve-trigger-data'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

const generateRunId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run-${String(Date.now())}-${String(Math.random()).slice(2, 10)}`
}

export interface DispatchInput {
  readonly name: string
  readonly app: App
  readonly triggerData: TriggerData
  readonly userId?: string
  /** Decided once at the door, for either dispatcher (`webhookActsAsSystem`). */
  readonly actsAsSystem: boolean
}

export const dispatchAsync = async (c: Context, input: DispatchInput): Promise<Response> => {
  // The scheduler persists the run row synchronously at queue time and
  // exposes the resulting DB-generated UUID via the `onPersisted` callback.
  // We park here on a Promise that resolves the moment that callback fires
  // so the 202 response carries the SAME id the cancel endpoint can find, or
  // a synthetic one if the engine never invokes the callback.
  let resolveRunId: ((id: string) => void) | undefined
  const runIdPromise = new Promise<string>((resolve) => {
    resolveRunId = resolve
  })

  const program = runWebhookAutomation({
    name: input.name,
    app: input.app,
    triggerData: input.triggerData,
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    actsAsSystem: input.actsAsSystem,
    onPersisted: (id) => {
      if (resolveRunId !== undefined) {
        resolveRunId(id)
        resolveRunId = undefined
      }
    },
  })
  // Fire-and-forget. The caller already received a 202 — log-only if the
  // background run rejects so operators can still detect dispatch crashes.
  Effect.runPromise(Effect.result(provideDomain(c, program))).then(
    (res) => {
      if (res._tag === 'Failure') {
        logError('[automation] async webhook run failed', res.failure)
      }
      // If persistQueuedRun never fired the callback (engine errored
      // before queueing), unblock the response with a synthetic id so
      // the 202 still returns.
      if (resolveRunId !== undefined) {
        resolveRunId(generateRunId())
        resolveRunId = undefined
      }
    },
    (err) => {
      logError('[automation] async webhook run rejected', err)
      if (resolveRunId !== undefined) {
        resolveRunId(generateRunId())
        resolveRunId = undefined
      }
    }
  )
  const runId = await runIdPromise
  // Surface as BOTH `id` (the sync response's key) AND `runId` (the runs API's).
  return webhookJson(c, { id: runId, runId }, 202)
}

export const dispatchSync = (
  c: Context,
  input: DispatchInput & { readonly trigger: WebhookTrigger }
) =>
  Effect.gen(function* () {
    const result = yield* Effect.result(
      runWebhookAutomation({
        name: input.name,
        app: input.app,
        triggerData: input.triggerData,
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        actsAsSystem: input.actsAsSystem,
      })
    )
    if (result._tag === 'Failure') {
      // The pre-dispatch gate already answered a missing or non-webhook automation
      // with 404, so a failure here can only be the lazy registry seed: a 500, so
      // operator dashboards / oncall paging treat it as an outage, not a miss.
      if (result.failure._tag === 'AutomationRegistrySeedError') {
        logError('[automation] webhook dispatch failed: registry seed error', result.failure)
        return webhookRegistrySeedFailure(c)
      }
      return webhookNotFound(c)
    }
    const answer = buildSyncResponse({
      app: input.app,
      automationName: input.name,
      trigger: input.trigger,
      result: result.success,
      triggerData: input.triggerData,
      templates: yield* TemplateEngine,
      apiKeyOnly: presentsApiKeyOnly(c),
    })
    // A failed or exhausted run answers 500: the side effects the caller expected
    // did not happen, and monitoring reads automation health off HTTP status. Not
    // when the operator set `trigger.response.status`, nor when an error
    // `flow/stop` ended the run — the automation chose that failure and answer.
    const cfg = input.trigger.response
    const operatorOverrodeStatus = cfg?.status !== undefined || cfg?.statusCode !== undefined
    const chosen = operatorOverrodeStatus || result.success.stopped === true
    const failed = ['failure', 'exhausted'].includes(result.success.status)
    // A pull revalidates a declared 2xx answer with its ETag (`webhook-revalidation.ts`).
    return answerWebhook(c, { ...answer, status: failed && !chosen ? 500 : answer.status })
  })
