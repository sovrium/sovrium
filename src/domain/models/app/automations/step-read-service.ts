/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an automation step READS beyond its own props and the outputs of the
 * steps before it — the one classifier both sides of a run's reach share: the
 * read-time judgement of who may see a step's output, and the run-time capture
 * of where a value came from.
 *
 * A step reads with the engine's authority, so its output can carry what the
 * person reading the run may not read. Data the step was HANDED (its props, the
 * trigger, an earlier step's output) is not a read of its own: data flows
 * forward, and whatever handed it on is judged where it was read. So a step is
 * classified by what it fetches itself:
 *
 *  - `records` — a `record` step: it reads `table`, and its output may hold the
 *    records it read (`records`, each its fields and its id);
 *  - `table` — reads `table` without an output that lists the records one by
 *    one (a record step nested in a loop or a branch);
 *  - `agent` — an `ai` `agent` step: it reads whatever `role` may read;
 *  - `run` — a synchronous `automation` `call`: its output is what the called
 *    automation returned, so it reads what that automation's steps read
 *    (`reads`, classified from its declared actions);
 *  - `nested` — a loop or a branch: it reads what its nested actions read;
 *  - `none` — reads nothing of its own;
 *  - `unknown` — reads stored data no reach judges (a stored file, another
 *    run's state, a script's own calls), or names what the config no longer
 *    declares. Fail closed: a judge treats it as beyond every reader.
 */

import type { App } from '@/domain/models/app'

/** The slice of a declared action this classification reads. */
export interface StepAction {
  readonly name?: string
  readonly type?: string
  readonly operator?: string
  readonly props?: Readonly<Record<string, unknown>>
  readonly actions?: ReadonlyArray<StepAction>
  readonly $ref?: string
  readonly $vars?: Readonly<Record<string, unknown>>
}

/** A record a step's output holds: its fields and its id. */
export type ReadRecord = Readonly<Record<string, unknown>>

/** What a step reads beyond what it was handed. */
export type StepRead =
  | { readonly kind: 'records'; readonly table: string; readonly records?: readonly ReadRecord[] }
  | { readonly kind: 'table'; readonly table: string }
  | { readonly kind: 'agent'; readonly agent: string; readonly role: string }
  | { readonly kind: 'run'; readonly automation: string; readonly reads: StepRead }
  | { readonly kind: 'nested'; readonly reads: readonly StepRead[] }
  | { readonly kind: 'none' }
  | { readonly kind: 'unknown'; readonly reason: string }
  /**
   * A synchronous call whose run was recorded as it ran: its output is what
   * that run returned, so it reads what that run's steps actually read.
   */
  | { readonly kind: 'calledRun'; readonly automation: string; readonly runId: string }

const NONE: StepRead = { kind: 'none' }

/**
 * What a script step read, from the reads of the actions it called as it ran
 * (each classified by {@link classifyStepRead} at the sandbox's dispatch): the
 * union of them, or nothing at all when it called none.
 */
export const readOfCalls = (calls: readonly StepRead[]): StepRead =>
  calls.length === 0 ? NONE : { kind: 'nested', reads: calls }

/** A tool call an agent's model asked for: the tool's name and its arguments. */
export interface ToolCallLike {
  readonly name: string
  readonly arguments: Readonly<Record<string, unknown>>
}

/**
 * What an agent's tool calls named, precisely: the record a call's `id`
 * argument names in its `table`, or — when it names no record (a list, a
 * search) — the whole table. A call naming no table reads no stored record.
 */
export const readsOfToolCalls = (calls: readonly ToolCallLike[]): readonly StepRead[] =>
  calls.flatMap((call): readonly StepRead[] => {
    const { table, id } = call.arguments
    if (typeof table !== 'string' || table === '') return []
    return typeof id === 'string' || typeof id === 'number'
      ? [{ kind: 'records', table, records: [{ id: String(id) }] }]
      : [{ kind: 'table', table }]
  })

const READ_KINDS: ReadonlySet<string> = new Set([
  'records',
  'table',
  'agent',
  'run',
  'nested',
  'none',
  'unknown',
  'calledRun',
])

const isStepRead = (value: unknown): value is StepRead =>
  value !== null &&
  typeof value === 'object' &&
  READ_KINDS.has(String((value as { readonly kind?: unknown }).kind))

/**
 * The reads a step recorded as it ran, as persisted beside it — or `undefined`
 * when it recorded none (a step of an earlier version, or of a kind whose read
 * is classified from its declaration). An entry of an unknown shape is read as
 * `unknown`, failing closed.
 */
export const recordedReadsOf = (value: unknown): readonly StepRead[] | undefined =>
  Array.isArray(value)
    ? value.map((entry) => (isStepRead(entry) ? entry : unknownRead('an unrecognised read')))
    : undefined

const unknownRead = (reason: string): StepRead => ({ kind: 'unknown', reason })

/**
 * Actions whose output carries only what they were handed, what they wrote, or
 * what an outside service answered — never a read of the app's stored data.
 */
const READS_NOTHING: ReadonlySet<string> = new Set([
  'ai/generate',
  'ai/classify',
  'ai/extract',
  'analytics/track',
  'approval/request',
  'auth/assignRole',
  'auth/banUser',
  'auth/createUser',
  'auth/unbanUser',
  'automation/return',
  'connection/call',
  'crypto/hash',
  'crypto/hmac',
  'data/set',
  'data/aggregate',
  'data/sort',
  'data/limit',
  'data/deduplicate',
  'data/merge',
  'data/split',
  'data/compare',
  'data/lookup',
  'date/format',
  'date/parse',
  'date/add',
  'date/subtract',
  'date/diff',
  'date/startOf',
  'date/endOf',
  'date/now',
  'delay/wait',
  'delay/webhook',
  'delay/queue',
  'digest/collect',
  'email/send',
  'file/upload',
  'file/generateCsv',
  'file/generateXlsx',
  'file/generatePdf',
  'file/move',
  'file/copy',
  'file/delete',
  'file/compress',
  'file/transformImage',
  'filter/continue',
  'flow/stop',
  'http/request',
  'http/get',
  'http/post',
  'http/put',
  'http/patch',
  'http/delete',
  'link/create',
  'link/delete',
  'sovrium/validateConfig',
  'state/set',
  'state/delete',
  'state/filterNew',
  'webhook/send',
  'webhook/response',
])

/** Actions whose output carries stored data no reach judges, with why. */
const UNJUDGED_READS: ReadonlyMap<string, string> = new Map([
  ['ai/transcribe', 'reads a stored recording'],
  ['code/runTypescript', 'its script may call any action'],
  ['digest/release', 'returns what other runs collected'],
  ['file/download', 'reads a stored file'],
  ['file/parseCsv', 'reads a stored file'],
  ['file/parseXlsx', 'reads a stored file'],
  ['file/extractText', 'reads a stored file'],
  ['file/list', 'lists stored files'],
  ['file/getMetadata', 'reads a stored file'],
  ['file/signUrl', 'hands out a link that reads a stored file'],
  ['link/update', 'returns the link as stored'],
  ['state/get', 'returns what other runs stored'],
  ['state/list', 'returns what other runs stored'],
  ['state/increment', 'returns what other runs stored'],
])

/** How deep a chain of calls and templates is followed before it is not judged. */
const MAX_DEPTH = 16

interface Walk {
  readonly app: App
  /** Inside a loop or a branch: the step's own output lists no records. */
  readonly nested: boolean
  readonly depth: number
  /** The automations a call chain already passed through. */
  readonly calling: ReadonlySet<string>
}

const keyOf = (action: StepAction): string => `${action.type ?? ''}/${action.operator ?? ''}`

const stringProp = (action: StepAction, key: string): string | undefined => {
  const value = action.props?.[key]
  return typeof value === 'string' ? value : undefined
}

const asActions = (value: unknown): ReadonlyArray<StepAction> =>
  Array.isArray(value)
    ? (value.filter((item) => item !== null && typeof item === 'object') as StepAction[])
    : []

/**
 * Every action of an automation, nested ones (loops, branches) included —
 * outer before inner, so a name both carry finds the outer one first.
 */
export const flattenActions = (actions: ReadonlyArray<StepAction>): ReadonlyArray<StepAction> =>
  actions.flatMap((action) => [
    action,
    ...flattenActions(asActions(action.actions)),
    ...flattenActions(asActions(action.props?.['actions'])),
  ])

/**
 * The records a record step's output holds — each as its fields and its id —
 * or `undefined` when the output holds no list of records (a write's key or
 * count).
 */
export const recordsOf = (output: unknown): readonly ReadRecord[] | undefined => {
  if (output === null || typeof output !== 'object') return undefined
  const { records } = output as { readonly records?: unknown }
  if (!Array.isArray(records)) return undefined
  return records.map((record) => {
    const { id, fields } = (record ?? {}) as { readonly id?: unknown; readonly fields?: unknown }
    return { ...(typeof fields === 'object' && fields !== null ? fields : {}), id }
  })
}

const recordRead = (walk: Walk, action: StepAction, output: unknown): StepRead => {
  const name = stringProp(action, 'table')
  const table = walk.app.tables?.find((candidate) => candidate.name === name)
  if (table === undefined) return unknownRead('reads a table the config does not declare')
  if (walk.nested) return { kind: 'table', table: table.name }
  const records = recordsOf(output)
  return records === undefined
    ? { kind: 'records', table: table.name }
    : { kind: 'records', table: table.name, records }
}

const agentRead = (walk: Walk, action: StepAction): StepRead => {
  const name = stringProp(action, 'agent')
  const agent = walk.app.agents?.find((candidate) => candidate.name === name)
  return agent === undefined
    ? unknownRead('runs an agent the config does not declare')
    : { kind: 'agent', agent: agent.name, role: agent.role ?? 'member' }
}

const nestedRead = (walk: Walk, actions: ReadonlyArray<StepAction>): StepRead => ({
  kind: 'nested',
  reads: actions.map((nested) => classify({ ...walk, nested: true }, nested, undefined)),
})

const branchActions = (action: StepAction): ReadonlyArray<StepAction> => {
  const paths = action.props?.['paths']
  return Array.isArray(paths)
    ? paths.flatMap((path) => asActions((path as { readonly actions?: unknown } | null)?.actions))
    : []
}

const callRead = (walk: Walk, action: StepAction): StepRead => {
  // A fire-and-forget call's output is `{ result: {} }`: nothing comes back.
  if (stringProp(action, 'mode') === 'async') return NONE
  const name = stringProp(action, 'name')
  const callee = walk.app.automations?.find((candidate) => candidate.name === name)
  if (name === undefined || callee === undefined) {
    return unknownRead('calls an automation the config does not declare')
  }
  if (walk.calling.has(name)) return unknownRead('calls an automation it is already inside')
  const calling = new Set([...walk.calling, name])
  const reads = nestedRead({ ...walk, calling }, asActions(callee.actions))
  return { kind: 'run', automation: name, reads }
}

/** `$name` placeholders in every string leaf of `value`, as `$ref` expansion fills them. */
const fillVars = (value: unknown, vars: Readonly<Record<string, unknown>>): unknown => {
  if (typeof value === 'string') {
    return value.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, name: string) => {
      if (!Object.prototype.hasOwnProperty.call(vars, name)) return match
      const replacement = vars[name]
      return replacement === undefined || replacement === null ? '' : String(replacement)
    })
  }
  if (Array.isArray(value)) return value.map((item) => fillVars(item, vars))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, fillVars(item, vars)])
    )
  }
  return value
}

