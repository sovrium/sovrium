/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record-event loops a config SHOWS, refused at validation.
 *
 * A record an automation writes starts the record automations of its table.
 * So an automation whose own write re-fires its own trigger runs forever:
 *
 *   - an `update` trigger on a table, whose step updates (or upserts into)
 *     that same table and writes a field the trigger watches — or any field,
 *     when the trigger declares no `watchFields`, since it then watches all;
 *   - a `create` trigger on a table, whose step creates (or upserts) a record
 *     in that same table.
 *
 * Both are visible in the config, so both are refused before the app starts,
 * naming the automation, the table and the fields — unless the trigger's own
 * condition rules out the record the step leaves behind: a status
 * moved to Review and rewritten as Scheduled cannot re-satisfy "status equals
 * Review", so it cannot start the next run. Two automations that re-write each
 * other's tables with no trigger condition on either are refused the same way
 * a cycle that hangs on a condition, or runs through more than two
 * automations, is bounded at run time instead, by the record-event depth limit.
 *
 * Reads the steps at the top level of `actions`. Runs over the RAW config at
 * the shared decode boundary, so boot, `sovrium validate` and a watch reload
 * reach the same verdict. Pure: no I/O, no schema import.
 */

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringsOf = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

/** One record-writing step: the table it writes and the values it sets. */
interface RecordWrite {
  readonly operator: string
  readonly table: string
  readonly fields: readonly string[]
  readonly data: RawRecord
}

/** The record writes among an automation's top-level steps. */
function recordWritesOf(automation: RawRecord): readonly RecordWrite[] {
  const actions = Array.isArray(automation['actions']) ? automation['actions'] : []
  return actions.flatMap((action: unknown) => {
    if (!isRecord(action) || action['type'] !== 'record') return []
    const props = isRecord(action['props']) ? action['props'] : {}
    const { table } = props
    if (typeof table !== 'string') return []
    const data = isRecord(props['data'])
      ? props['data']
      : isRecord(props['fields'])
        ? props['fields']
        : {}
    return [{ operator: String(action['operator'] ?? ''), table, fields: Object.keys(data), data }]
  })
}

type Literal = string | number | boolean

/** A value written as-is, as opposed to a template resolved at run time. */
const literalOf = (value: unknown): Literal | undefined => {
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return typeof value === 'string' && !value.includes('{{') ? value : undefined
}

const TRIGGER_FIELD = /^\{\{\s*trigger\.data\.record\.([A-Za-z0-9_]+)\s*\}\}$/

/**
 * Whether writing `written` into `field` makes one comparison of the trigger's
 * condition false, whatever else the record holds.
 *
 * Deliberately conservative: `equals` is ruled out only when the two values
 * differ even as text, and `notEquals` only when they are the same value of
 * the same type — so a comparison the run could coerce is never trusted.
 */
function falsifies(condition: unknown, field: string, written: Literal): boolean {
  if (!isRecord(condition) || typeof condition['field'] !== 'string') return false
  if (TRIGGER_FIELD.exec(condition['field'])?.[1] !== field) return false
  const expected = literalOf(condition['value'])
  if (expected === undefined) return false
  if (condition['operator'] === 'equals') return String(expected) !== String(written)
  if (condition['operator'] === 'notEquals') return expected === written
  return false
}

/**
 * Whether the trigger's own condition rules out the record this step leaves
 * behind: one comparison of an `and` group on a field the step writes with a
 * literal, which that literal makes false. Such a write cannot start the next
 * run, so it is not a loop — the run-time depth limit still bounds it.
 */
function conditionRulesOut(trigger: RawRecord, write: RecordWrite): boolean {
  const group = trigger['condition']
  if (!isRecord(group) || (group['logic'] ?? 'and') !== 'and') return false
  const conditions = Array.isArray(group['conditions']) ? group['conditions'] : []
  return write.fields.some((field) => {
    const written = literalOf(write.data[field])
    return (
      written !== undefined &&
      conditions.some((condition: unknown) => falsifies(condition, field, written))
    )
  })
}

/** The update loop of one step, as a message, or `undefined`. */
function updateLoop(
  name: string,
  trigger: RawRecord,
  watchFields: readonly string[] | undefined,
  write: RecordWrite
): string | undefined {
  if (write.operator !== 'update' && write.operator !== 'upsert') return undefined
  const table = String(trigger['table'])
  if (write.table !== table) return undefined
  if (conditionRulesOut(trigger, write)) return undefined
  if (watchFields === undefined) {
    return `Automation '${name}' updates '${table}', the table whose updates start it, and its trigger declares no \`watchFields\`, so it watches every field it writes — each run would start the next. Declare \`watchFields\` the step does not write.`
  }
  const looping = write.fields.filter((field) => watchFields.includes(field))
  return looping.length === 0
    ? undefined
    : `Automation '${name}' updates '${table}' and writes ${looping.map((field) => `'${field}'`).join(', ')}, which its trigger's \`watchFields\` watch — each run would start the next. Write a field the trigger does not watch.`
}

