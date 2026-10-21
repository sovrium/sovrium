/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a declared connection is used: the automations whose steps call it, read
 * off the configuration. A step calls a connection when it is a `connection`
 * action naming it in `props.connection`, at the top of the automation or
 * nested inside a path or a loop; the step a run records is the top-level step
 * holding the call, so that is the step name each use carries.
 */

import { entityLabelFor } from '@/domain/models/app/auth/readable-name-service'

/** An automation as far as its connection calls go. */
interface AutomationLike {
  readonly name: string
  readonly label?: string | undefined
  readonly actions: ReadonlyArray<unknown>
}

/** One automation that calls the connection, and the top-level steps holding a call. */
export interface ConnectionUse {
  readonly kind: 'automation'
  readonly name: string
  readonly label: string
  readonly stepNames: readonly string[]
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null

/** Whether `value`, or anything nested in it, is a `connection` action naming `connection`. */
const callsConnection = (value: unknown, connection: string): boolean => {
  if (Array.isArray(value)) return value.some((item) => callsConnection(item, connection))
  if (!isRecord(value)) return false
  const { props } = value
  if (value['type'] === 'connection' && isRecord(props) && props['connection'] === connection) {
    return true
  }
  return Object.values(value).some((child) => callsConnection(child, connection))
}

/**
 * The automations that call `connection`, sorted by name, each with the
 * top-level steps that hold a call in declaration order. An automation that
 * calls it nowhere is absent.
 */
export const connectionUsesOf = (
  automations: ReadonlyArray<AutomationLike> | undefined,
  connection: string
): readonly ConnectionUse[] =>
  (automations ?? [])
    .flatMap((automation) => {
      const stepNames = automation.actions.flatMap((action) =>
        isRecord(action) &&
        typeof action['name'] === 'string' &&
        callsConnection(action, connection)
          ? [action['name']]
          : []
      )
      return stepNames.length === 0
        ? []
        : [
            {
              kind: 'automation' as const,
              name: automation.name,
              label: entityLabelFor(automation),
              stepNames,
            },
          ]
    })
    .toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

/** A recorded step run, as far as picking the newest call of a connection goes. */
interface StepRunLike {
  readonly automationName: string
  readonly stepName: string
  readonly id: string
  readonly startedAt: Readonly<Date> | string | null
}

/** The instant a step run started, for ordering; a run with none sorts oldest. */
const startedMs = (run: StepRunLike): number =>
  run.startedAt === null ? Number.NEGATIVE_INFINITY : new Date(run.startedAt).getTime()

/**
 * The newest of `runs` that is a run of one of the steps `uses` hold, by when
 * it started, ties broken by the larger step-run id; `undefined` when none is.
 * `runs` holds the latest run of each step, read once for every connection, so
 * each connection picks its own here rather than in a read of its own.
 */
export const latestRunOfUses = <Run extends StepRunLike>(
  uses: readonly ConnectionUse[],
  runs: readonly Run[]
): Run | undefined => {
  const steps = new Set(
    uses.flatMap((use) => use.stepNames.map((step) => `${use.name}\u0000${step}`))
  )
  return runs
    .filter((run) => steps.has(`${run.automationName}\u0000${run.stepName}`))
    .reduce<Run | undefined>((newest, run) => {
      if (newest === undefined) return run
      const byStart = startedMs(run) - startedMs(newest)
      return byStart > 0 || (byStart === 0 && run.id > newest.id) ? run : newest
    }, undefined)
}
