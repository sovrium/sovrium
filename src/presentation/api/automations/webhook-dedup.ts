/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTriggerInString } from '@/application/use-cases/automations/resolve-trigger-data'
import type { TemplateRenderer } from '@/application/ports/services/template-engine'
import type { TriggerData } from '@/application/use-cases/automations/resolve-trigger-data'
import type { Trigger } from '@/domain/models/app/automations/trigger'

/**
 * Webhook per-trigger deduplication (in-memory, TTL-bounded). Mirrors the
 * pattern used by `webhook-rate-limit.ts`: a process-local store keyed by
 * the automation and a SHA-256 of the resolved key, so a caller's key costs
 * the same few bytes whatever its length.
 *
 * The dedup key is computed from the request body via the trigger's
 * `deduplicationKey` template (e.g. `'{{body.orderId}}'`); the same key
 * seen within `deduplicationWindow` seconds is dropped silently. Same
 * single-process caveat as the rate limiter: horizontal scale-out would
 * need a shared store.
 *
 * The store is bounded on both axes a caller controls: every entry past its
 * own window is forgotten on the next write (at most once per
 * {@link SWEEP_EVERY_MS}, and whenever the store is full), and a store still
 * full after that forgets its oldest entry first, so it never holds more than
 * {@link MAX_DEDUP_ENTRIES} keys.
 */
type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

/** The most keys the store holds at once. */
export const MAX_DEDUP_ENTRIES = 10_000

/** The longest the store goes without forgetting expired entries, while it is written to. */
const SWEEP_EVERY_MS = 1000

/** A store of recently seen keys, each forgotten once its own window has passed. */
export interface DedupStore {
  /** `true` when `key` was seen within `windowMs` of `now`; otherwise records it and answers `false`. */
  readonly seen: (key: string, windowMs: number, now?: number) => boolean
  /** How many keys the store holds. */
  readonly size: () => number
}

/** A fresh store holding at most `maxEntries` keys. */
export const createDedupStore = (maxEntries: number = MAX_DEDUP_ENTRIES): DedupStore => {
  // Insertion order is age order: a key recorded again is deleted first.
  const expiries = new Map<string, number>()
  const sweep = { at: 0 }
  const forgetExpired = (now: number): void => {
    sweep.at = now
    const expired = [...expiries.entries()].filter(([, at]) => at <= now).map(([key]) => key)
    expired.forEach((key) => expiries.delete(key))
  }
  const forgetOldest = (): void => {
    const excess = expiries.size - maxEntries + 1
    if (excess <= 0) return
    const oldest = [...expiries.keys()].slice(0, excess)
    oldest.forEach((key) => expiries.delete(key))
  }
  return {
    seen: (key, windowMs, now = Date.now()) => {
      const hashed = new Bun.CryptoHasher('sha256').update(key).digest('base64url')
      const expiresAt = expiries.get(hashed)
      if (expiresAt !== undefined && expiresAt > now) return true
      if (now - sweep.at >= SWEEP_EVERY_MS || expiries.size >= maxEntries) forgetExpired(now)
      expiries.delete(hashed)
      forgetOldest()
      expiries.set(hashed, now + windowMs)
      return false
    },
    size: () => expiries.size,
  }
}

const dedupState = createDedupStore()

const dedupCacheKey = (automationName: string, value: string): string =>
  `${automationName}\u0000${value}`

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
  readonly templates: TemplateRenderer
}): { readonly isDuplicate: boolean } => {
  const { automationName, trigger, triggerData, templates } = input
  const keyTemplate = trigger.deduplicationKey
  if (keyTemplate === undefined || keyTemplate === '') return { isDuplicate: false }

  // The dedup template is resolved against `{{body.X}}` — same view used
  // by `webhook/response` body templates. We construct the canonical
  // automation context so authors can also use `{{trigger.data.body.X}}`
  // if they prefer the longer form.
  const ctx = { body: triggerData.body ?? {}, trigger: { data: triggerData } }
  const resolved = resolveTriggerInString(keyTemplate, ctx, templates)
  if (resolved === '' || resolved === 'undefined' || resolved === 'null') {
    return { isDuplicate: false }
  }

  const windowSeconds = trigger.deduplicationWindow ?? 300
  const isDuplicate = dedupState.seen(dedupCacheKey(automationName, resolved), windowSeconds * 1000)
  return { isDuplicate }
}
