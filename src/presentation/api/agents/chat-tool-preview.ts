/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The previews a tool event of a streamed chat turn carries for the person
 * reading the chat (`chatToolCallEventSchema`, `chatToolResultEventSchema`):
 * `input` on the call, `output` on its result.
 *
 * Neither preview ever holds a value she may not read:
 *
 *  - `output` is built from the result the model was handed, which the tools
 *    of a chat turn already read AS her, so a field her role may not read was
 *    never in it. It is never built from a wider read filtered afterwards.
 *  - `input` is the model's arguments with every value that names a field —
 *    a write's values (`fields`, `data`), a filter's conditions (`filter`,
 *    `filters`) — narrowed to the fields she may read, so a value the model
 *    holds and she may not read is not echoed to her. The call's `arguments`
 *    on the wire carry the same projection; only the model keeps what it
 *    wrote.
 *
 * Each preview is cut to {@link CHAT_TOOL_PREVIEW_MAX_CHARS} characters, and
 * says so when it was.
 */

import { CHAT_TOOL_PREVIEW_MAX_CHARS } from '@/domain/models/api/ai/chat'
import { toolSafeTableName } from '@/domain/models/app/auth/ai-access'
import { projectAppTables, readableColumnsForTable } from './chat-table-projection'
import type { AgentToolContext } from '@/application/use-cases/agents/agent-tool-call'
import type { ReadPrincipal } from '@/domain/models/app/tables/read-access-plan-service'

/** A preview, and whether it was cut. */
export interface ToolPreview {
  readonly text: string
  readonly truncated: boolean
}

/** The fields of `table` the reader may read; `undefined` when nothing narrows them. */
export type ReaderColumns = (table: string) => ReadonlySet<string> | undefined

/** The first half of a character written as two UTF-16 units. */
const HIGH_SURROGATE = /^[\uD800-\uDBFF]$/

/**
 * `text` cut to the preview length. A cut never splits a character written
 * as two UTF-16 units: it stops before the pair instead.
 */
