/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTriggerInString } from '@/application/use-cases/automations/resolve-trigger-data'
import type { TriggerData } from '@/application/use-cases/automations/resolve-trigger-data'
import type { App } from '@/domain/models/app'


type Trigger = NonNullable<App['automations']>[number]['trigger']
type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

interface DedupEntry {
  readonly seenAtMs: number
}

const dedupState = new Map<string, DedupEntry>()

const dedupCacheKey = (automationName: string, value: string): string =>
  `${automationName}:${value}`

export const checkAndRecordDedup = (input: {
  readonly automationName: string
  readonly trigger: WebhookTrigger
  readonly triggerData: TriggerData
}): { readonly isDuplicate: boolean } => {
  const { automationName, trigger, triggerData } = input
  const keyTemplate = trigger.deduplicationKey
  if (keyTemplate === undefined || keyTemplate === '') return { isDuplicate: false }

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
  dedupState.set(cacheKey, { seenAtMs: now })
  return { isDuplicate: false }
}
