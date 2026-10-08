/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord, type Raw } from '@/domain/kernel/config-parsing/plain-object'
import { RETIRED_ACTION_OPERATORS } from './actions/retired-operators'

/**
 * A config still using a REMOVED action operator is refused before the
 * decode, naming the replacement.
 *
 * Before, because the decode would report the operator as an unknown value of
 * whichever union arm it tried last; and on the raw document, because the
 * rest of the config need not be valid for this to be the first thing the
 * author reads. Walks every action an author writes: each automation's
 * `actions`, the actions nested in a loop or a branch at any depth, and the
 * reusable `actions` templates.
 */

/** Every action-shaped object under `value` (a `type` string and an `operator` string). */
const actionsIn = (value: unknown): readonly Raw[] => {
  if (Array.isArray(value)) return value.flatMap(actionsIn)
  if (!isRecord(value)) return []
  const own =
    typeof value['type'] === 'string' && typeof value['operator'] === 'string' ? [value] : []
  return [...own, ...Object.values(value).flatMap(actionsIn)]
}

const refusalsIn = (owner: string, value: unknown): readonly string[] =>
  actionsIn(value).flatMap((action) => {
    const retired =
      RETIRED_ACTION_OPERATORS[`${String(action['type'])}/${String(action['operator'])}`]
    if (retired === undefined) return []
    const step = typeof action['name'] === 'string' ? `, step "${action['name']}"` : ''
    return [`${owner}${step}: ${retired.message}`]
  })

/** One message per action that uses a removed operator. */
export const reportRetiredActionOperators = (parsed: unknown): readonly string[] => {
  if (!isRecord(parsed)) return []
  const automations = Array.isArray(parsed['automations']) ? parsed['automations'] : []
  const templates = Array.isArray(parsed['actions']) ? parsed['actions'] : []
  return [
    ...automations
      .filter(isRecord)
      .flatMap((a) => refusalsIn(`automation "${String(a['name'])}"`, a['actions'])),
    ...templates
      .filter(isRecord)
      .flatMap((t) => refusalsIn(`action template "${String(t['name'])}"`, t['action'])),
  ]
}