export const toolPreview = (text: string): ToolPreview => {
  if (text.length <= CHAT_TOOL_PREVIEW_MAX_CHARS) return { text, truncated: false }
  const splitsAPair = HIGH_SURROGATE.test(text.charAt(CHAT_TOOL_PREVIEW_MAX_CHARS - 1))
  const end = splitsAPair ? CHAT_TOOL_PREVIEW_MAX_CHARS - 1 : CHAT_TOOL_PREVIEW_MAX_CHARS
  return { text: text.slice(0, end), truncated: true }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `values` keeping only the fields in `readable`. */
const keepReadable = (
  values: Readonly<Record<string, unknown>>,
  readable: ReadonlySet<string>
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(values).filter(([field]) => readable.has(field)))

/** A value made of names only — a string, or lists and objects of strings. */
const isNamesOnly = (value: unknown): boolean =>
  typeof value === 'string' ||
  (Array.isArray(value) && value.every(isNamesOnly)) ||
  (isRecord(value) && Object.values(value).every(isNamesOnly))

/** The conditions of `conditions` on a field she may read; anything else is left out. */
const readableConditions = (
  conditions: ReadonlyArray<unknown>,
  readable: ReadonlySet<string>
): ReadonlyArray<unknown> =>
  conditions.filter(
    (condition) =>
      isRecord(condition) &&
      typeof condition['field'] === 'string' &&
      readable.has(condition['field'])
  )

/** A list of field names, which names fields and holds no value. */
const isNameList = (value: unknown): boolean =>
  Array.isArray(value) && value.every((name) => typeof name === 'string')

/**
 * How each argument that can carry a record value is narrowed to the fields
 * she may read — `readable`, `undefined` when nothing says which. Answers
 * `undefined` to leave the argument out: what cannot be narrowed is not shown.
 */
const VALUE_PROJECTIONS: Readonly<
  Record<string, (value: unknown, readable: ReadonlySet<string> | undefined) => unknown>
> = {
  // A write's values (`record.create`, `record.update`), or a list of field names to read.
  fields: (value, readable) => {
    if (isNameList(value)) {
      return readable === undefined
        ? value
        : (value as ReadonlyArray<string>).filter((name) => readable.has(name))
    }
    return isRecord(value) && readable !== undefined ? keepReadable(value, readable) : undefined
  },
  // A write's values, or the rows of a write of several.
  data: (value, readable) => {
    if (readable === undefined) return undefined
    if (isRecord(value)) return keepReadable(value, readable)
    return Array.isArray(value)
      ? value.flatMap((row) => (isRecord(row) ? [keepReadable(row, readable)] : []))
      : undefined
  },
  // A record action's `{ conditions: [{ field, operator, value }] }`.
  filter: (value, readable) =>
    readable !== undefined && isRecord(value) && Array.isArray(value['conditions'])
      ? { conditions: readableConditions(value['conditions'], readable) }
      : undefined,
  // A chat lookup's `[{ field, operator, value }]`.
  filters: (value, readable) =>
    readable !== undefined && Array.isArray(value)
      ? readableConditions(value, readable)
      : undefined,
}

/** What a record action reads besides its values: kept as written when it is a plain value. */
const RECORD_ACTION_KEYS: ReadonlySet<string> = new Set([
  'table',
  'id',
  'recordId',
  'limit',
  'offset',
  'sort',
])

/** What a chat lookup (`query_<table>`, `count_<table>`) reads besides its filters. */
const LOOKUP_KEYS: ReadonlySet<string> = new Set(['select', 'sort', 'limit'])

/** The lookup tools of a chat turn, named after the table they read. */
const LOOKUP_PREFIXES = ['query_', 'count_'] as const

/** The table a chat lookup reads, by the tool-safe name its tool carries. */
const lookupTable = (name: string): string | undefined => {
  const prefix = LOOKUP_PREFIXES.find((candidate) => name.startsWith(candidate))
  return prefix === undefined ? undefined : name.slice(prefix.length)
}

/**
 * The plain arguments a call keeps as written. A record action or a chat
 * lookup keeps only the arguments it reads that hold no record value, and a
 * `sort` only while it names fields; an argument it does not read is left out
 * rather than guessed at. Any other tool keeps every argument no projection
 * covers: what it carries is not a record's.
 */
const keepsPlain = (name: string, key: string, value: unknown): boolean => {
  const kept = name.startsWith('record.')
    ? RECORD_ACTION_KEYS
    : lookupTable(name) === undefined
      ? undefined
      : LOOKUP_KEYS
  if (kept === undefined) return true
  if (!kept.has(key)) return false
  return key === 'sort' || key === 'select'
    ? isNamesOnly(value)
    : !isRecord(value) && !Array.isArray(value)
}

/**
 * The model's arguments as the reader may see them: every value that names a
 * record's field — a write's values, a filter's conditions — narrowed to the
 * fields of its table she may read.
 *
 * Fails CLOSED: when nothing says which fields she may read — a call naming no
 * table, or a turn with nobody to judge — those values are left out
 * altogether rather than shown as the model wrote them, and an argument a
 * record action or a lookup does not read is never shown.
 */
export const readerArguments = (
  name: string,
  args: Readonly<Record<string, unknown>>,
  readerColumns: ReaderColumns
): Readonly<Record<string, unknown>> => {
  const { table } = args
  const named = typeof table === 'string' ? table : lookupTable(name)
  const readable = named === undefined ? undefined : readerColumns(named)
  return Object.fromEntries(
    Object.entries(args).flatMap(([key, value]): ReadonlyArray<readonly [string, unknown]> => {
      const project = VALUE_PROJECTIONS[key]
      if (project === undefined) return keepsPlain(name, key, value) ? [[key, value]] : []
      const projected = project(value, readable)
      return projected === undefined ? [] : [[key, projected]]
    })
  )
}

/** The `input` preview of a call: its arguments, as she may see them, as indented JSON. */
export const toolInputPreview = (
  name: string,
  args: Readonly<Record<string, unknown>>,
  readerColumns: ReaderColumns
): ToolPreview => toolPreview(JSON.stringify(readerArguments(name, args, readerColumns), null, 2))

/** `content` parsed as JSON, or `undefined` when it is not JSON. */
const parsedJson = (content: string): unknown => {
  try {
    return JSON.parse(content) as unknown
  } catch {
    return undefined
  }
}

/**
 * The `output` preview of a result: what the model was handed, as indented
 * JSON when it is JSON and as the text itself otherwise.
 */
export const toolOutputPreview = (content: string): ToolPreview => {
  const parsed = parsedJson(content)
  return toolPreview(
    parsed === undefined || typeof parsed !== 'object' || parsed === null
      ? content
      : JSON.stringify(parsed, null, 2)
  )
}

/** The read principal of the person a turn answers, on one table. */
const callerPrincipal = (
  context: Pick<AgentToolContext<unknown>, 'caller' | 'agent'>,
  table: string
): ReadPrincipal | undefined => {
  if (context.caller !== undefined) {
    const grant = context.caller.grantOn(table)
    return {
      role: grant.role,
      effectiveRoles: grant.effectiveRoles,
      isAuthenticated: !grant.signedOut,
    }
  }
  // Nobody to judge (an app without sign-in): the agent's own role bounds what it writes.
  return context.agent === undefined
    ? undefined
    : { role: context.agent.role, effectiveRoles: [context.agent.role], isAuthenticated: true }
}

/**
 * The fields the person a turn answers may read, table by table — a table
 * named as the config does, or by the tool-safe name a chat lookup carries. A
 * table the app does not declare has none.
 */
export const turnReaderColumns =
  (context: Pick<AgentToolContext<unknown>, 'app' | 'caller' | 'agent'>): ReaderColumns =>
  (table) => {
    const tables = projectAppTables(context.app)
    const declared =
      tables.find((candidate) => candidate.name === table) ??
      tables.find((candidate) => toolSafeTableName(candidate.name) === table)
    const principal = callerPrincipal(context, declared?.name ?? table)
    if (principal === undefined) return undefined
    return new Set(
      declared === undefined ? [] : readableColumnsForTable(context.app, declared, principal)
    )
  }
