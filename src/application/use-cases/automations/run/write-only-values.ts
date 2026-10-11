/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The write-only values a run carries, found where a record step puts them.
 *
 * A run reads a write-only field unchanged — a record step nobody started sees
 * it, and a later step templates it on — but what the run RECORDS is read by
 * people, so the value is masked there, as a resolved `$env` secret is. A
 * record step names its table in `props.table`, so its write-only fields are
 * known: their values are taken from the fields it wrote (`fields`,
 * `records[].fields`) and from the records it answered (`record`, `records[]`,
 * at the top level and under `fields`).
 *
 * A record does not stay where its step put it: a loop gathers its items'
 * outputs, a path its branch's, a called automation returns what it read, a
 * form or a webhook hands the run the answer it was sent. So every value held
 * under the NAME of any write-only field, at any depth, is masked as well
 * ({@link writeOnlyValuesIn}) — a name shared with a readable field of another
 * table is masked too, the safe direction.
 */

import {
  writeOnlyColumnsOf,
  writeOnlyFieldNames,
} from '@/domain/models/app/tables/write-only-field-service'
import { redactSecretsInValue } from '../redact-secrets'
import type { App } from '@/domain/models/app'

type Json = Readonly<Record<string, unknown>>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The string values `row` holds at `names`, at its top level and under `fields`. */
const valuesIn = (row: unknown, names: readonly string[]): readonly string[] => {
  if (!isObject(row)) return []
  const nested = isObject(row['fields']) ? row['fields'] : {}
  return names.flatMap((name) =>
    [row[name], nested[name]].filter(
      (value): value is string => typeof value === 'string' && value !== ''
    )
  )
}

/** How deep a value is searched for write-only names: a run's data is never nested deeper. */
const MAX_DEPTH = 12

/** The names any table of the app declares write-only. */
const writeOnlyNamesOf = (app: App): ReadonlySet<string> =>
  new Set([...writeOnlyColumnsOf(app).values()].flatMap((names) => [...names]))

const stringsUnder = (
  value: unknown,
  names: ReadonlySet<string>,
  depth: number
): readonly string[] => {
  if (depth > MAX_DEPTH) return []
  if (Array.isArray(value)) return value.flatMap((item) => stringsUnder(item, names, depth + 1))
  if (!isObject(value)) return []
  return Object.entries(value).flatMap(([key, held]) =>
    names.has(key) && typeof held === 'string' && held !== ''
      ? [held]
      : stringsUnder(held, names, depth + 1)
  )
}

/**
 * Every non-empty string `value` holds, at any depth, under the name of a
 * field some table declares write-only — whatever carried it there.
 */
export const writeOnlyValuesIn = (app: App, value: unknown): readonly string[] => {
  const names = writeOnlyNamesOf(app)
  return names.size === 0 ? [] : [...new Set(stringsUnder(value, names, 0))]
}

/** The rows a record step's value names: a `record`, a `records` list, a `fields` map. */
const rowsOf = (value: unknown): readonly unknown[] => {
  if (!isObject(value)) return []
  const records = Array.isArray(value['records']) ? (value['records'] as readonly unknown[]) : []
  return [value, value['record'], ...records]
}

/**
 * The write-only values one step carries — in the props it was given and in
 * the output it answered: a record step's own table's fields, and for any step
 * every value held under a write-only name ({@link writeOnlyValuesIn}).
 */
export const writeOnlyValuesOfStep = (
  app: App,
  step: { readonly type: string; readonly props?: Readonly<Record<string, unknown>> | undefined },
  output: unknown
): readonly string[] => {
  const carried = writeOnlyValuesIn(app, [step.props, output])
  const table = step.props?.['table']
  if (step.type !== 'record' || typeof table !== 'string') return carried
  const names = writeOnlyFieldNames(app, table)
  const own = [...rowsOf(step.props), ...rowsOf(output)].flatMap((row) => valuesIn(row, names))
  return [...new Set([...own, ...carried])]
}

/** `value` with every one of `secrets` painted over with `***`, in every string it holds. */
export const maskValues = <T>(value: T, secrets: readonly string[]): T =>
  secrets.length === 0
    ? value
    : (redactSecretsInValue(
        value,
        Object.fromEntries(secrets.map((secret, index) => [String(index), secret]))
      ) as T)

/** Every record step of an action tree (paths and loops included), by name, with its table. */
const recordStepTables = (node: unknown): ReadonlyArray<readonly [string, string]> => {
  if (Array.isArray(node)) return node.flatMap(recordStepTables)
  if (!isObject(node)) return []
  const { props } = node
  const table = isObject(props) ? props['table'] : undefined
  const own =
    node['type'] === 'record' && typeof table === 'string' && typeof node['name'] === 'string'
      ? [[node['name'], table] as const]
      : []
  return [...own, ...Object.values(node).flatMap(recordStepTables)]
}

/**
 * Every write-only value the record steps of a finished run answered, read
 * from its outputs by step name — what its answer (a webhook's, an MCP tool's)
 * must not carry, to any reader.
 */
export const writeOnlyValuesOfRun = (
  app: App,
  automationName: string,
  actions: Readonly<Record<string, unknown>>
): readonly string[] => {
  const automation = app.automations?.find((candidate) => candidate.name === automationName)
  const tables = new Map(recordStepTables(automation?.actions).toReversed())
  const own = Object.entries(actions).flatMap(([stepName, output]) => {
    const table = tables.get(stepName)
    return table === undefined
      ? []
      : writeOnlyValuesOfStep(app, { type: 'record', props: { table } }, output)
  })
  return [...new Set([...own, ...writeOnlyValuesIn(app, actions)])]
}

/**
 * `value` — a run's trigger data as a reader is shown it — with every value it
 * holds under a write-only name masked. The stored copy is left whole: a run
 * that resumes from a wait reads it back, and must still hand the value on.
 */
export const withWriteOnlyValuesMasked = (app: App, value: unknown): unknown =>
  maskValues(value, writeOnlyValuesIn(app, value))

/**
 * The write-only values the runs a run called had read, gathered as each call
 * returns. What a callee hands back carries them under any name — a `token`, a
 * sentence — so the caller's history masks them by value, like a value it read
 * itself. One ledger serves a whole call chain, so what a grandchild read is
 * masked in every run it travelled up through.
 */
export interface CalledWriteOnlyValues {
  /** Note the write-only values a called run read. */
  readonly record: (values: readonly string[]) => void
  /** Every value noted so far. */
  readonly values: () => readonly string[]
}

/** A fresh, empty ledger for a run started by its trigger (a callee shares its caller's). */
export const createCalledWriteOnlyValues = (): CalledWriteOnlyValues => {
  // A mutable set is the point: each call notes what its run read as the caller
  // goes on, and every later step record of the chain masks it.
  const noted = new Set<string>()
  return {
    record: (values) => {
      // eslint-disable-next-line functional/immutable-data -- the chain's ledger; see above
      values.forEach((value) => noted.add(value))
    },
    values: () => [...noted],
  }
}

/**
 * What a called run inherits from the run that called it about write-only
 * values: whether it may read them — never when the chain began with a person's
 * gesture, since a hand-started run reads as that person — and the ledger the
 * chain notes them in.
 */
export interface WriteOnlyInheritance {
  readonly blind: boolean
  readonly called: CalledWriteOnlyValues
}