const refRead = (walk: Walk, action: StepAction, output: unknown): StepRead => {
  const templates = (walk.app.actions ?? []) as ReadonlyArray<{
    readonly name: string
    readonly action: unknown
    readonly variables?: Readonly<Record<string, unknown>>
  }>
  const template = templates.find((candidate) => candidate.name === action.$ref)
  if (template === undefined) return unknownRead('uses a template the config does not declare')
  const vars = { ...(template.variables ?? {}), ...(action.$vars ?? {}) }
  return classify(walk, fillVars(template.action, vars) as StepAction, output)
}

type Classifier = (walk: Walk, action: StepAction, output: unknown) => StepRead

/** The actions whose read depends on what they name, by type then by `type/operator`. */
const BY_TYPE: ReadonlyMap<string, Classifier> = new Map<string, Classifier>([
  ['record', recordRead],
  ['ref', refRead],
])
const BY_KEY: ReadonlyMap<string, Classifier> = new Map<string, Classifier>([
  ['ai/agent', (walk, action) => agentRead(walk, action)],
  ['automation/call', (walk, action) => callRead(walk, action)],
  ['loop/each', (walk, action) => nestedRead(walk, asActions(action.props?.['actions']))],
  ['path/branch', (walk, action) => nestedRead(walk, branchActions(action))],
])

const classify = (walk: Walk, action: StepAction, output: unknown): StepRead => {
  if (walk.depth > MAX_DEPTH) return unknownRead('nests deeper than is followed')
  const key = keyOf(action)
  const special = BY_TYPE.get(action.type ?? '') ?? BY_KEY.get(key)
  if (special !== undefined) return special({ ...walk, depth: walk.depth + 1 }, action, output)
  if (READS_NOTHING.has(key)) return NONE
  return unknownRead(UNJUDGED_READS.get(key) ?? `is an action (${key}) no reach is known for`)
}

/**
 * What `action` reads beyond its props and the steps before it — given the
 * step's `output` when it ran, from which a record step's records are taken.
 */
export const classifyStepRead = (app: App, action: StepAction, output?: unknown): StepRead =>
  classify({ app, nested: false, depth: 0, calling: new Set() }, action, output)
