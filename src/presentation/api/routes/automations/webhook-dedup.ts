/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTriggerInString } from '@/application/use-cases/automations/resolve-trigger-data'
import type { TriggerData } from '@/application/use-cases/automations/resolve-trigger-data'
import type { App } from '@/domain/models/app'

/**
 * Webhook per-trigger deduplication (in-memory, TTL-bounded). Mirrors the
 * pattern used by `webhook-rate-limit.ts` — a process-local Map keyed by
 * `automationName:dedupKey`. APP-AUTOMATION-RETRY-016.
 *
 * The dedup key is computed from the request body via the trigger's
 * `deduplicationKey` template (e.g. `'{{body.orderId}}'`); the same key
 * seen within `deduplicationWindow` seconds is dropped silently. Same
 * single-process caveat as the rate limiter — horizontal scale-out would
 * need a shared store.
 */

type Trigger = NonNullable<App['automations']>[number]['trigger']
type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

interface DedupEntry {
  readonly seenAtMs: number
}

const dedupState = new Map<string, DedupEntry>()

const dedupCacheKey = (automationName: string, value: string): string =>
  `${automationName}:${value}`

/**
 * Public API: returns `true` when the request should be processed (no
 * duplicate seen within the window) and `false` when the key matches a
 * recent request. Side-effect: records the key with the current timestamp
 * when not a duplicate.
 *
 * Resolves the template against the request body using the same engine as
 * the run loop. When the template resolves to an empty string we skip dedup
 * (no valid key extracted) so the request runs normally — the operator's
 * intent ("dedup this key") is only enforceable when the key is present.
 */
export const checkAndRecordDedup = (input: {
  readonly automationName: string
  readonly trigger: WebhookTrigger
  readonly triggerData: TriggerData
}): { readonly isDuplicate: boolean } => {
  const { automationName, trigger, triggerData } = input
  const keyTemplate = trigger.deduplicationKey
  if (keyTemplate === undefined || keyTemplate === '') return { isDuplicate: false }

  // The dedup template is resolved against `{{body.X}}` — same view used
  // by `webhook/response` body templates. We construct the canonical
  // automation context so authors can also use `{{trigger.data.body.X}}`
  // if they prefer the longer form.
  const ctx = { body: triggerData.body ?? {}, trigger: { data: triggerData } }
  const resolved = resolveTriggerInString(keyTemplate, ctx)
  if (resolved === '' || resolved === 'undefined' || resolved === 'null') {
    return { isDuplicate: false }
  }

  const windowSeconds = trigger.deduplicationWindow ?? 300
  const windowMs = windowSeconds * 1000
  const now = Date.now()
  const cacheKey = dedupCacheKey(automationName, resolved)
  const existing = dedupState.get(cacheKey)
  if (existing !== undefined && now - existing.seenAtMs < windowMs) {
    return { isDuplicate: true }
  }
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable state, mirrored from webhook-rate-limit
  dedupState.set(cacheKey, { seenAtMs: now })
  return { isDuplicate: false }
}
