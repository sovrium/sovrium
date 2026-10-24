/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `record/aggregate` steps a configuration declares that cannot compute
 * what they ask for, refused at validation:
 *
 *   - an aggregation, or the `groupBy`, naming a field the table does not have;
 *   - a `groupBy` field named like one of the step's output keys (`count`, or
 *     a figure's `<field>_<op>`), which every row would carry twice;
 *   - a `sum`, an `avg` or a percentile over a field that holds no number.
 *     `count`, `min` and `max` read any field: a count counts the records, and
 *     the extremes of a text field are its first and last values.
 *
 * Each is refused before the app starts, naming the automation, the step and
 * the field. Only a step whose `table` is written literally, and is declared,
 * is judged: a templated table is the run's to resolve. Reads every step in an
 * automation's `actions`, however deeply a `path` or a `loop` nests it. Runs
 * over the RAW config at the shared decode boundary, so boot,
 * `sovrium validate` and a watch reload reach the same verdict. Pure.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The operations that need a number to compute over. */
const NUMERIC_OPS: ReadonlySet<string> = new Set(['sum', 'avg', 'p50', 'p75', 'p90', 'p95', 'p99'])

/**
 * The field types that hold a number — or may, for a computed field whose
 * result the config does not type (`formula`, `rollup`, `lookup`), which the
 * database judges when it computes.
 */
const NUMBER_FIELD_TYPES: ReadonlySet<string> = new Set([
  'number',
  'integer',
  'decimal',
  'currency',
  'percentage',
  'duration',
  'rating',
  'progress',
  'autonumber',
  'count',
  'rollup',
  'formula',
  'lookup',
])

/** The columns every record carries beside its declared fields, typed as a field would be. */
const SYSTEM_FIELD_TYPES: ReadonlyMap<string, string> = new Map([
  ['id', 'autonumber'],
  ['created_at', 'datetime'],
  ['updated_at', 'datetime'],
])

/** Every `record/aggregate` step reachable from `value`, through branches and loops only. */
function aggregateStepsOf(value: unknown): readonly RawRecord[] {
  if (Array.isArray(value)) return value.flatMap(aggregateStepsOf)
  if (!isRecord(value)) return []
  const self = value['type'] === 'record' && value['operator'] === 'aggregate' ? [value] : []
  const props = isRecord(value['props']) ? value['props'] : {}
  const nested = [value['actions'], value['paths'], props['actions'], props['paths']].flatMap(
    aggregateStepsOf
  )
  return [...self, ...nested]
}

/** Each declared table's field types, keyed by table then field name. */
function fieldTypesByTable(config: RawRecord): ReadonlyMap<string, ReadonlyMap<string, string>> {
  const tables = Array.isArray(config['tables']) ? config['tables'] : []
  return new Map(
    tables.filter(isRecord).map((table) => {
      const fields = Array.isArray(table['fields']) ? table['fields'] : []
      const types = new Map(
        fields
          .filter(isRecord)
          .map((field) => [String(field['name'] ?? ''), String(field['type'] ?? '')] as const)
      )
      return [String(table['name'] ?? ''), types] as const
    })
  )
}

/** The refusal of one aggregation, or `undefined` when it computes. */
function aggregationRefusal(
  types: ReadonlyMap<string, string>,
  aggregation: RawRecord
): string | undefined {
  const field = String(aggregation['field'] ?? '')
  const op = String(aggregation['op'] ?? '')
  const type = types.get(field) ?? SYSTEM_FIELD_TYPES.get(field)
  if (type === undefined) {
    return `aggregation '${op}' names the field '${field}', which the table does not have`
  }
  if (!NUMERIC_OPS.has(op) || NUMBER_FIELD_TYPES.has(type)) return undefined
  return `aggregation '${op}' needs a number, and the field '${field}' is a ${type} field; use count, min or max on it`
}

/**
 * The output keys a row carries beside the group's value: `count`, and each
 * figure under `<field>_<op>`.
 */
const figureKeys = (aggregations: readonly unknown[]): ReadonlySet<string> =>
  new Set([
    'count',
    ...aggregations
      .filter(isRecord)
      .map(
        (aggregation) => `${String(aggregation['field'] ?? '')}_${String(aggregation['op'] ?? '')}`
      ),
  ])

/**
 * The refusal of a `groupBy`: a field the table does not have, or one whose
 * name a figure also lands under, since a row is flat and the two would share
 * one key.
 */
function groupingRefusals(
  types: ReadonlyMap<string, string>,
  aggregations: readonly unknown[],
  groupBy: string
): readonly string[] {
  if (!types.has(groupBy) && !SYSTEM_FIELD_TYPES.has(groupBy)) {
    return [`groupBy names the field '${groupBy}', which the table does not have`]
  }
  return figureKeys(aggregations).has(groupBy)
    ? [
        `groupBy names the field '${groupBy}', which is also the name of the '${groupBy}' figure in every row; group by a field with another name`,
      ]
    : []
}

/** Every refusal of one step, in the order its props declare them. */
function stepRefusals(
  automation: string,
  step: RawRecord,
  tables: ReadonlyMap<string, ReadonlyMap<string, string>>
): readonly string[] {
  const props = isRecord(step['props']) ? step['props'] : {}
  const types = typeof props['table'] === 'string' ? tables.get(props['table']) : undefined
  if (types === undefined) return []
  const aggregations = Array.isArray(props['aggregations']) ? props['aggregations'] : []
  const { groupBy } = props
  const grouping = typeof groupBy === 'string' ? groupingRefusals(types, aggregations, groupBy) : []
  const where = `Automation '${automation}', step '${String(step['name'] ?? '(unnamed)')}' (record/aggregate on '${String(props['table'])}')`
  return [
    ...aggregations.filter(isRecord).flatMap((aggregation) => {
      const refusal = aggregationRefusal(types, aggregation)
      return refusal === undefined ? [] : [refusal]
    }),
    ...grouping,
  ].map((reason) => `${where}: ${reason}.`)
}

/**
 * Refuse every `record/aggregate` step naming a field its table does not
 * have, or computing a number over a field that holds none.
 *
 * @returns one message per refused aggregation or grouping, empty when every step computes
 */
export function validateRecordAggregates(config: unknown): readonly string[] {
  if (!isRecord(config) || !Array.isArray(config['automations'])) return []
  const tables = fieldTypesByTable(config)
  return config['automations']
    .filter(isRecord)
    .flatMap((automation) =>
      aggregateStepsOf(automation['actions']).flatMap((step) =>
        stepRefusals(String(automation['name'] ?? '(unnamed)'), step, tables)
      )
    )
}