/** The create loop of one step, as a message, or `undefined`. */
function createLoop(name: string, table: string, write: RecordWrite): string | undefined {
  if (write.operator !== 'create' && write.operator !== 'upsert') return undefined
  return write.table === table
    ? `Automation '${name}' creates a record in '${table}', the table whose new records start it — each run would start the next. Create the record in another table.`
    : undefined
}

/**
 * The record triggers of one automation as written: its `trigger`, or every
 * entry of its `triggers` list — any of them may start a run.
 */
function recordTriggersOf(automation: RawRecord): readonly RawRecord[] {
  const list = Array.isArray(automation['triggers'])
    ? automation['triggers']
    : [automation['trigger']]
  return list
    .filter(isRecord)
    .filter((trigger) => trigger['type'] === 'record' && typeof trigger['table'] === 'string')
}

/** Every visible loop of one automation, through each of its record triggers. */
function loopsOf(automation: RawRecord): readonly string[] {
  return recordTriggersOf(automation).flatMap((trigger) => loopsThrough(automation, trigger))
}

/** Every visible loop of one automation through one record trigger. */
function loopsThrough(automation: RawRecord, trigger: RawRecord): readonly string[] {
  const name = String(automation['name'] ?? 'unnamed')
  const { table } = trigger as { readonly table: string }
  const events = stringsOf(trigger['events'])
  const watchFields = Array.isArray(trigger['watchFields'])
    ? stringsOf(trigger['watchFields'])
    : undefined
  return recordWritesOf(automation)
    .flatMap((write) => [
      ...(events.includes('update') ? [updateLoop(name, trigger, watchFields, write)] : []),
      ...(events.includes('create') ? [createLoop(name, table, write)] : []),
    ])
    .filter((message): message is string => message !== undefined)
}

/** A record automation as a cycle reads it: what starts it, and what it writes. */
interface CycleNode {
  readonly name: string
  readonly table: string
  readonly events: readonly string[]
  readonly watchFields: readonly string[] | undefined
  /** A trigger `condition` makes the next hop depend on data, out of validation's sight. */
  readonly conditioned: boolean
  readonly writes: readonly RecordWrite[]
}

/** One cycle node per record trigger of the automation. */
function cycleNodesOf(automation: RawRecord): readonly CycleNode[] {
  return recordTriggersOf(automation).map((trigger) => ({
    name: String(automation['name'] ?? 'unnamed'),
    table: String(trigger['table']),
    events: stringsOf(trigger['events']),
    watchFields: Array.isArray(trigger['watchFields'])
      ? stringsOf(trigger['watchFields'])
      : undefined,
    conditioned: trigger['condition'] !== undefined,
    writes: recordWritesOf(automation),
  }))
}

/** Whether one of `from`'s writes starts `to` — its table, an event it listens to, a field it watches. */
function starts(from: CycleNode, to: CycleNode): boolean {
  return from.writes.some((write) => {
    if (write.table !== to.table) return false
    const updates = write.operator === 'update' || write.operator === 'upsert'
    const creates = write.operator === 'create' || write.operator === 'upsert'
    const watched =
      to.watchFields === undefined || write.fields.some((field) => to.watchFields!.includes(field))
    return (
      (updates && watched && to.events.includes('update')) ||
      (creates && to.events.includes('create'))
    )
  })
}

/**
 * The cycles the config shows ACROSS two automations: each one's
 * top-level record step starts the other, and neither trigger carries a
 * condition — so every run starts the next, with nothing at run time to stop
 * it but the depth limit. One message per pair, naming both automations and
 * both tables. A condition on either hop leaves the pair to the depth limit.
 */
function pairCycles(nodes: readonly CycleNode[]): readonly string[] {
  const open = nodes.filter((node) => !node.conditioned)
  return open.flatMap((a, index) =>
    open
      .slice(index + 1)
      .filter((b) => a.table !== b.table && starts(a, b) && starts(b, a))
      .map(
        (b) =>
          `Automations '${a.name}' and '${b.name}' start each other: '${a.name}' writes '${b.table}', which starts '${b.name}', and '${b.name}' writes '${a.table}', which starts '${a.name}' — each run would start the next. Give one of the two triggers a condition, or write a field the other does not watch.`
      )
  )
}

/**
 * Refuse every record automation whose own write re-fires its own trigger,
 * and every pair of automations whose writes start each other unconditionally.
 *
 * @returns one message per loop, empty when the config shows none
 */
export function validateRecordEventLoops(config: unknown): readonly string[] {
  const automations = isRecord(config) ? config['automations'] : undefined
  if (!Array.isArray(automations)) return []
  const records = automations.filter(isRecord)
  const nodes = records.flatMap(cycleNodesOf)
  return [...records.flatMap(loopsOf), ...pairCycles(nodes)]
}
