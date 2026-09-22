/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationDigestRepository } from '@/application/ports/repositories/automations/automation-digest-repository'
import {
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionRunContext } from './shared'
import type { DigestReleaseSort } from '@/application/ports/repositories/automations/automation-digest-repository'

/**
 * Resolve `props.<key>` against the run context, returning the actual
 * value (objects/arrays survive). When no `runContext` is supplied —
 * e.g. a unit test invoking the handler directly — falls back to the
 * already-substituted `props` passed by the run loop.
 *
 * Why this exists: the run loop's `resolveTriggerInValue` stringifies
 * non-scalar leaves (`String({…})` → `"[object Object]"`). A digest item
 * sourced from `{{trigger.data.record}}` is a structured object, so
 * the handler must re-resolve from the raw, pre-substitution action to
 * preserve its shape — `deduplicateBy` needs to read a field off it.
 */
const resolvedProp = (
  fallbackProps: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext | undefined,
  key: string
): unknown => {
  if (runContext === undefined) return fallbackProps[key]
  const raw = rawActionProps(runContext)
  return resolveRunContextValue(raw[key], buildRunContextView(runContext))
}

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
export const handleDigestCollect: ActionHandler = (action, _app, automation, runContext) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const digestKey = stringProp(props, 'digestKey')
    if (!digestKey) {
      return { status: 'failure', error: 'digest.collect requires a digestKey' } as const
    }
    // Re-resolve `item` from the raw action so structured payloads
    // (`{{trigger.data.record}}` → an object) survive — the run
    // loop's substitution would have stringified them to "[object Object]".
    const item = resolvedProp(props, runContext, 'item')
    const deduplicateBy =
      typeof props['deduplicateBy'] === 'string' ? props['deduplicateBy'] : undefined

    const repo = yield* AutomationDigestRepository
    const bucketResult = yield* Effect.result(
      repo.findOrCreateActiveBucket({ automationId: automation.id, digestKey })
    )
    if (bucketResult._tag === 'Failure') {
      return { status: 'failure', error: String(bucketResult.failure.cause) } as const
    }
    const dedupeKey = extractDedupeKey(item, deduplicateBy)
    const sizeResult = yield* Effect.result(
      repo.addItem({
        bucketId: bucketResult.success,
        item,
        ...(dedupeKey !== undefined ? { dedupeKey } : {}),
      })
    )
    if (sizeResult._tag === 'Failure') {
      return { status: 'failure', error: String(sizeResult.failure.cause) } as const
    }
    return {
      status: 'success',
      output: { collected: true, digestSize: sizeResult.success },
    } as const
  }).pipe(
    Effect.withSpan('automations.handle-digest-collect', { attributes: actionAttributes(action) })
  )

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
    const result = yield* Effect.result(
      repo.release({
        automationId: automation.id,
        digestKey,
        ...(sort !== undefined ? { sort } : {}),
        ...(limit !== undefined ? { limit } : {}),
      })
    )
    if (result._tag === 'Failure') {
      return { status: 'failure', error: String(result.failure.cause) } as const
    }
    return { status: 'success', output: { items: result.success } } as const
  }).pipe(
    Effect.withSpan('automations.handle-digest-release', { attributes: actionAttributes(action) })
  )
