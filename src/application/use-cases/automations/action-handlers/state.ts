/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationStateRepository } from '@/application/ports/repositories/automation-state-repository'
import { parseDuration } from '@/domain/utils/parse-duration'
import { numberProp, stringProp } from './shared'
import type { ActionHandler } from './shared'

/**
 * `state/set` — upsert a key/value pair scoped to the running automation.
 * Optional `props.ttl` is parsed via `parseDuration` (e.g., `"5s"`, `"10m"`)
 * and translated to an absolute expiration timestamp at write time.
 */
export const handleStateSet: ActionHandler = (action, _app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const key = stringProp(props, 'key')
    if (!key) return { status: 'failure', error: 'state.set requires a key' } as const

    const rawTtl = props['ttl']
    const ttlMs = typeof rawTtl === 'string' && rawTtl !== '' ? parseDuration(rawTtl) : undefined
    if (rawTtl !== undefined && (ttlMs === undefined || Number.isNaN(ttlMs))) {
      return {
        status: 'failure',
        error: `state.set received an invalid ttl: ${String(rawTtl)}`,
      } as const
    }

    const repo = yield* AutomationStateRepository
    const result = yield* Effect.either(
      repo.set({
        automationId: automation.id,
        key,
        value: props['value'],
        ...(ttlMs !== undefined ? { ttlMs } : {}),
      })
    )
    if (result._tag === 'Left') {
      return { status: 'failure', error: String(result.left.cause) } as const
    }
    return { status: 'success' } as const
  })

/**
 * `state/get` — read the value stored under `key`. Returns `null` (visible
 * via `body.actions.<name>.value`) when the key is missing or expired.
 */
export const handleStateGet: ActionHandler = (action, _app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const key = stringProp(props, 'key')
    if (!key) return { status: 'failure', error: 'state.get requires a key' } as const

    const repo = yield* AutomationStateRepository
    const result = yield* Effect.either(repo.get({ automationId: automation.id, key }))
    if (result._tag === 'Left') {
      return { status: 'failure', error: String(result.left.cause) } as const
    }
    return { status: 'success', output: { value: result.right } } as const
  })

/**
 * `state/list` — return all keys matching `props.prefix`, scoped to the
 * running automation. The output shape mirrors the spec assertion
 * (`body.actions.<name>.keys`).
 */
export const handleStateList: ActionHandler = (action, _app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const prefix = stringProp(props, 'prefix')

    const repo = yield* AutomationStateRepository
    const result = yield* Effect.either(repo.list({ automationId: automation.id, prefix }))
    if (result._tag === 'Left') {
      return { status: 'failure', error: String(result.left.cause) } as const
    }
    const entries = result.right
    return {
      status: 'success',
      output: {
        keys: entries.map((entry) => entry.key),
        values: entries.map((entry) => entry.value),
      },
    } as const
  })

/**
 * `state/delete` — remove a key. Idempotent: missing keys do not fail.
 */
export const handleStateDelete: ActionHandler = (action, _app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const key = stringProp(props, 'key')
    if (!key) return { status: 'failure', error: 'state.delete requires a key' } as const

    const repo = yield* AutomationStateRepository
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- false positive: this is a port method, not a Drizzle call; the repo's delete impl uses a where clause internally.
    const result = yield* Effect.either(repo.delete({ automationId: automation.id, key }))
    if (result._tag === 'Left') {
      return { status: 'failure', error: String(result.left.cause) } as const
    }
    return { status: 'success' } as const
  })

/**
 * `state/increment` — atomic numeric increment via JSONB-numeric cast in
 * the repository. Default amount is 1. Output carries the post-increment
 * value (the spec asserts `body.actions.<name>.value`).
 */
export const handleStateIncrement: ActionHandler = (action, _app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const key = stringProp(props, 'key')
    if (!key) return { status: 'failure', error: 'state.increment requires a key' } as const
    const amount = numberProp(props, 'amount', 1)

    const repo = yield* AutomationStateRepository
    const result = yield* Effect.either(
      repo.increment({ automationId: automation.id, key, amount })
    )
    if (result._tag === 'Left') {
      return { status: 'failure', error: String(result.left.cause) } as const
    }
    return { status: 'success', output: { value: result.right } } as const
  })
