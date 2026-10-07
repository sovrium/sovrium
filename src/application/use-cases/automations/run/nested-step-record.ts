/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The steps a `path/branch` or a `loop/each` step ran, as its row keeps them
 * and as the run details read them back.
 *
 * They are stored on the parent step's own row (its `nested` column), as a
 * tree that mirrors the configuration: a branch's paths in run order, a loop's
 * items in order, each with the steps executed inside — and those nest further
 * when one is itself a path or a loop. Every value in it was masked when its
 * step record was built (`step-record.ts#buildStep`), exactly as a top-level
 * step's are.
 */

import { toApiStepStatus } from './run-status'
import type { ExecutedStep } from './types'

/** One log entry, as a step record keeps it. */
export interface StoredLogEntry {
  readonly level: 'debug' | 'info' | 'warn' | 'error'
  readonly message: string
}

/** One step run inside a path or a loop, as its parent's row stores it. */
export interface StoredNestedStep extends StoredNested {
  readonly name: string
  readonly type: string
  readonly status: 'completed' | 'failed' | 'filtered' | 'skipped'
  readonly input?: unknown
  readonly output?: unknown
  readonly error?: string
  readonly logs?: readonly StoredLogEntry[]
}

/** The paths or the items a step ran, each with its steps. */
export interface StoredNested {
  readonly paths?: readonly { readonly name: string; readonly steps: readonly StoredNestedStep[] }[]
  readonly iterations?: readonly {
    readonly index: number
    readonly steps: readonly StoredNestedStep[]
  }[]
}

const storedStep = (step: ExecutedStep): StoredNestedStep => ({
  name: step.name,
  type: step.type,
  status: toApiStepStatus(step.status),
  ...(step.props === undefined ? {} : { input: step.props }),
  ...(step.output === undefined ? {} : { output: step.output }),
  ...(step.error === undefined ? {} : { error: step.error }),
  ...(step.logs === undefined ? {} : { logs: step.logs }),
  ...storedNestedOf(step),
})

/** What a step's row keeps of the steps it ran: `{}` for a step that ran none. */
export const storedNestedOf = (step: ExecutedStep): StoredNested => ({
  ...(step.paths === undefined
    ? {}
    : {
        paths: step.paths.map((path) => ({ name: path.name, steps: path.steps.map(storedStep) })),
      }),
  ...(step.iterations === undefined
    ? {}
    : {
        iterations: step.iterations.map((item) => ({
          index: item.index,
          steps: item.steps.map(storedStep),
        })),
      }),
})

// ─── Reading a stored tree back ──────────────────────────────────────────────

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined

const LOG_LEVELS: ReadonlySet<string> = new Set(['debug', 'info', 'warn', 'error'])
const STATUSES: ReadonlySet<string> = new Set(['completed', 'failed', 'filtered', 'skipped'])

const readLogs = (value: unknown): readonly StoredLogEntry[] | undefined =>
  Array.isArray(value)
    ? value.flatMap((entry: unknown) => {
        const log = asRecord(entry)
        return log !== undefined &&
          typeof log['level'] === 'string' &&
          LOG_LEVELS.has(log['level']) &&
          typeof log['message'] === 'string'
          ? [{ level: log['level'] as StoredLogEntry['level'], message: log['message'] }]
          : []
      })
    : undefined

const readStep = (value: unknown): readonly StoredNestedStep[] => {
  const step = asRecord(value)
  if (step === undefined || typeof step['name'] !== 'string') return []
  const status = String(step['status'] ?? '')
  const logs = readLogs(step['logs'])
  return [
    {
      name: step['name'],
      type: typeof step['type'] === 'string' ? step['type'] : '',
      status: STATUSES.has(status) ? (status as StoredNestedStep['status']) : 'failed',
      ...('input' in step ? { input: step['input'] } : {}),
      ...('output' in step ? { output: step['output'] } : {}),
      ...(typeof step['error'] === 'string' ? { error: step['error'] } : {}),
      ...(logs === undefined ? {} : { logs }),
      ...readStoredNested(step),
    },
  ]
}

const readSteps = (value: unknown): readonly StoredNestedStep[] =>
  Array.isArray(value) ? value.flatMap(readStep) : []

/** Read a stored tree back, dropping anything malformed: `{}` when there is none. */
export const readStoredNested = (value: unknown): StoredNested => {
  const nested = asRecord(value)
  if (nested === undefined) return {}
  const paths = Array.isArray(nested['paths'])
    ? nested['paths'].flatMap((entry: unknown) => {
        const path = asRecord(entry)
        return path !== undefined && typeof path['name'] === 'string'
          ? [{ name: path['name'], steps: readSteps(path['steps']) }]
          : []
      })
    : undefined
  const iterations = Array.isArray(nested['iterations'])
    ? nested['iterations'].flatMap((entry: unknown) => {
        const item = asRecord(entry)
        return item !== undefined && typeof item['index'] === 'number'
          ? [{ index: item['index'], steps: readSteps(item['steps']) }]
          : []
      })
    : undefined
  return {
    ...(paths === undefined ? {} : { paths }),
    ...(iterations === undefined ? {} : { iterations }),
  }
}

/** A stored tree with each step projected to a run detail's step shape. */
export interface ProjectedNested<T> {
  readonly paths?: readonly {
    readonly name: string
    readonly steps: readonly (T & ProjectedNested<T>)[]
  }[]
  readonly iterations?: readonly {
    readonly index: number
    readonly steps: readonly (T & ProjectedNested<T>)[]
  }[]
}

/**
 * Project every step of a stored tree, at every depth, with `project` — given
 * the step and its position inside its path or item.
 */
export const projectNested = <T extends object>(
  nested: StoredNested,
  project: (step: StoredNestedStep, index: number) => T
): ProjectedNested<T> => {
  const projectSteps = (steps: readonly StoredNestedStep[]) =>
    steps.map((step, index) => ({ ...project(step, index), ...projectNested(step, project) }))
  return {
    ...(nested.paths === undefined
      ? {}
      : { paths: nested.paths.map((path) => ({ ...path, steps: projectSteps(path.steps) })) }),
    ...(nested.iterations === undefined
      ? {}
      : {
          iterations: nested.iterations.map((item) => ({
            ...item,
            steps: projectSteps(item.steps),
          })),
        }),
  }
}

/**
 * The `paths` / `iterations` keys of a step on the admin run detail: each
 * nested step with its position inside its path or item and its resolved
 * `input`, in the top-level admin step shape.
 */
export const adminNestedSteps = (nested: unknown) =>
  projectNested(readStoredNested(nested), (step, index) => ({
    index,
    name: step.name,
    status: step.status,
    input: step.input ?? null,
    output: step.output ?? null,
    error: step.error ?? null,
    logs: step.logs ?? [],
  }))
