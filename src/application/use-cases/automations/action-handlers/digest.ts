/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationDigestRepository } from '@/application/ports/repositories/automation-digest-repository'
import { stringProp } from './shared'
import type { ActionHandler } from './shared'
import type { DigestReleaseSort } from '@/application/ports/repositories/automation-digest-repository'

/**
 * Extract the dedupe key from an item per the action's `deduplicateBy`
 * field. Returns undefined when `deduplicateBy` is absent or the field is
 * missing on the item; the caller falls back to non-deduped insert.
 */
const extractDedupeKey = (item: unknown, deduplicateBy: string | undefined): string | undefined => {
  if (deduplicateBy === undefined || deduplicateBy === '') return undefined
  if (typeof item !== 'object' || item === null) return undefined
  const raw = (item as Record<string, unknown>)[deduplicateBy]
  return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : undefined
}

const releaseSortFromProps = (raw: unknown): DigestReleaseSort | undefined => {
  if (raw === undefined || raw === null || typeof raw !== 'object') return undefined
  const sort = raw as Record<string, unknown>
  const field = typeof sort['field'] === 'string' ? sort['field'] : undefined
  const direction = sort['direction'] === 'desc' ? 'desc' : 'asc'
  return field !== undefined ? { field, direction } : undefined
}

/**
 * `digest/collect` — accumulate `props.item` into the active bucket for
 * `props.digestKey` (creating the bucket if needed). When
 * `props.deduplicateBy` is set, items whose extracted key already exists
 * in the bucket are skipped silently. Output: `{ collected, digestSize }`.
 */
export const handleDigestCollect: ActionHandler = (action, _app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const digestKey = stringProp(props, 'digestKey')
    if (!digestKey) {
      return { status: 'failure', error: 'digest.collect requires a digestKey' } as const
    }
    const { item } = props
    const deduplicateBy =
      typeof props['deduplicateBy'] === 'string' ? props['deduplicateBy'] : undefined

    const repo = yield* AutomationDigestRepository
    const bucketResult = yield* Effect.either(
      repo.findOrCreateActiveBucket({ automationId: automation.id, digestKey })
    )
    if (bucketResult._tag === 'Left') {
      return { status: 'failure', error: String(bucketResult.left.cause) } as const
    }
    const dedupeKey = extractDedupeKey(item, deduplicateBy)
    const sizeResult = yield* Effect.either(
      repo.addItem({
        bucketId: bucketResult.right,
        item,
        ...(dedupeKey !== undefined ? { dedupeKey } : {}),
      })
    )
    if (sizeResult._tag === 'Left') {
      return { status: 'failure', error: String(sizeResult.left.cause) } as const
    }
    return {
      status: 'success',
      output: { collected: true, digestSize: sizeResult.right },
    } as const
  })

/**
 * `digest/release` — flush the active bucket for `props.digestKey`,
 * marking it `released`, and return its items (optionally sorted/limited
 * via `props.sort` and `props.limit`). Output: `{ items: [...] }`.
 */
export const handleDigestRelease: ActionHandler = (action, _app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const digestKey = stringProp(props, 'digestKey')
    if (!digestKey) {
      return { status: 'failure', error: 'digest.release requires a digestKey' } as const
    }
    const sort = releaseSortFromProps(props['sort'])
    const rawLimit = props['limit']
    const limit =
      typeof rawLimit === 'number' && Number.isFinite(rawLimit) && rawLimit >= 0
        ? Math.floor(rawLimit)
        : undefined

    const repo = yield* AutomationDigestRepository
    const result = yield* Effect.either(
      repo.release({
        automationId: automation.id,
        digestKey,
        ...(sort !== undefined ? { sort } : {}),
        ...(limit !== undefined ? { limit } : {}),
      })
    )
    if (result._tag === 'Left') {
      return { status: 'failure', error: String(result.left.cause) } as const
    }
    return { status: 'success', output: { items: result.right } } as const
  })
