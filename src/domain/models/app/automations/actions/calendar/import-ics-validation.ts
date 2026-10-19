/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The app-level rules a `calendar/importIcs` step must satisfy, judged against
 * the table it writes into: the table exists, the step has a map to follow
 * (its own, or the table's `calendarFeed` read backwards), its `matchField`
 * and every mapped field are fields of the table, and the times go to `date`
 * or `datetime` fields. Each would otherwise surface only when the step first
 * runs, on the first poll of the feed.
 *
 * Reads the automations and tables structurally, so it depends on no other
 * property of the app.
 */

import { resolveImportMap, type ImportIcsTable } from './import-ics-service'

type LooseAction = Readonly<Record<string, unknown>>

interface AppForImportIcsValidation {
  readonly tables?: ReadonlyArray<ImportIcsTable & { readonly name: string }>
  readonly automations?: ReadonlyArray<{
    readonly name: string
    readonly actions?: ReadonlyArray<unknown>
  }>
}

const asActions = (value: unknown): readonly LooseAction[] =>
  Array.isArray(value)
    ? (value.filter((item) => item !== null && typeof item === 'object') as LooseAction[])
    : []

const propsOf = (action: LooseAction): Readonly<Record<string, unknown>> => {
  const { props } = action
  return props !== null && typeof props === 'object'
    ? (props as Readonly<Record<string, unknown>>)
    : {}
}

/** Every step, nested ones included: a loop's actions and a path's branches. */
const flattenSteps = (actions: readonly LooseAction[]): readonly LooseAction[] =>
  actions.flatMap((action) => {
    const props = propsOf(action)
    const branches = asActions(props['paths']).flatMap((path) => asActions(path['actions']))
    return [
      action,
      ...flattenSteps(asActions(action['actions'])),
      ...flattenSteps(asActions(props['actions'])),
      ...flattenSteps(branches),
    ]
  })

const TIME_TYPES: ReadonlySet<string> = new Set(['date', 'datetime'])

const isImportIcs = (action: LooseAction): boolean =>
  action['type'] === 'calendar' && action['operator'] === 'importIcs'

/** The problem with one step against its table, or `undefined`. */
const stepIssue = (
  props: Readonly<Record<string, unknown>>,
  table: (ImportIcsTable & { readonly name: string }) | undefined,
  tableName: string
): string | undefined => {
  if (table === undefined) return `writes into table '${tableName}', which does not exist`
  const ownMap = props['map'] as Readonly<Record<string, unknown>> | undefined
  if (ownMap === undefined && table.calendarFeed === undefined) {
    return `has no map, and table '${tableName}' declares no calendarFeed to read one from`
  }
  const typeOf = (name: string) => table.fields.find((field) => field.name === name)?.type
  const matchField = String(props['matchField'] ?? '')
  if (typeOf(matchField) === undefined) {
    return `matches on field '${matchField}', which does not exist in table '${tableName}'`
  }
  const map = resolveImportMap(table, ownMap)
  const missing = Object.entries(map).find(([, field]) => typeOf(field) === undefined)
  if (missing !== undefined) {
    return `maps ${missing[0]} to field '${missing[1]}', which does not exist in table '${tableName}'`
  }
  const badTime = (['start', 'end'] as const).find(
    (key) => map[key] !== undefined && !TIME_TYPES.has(typeOf(map[key]) ?? '')
  )
  return badTime === undefined
    ? undefined
    : `maps ${badTime} to field '${map[badTime] ?? ''}', which is not a date or datetime field`
}

/**
 * Validate every `calendar/importIcs` step against the table it writes into.
 *
 * @returns `true`, or an error naming the first automation and step at fault.
 */
export const validateAllCalendarImports = (app: AppForImportIcsValidation): string | true => {
  const tables = app.tables ?? []
  const error = (app.automations ?? [])
    .flatMap((automation) =>
      flattenSteps(asActions(automation.actions))
        .filter(isImportIcs)
        .flatMap((action) => {
          const props = propsOf(action)
          const tableName = String(props['table'] ?? '')
          const issue = stepIssue(
            props,
            tables.find((table) => table.name === tableName),
            tableName
          )
          return issue === undefined
            ? []
            : [
                `Automation '${automation.name}' calendar action '${String(action['name'] ?? '?')}' ${issue}`,
              ]
        })
    )
    .at(0)
  return error ?? true
}
