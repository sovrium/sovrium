/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationStateRepository } from '@/application/ports/repositories/automations/automation-state-repository'
import { selectNewItems } from '@/domain/models/app/automations/actions/state/filter-new-service'
import { asArray, resolveOwnProps } from './run-context-resolution'
import { actionAttributes } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

const DEFAULT_REMEMBER = 1000

/** State key holding the keys a filterNew step has returned, per step and namespace. */
const seenStateKey = (stepName: string, namespace: string | undefined): string =>
  `filter-new:${namespace ?? 'default'}:${stepName}`

const failure = (error: string): ActionOutcome => ({ status: 'failure', error }) as const

const readCursorProps = (
  raw: unknown
): { readonly field: string; readonly stateKey: string } | undefined => {
  if (raw === null || typeof raw !== 'object') return undefined
  const { field, stateKey } = raw as Record<string, unknown>
  return typeof field === 'string' && typeof stateKey === 'string' ? { field, stateKey } : undefined
}

interface FilterNewProps {
  readonly key: string
  readonly cursor: { readonly field: string; readonly stateKey: string } | undefined
  readonly namespace: string | undefined
  readonly stepName: string
  readonly remember: number
  readonly initial: 'skip' | 'emit'
}

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

const parseFilterNewProps = (
  action: Readonly<Record<string, unknown>>,
  props: Readonly<Record<string, unknown>>
): FilterNewProps | undefined => {
  const key = optionalString(props['key'])
  if (key === undefined) return undefined
  return {
    key,
    cursor: readCursorProps(props['cursor']),
    namespace: optionalString(props['namespace']),
    stepName: optionalString(action['name']) ?? 'filterNew',
    remember: typeof props['remember'] === 'number' ? props['remember'] : DEFAULT_REMEMBER,
    initial: props['initial'] === 'emit' ? 'emit' : 'skip',
  }
}

/**
 * `state/filterNew` — keep only the items of a list this step has not
 * returned before, and remember them (and the highest cursor value) in the
 * app's key-value state for the next run. Memory is per automation (the
 * repository scopes every key by automation id), per step name and per
 * namespace. The cursor is stored under its plain `stateKey` so a
 * `state` / `get` step reads it back before the next request.
 */
export const handleStateFilterNew: ActionHandler = (action, _app, automation, runContext) =>
  Effect.gen(function* () {
    if (runContext === undefined) return failure('state.filterNew requires a run context')
    // The props as written, filled in once (or as given when final): `input`
    // keeps its list, and an env reference in `key` or `namespace` resolves.
    const own = resolveOwnProps(runContext)
    const parsed = parseFilterNewProps(action, own)
    if (parsed === undefined) return failure('state.filterNew requires a key')
    const { key, cursor, namespace, stepName, remember, initial } = parsed
    const items = asArray(own['input'])

    const repo = yield* AutomationStateRepository
    const seenKey = seenStateKey(stepName, namespace)
    const memory = yield* Effect.all({
      seen: repo.get({ automationId: automation.id, key: seenKey }),
      cursor:
        cursor === undefined
          ? Effect.void
          : repo.get({ automationId: automation.id, key: cursor.stateKey }),
    })

    const result = selectNewItems(
      items,
      {
        seen: Array.isArray(memory.seen) ? memory.seen.map(String) : undefined,
        cursor: memory.cursor,
      },
      { key, cursorField: cursor?.field, initial, remember }
    )

    yield* repo.set({ automationId: automation.id, key: seenKey, value: result.seen })
    if (cursor !== undefined && result.cursor !== undefined) {
      yield* repo.set({ automationId: automation.id, key: cursor.stateKey, value: result.cursor })
    }

    return {
      status: 'success',
      output: { items: result.items, count: result.items.length },
    } as const satisfies ActionOutcome
  }).pipe(
    Effect.catchTag('AutomationStateDatabaseError', (error) =>
      Effect.succeed(failure(String(error.cause)))
    ),
    Effect.withSpan('automations.handle-state-filter-new', {
      attributes: actionAttributes(action),
    })
  )
