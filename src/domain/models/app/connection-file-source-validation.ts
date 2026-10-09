/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a `type: file` operation parameter may read its value.
 *
 * A connection file is read with the app's own access to storage, so a value
 * the caller of a trigger fills (a webhook body, a manual run's input, a form
 * submission, a record text field anyone who may write the record can set)
 * would let that caller choose which stored file leaves the app. Any template
 * expression that reads `trigger.` is therefore refused, whole or partial.
 *
 * One value is accepted: on a `record` trigger, the whole value
 * `{{trigger.data.record.<field>}}` where `<field>` is an attachment field of
 * the trigger's table — an attachment value is confined to its bucket when it
 * is written. A literal key, a `data:` URI and a step output are accepted.
 *
 * Pure: no I/O; runs inside the AppSchema decode, after the call check.
 */

import { callIssue, type ConnectionOperation } from './connections/operations'

type Param = { readonly type?: string | undefined }

type Connection = {
  readonly name: string
  readonly operations?:
    | ReadonlyArray<{
        readonly name: string
        readonly params?: Readonly<Record<string, Param>> | undefined
      }>
    | undefined
}

type Call = {
  readonly connection: string
  readonly operation: string
  readonly params?: Readonly<Record<string, unknown>> | undefined
  readonly paginate?: unknown
}

type Trigger = { readonly type: string; readonly table?: string | undefined }

type Table = {
  readonly name: string
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
}

const ATTACHMENT_TYPES: ReadonlySet<string> = new Set(['single-attachment', 'multiple-attachments'])

/** A `{{…}}` expression anywhere in the text that reads the trigger. */
const TRIGGER_EXPRESSION = /\{\{[^}]*\btrigger\.[^}]*\}\}/

/** The whole value is one placeholder reading a field of the trigger record. */
const RECORD_FIELD_VALUE = /^\{\{\s*trigger\.data\.record\.(\w+)(?:\.[\w.]+)?\s*\}\}$/

/** The text a value is searched in: the string itself, or its JSON. */
const textOf = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? '')

/** True when the value is the trigger record's own attachment field. */
const isRecordAttachment = (
  value: unknown,
  trigger: Trigger,
  tables: ReadonlyArray<Table>
): boolean => {
  if (trigger.type !== 'record' || typeof value !== 'string') return false
  const field = RECORD_FIELD_VALUE.exec(value)?.[1]
  const table = tables.find((candidate) => candidate.name === trigger.table)
  const declared = table?.fields.find((candidate) => candidate.name === field)
  return declared !== undefined && ATTACHMENT_TYPES.has(declared.type)
}

/**
 * Why a `connection` / `call` step passes a file parameter a value the
 * trigger's caller chooses, or `undefined`. An unknown connection, operation
 * or parameter is reported by the call check, not here. Any of the
 * automation's triggers may start the run, so a record attachment is accepted
 * only when EVERY trigger is a record trigger whose record carries that field.
 */
export const fileSourceIssue = (
  call: Call,
  triggers: ReadonlyArray<Trigger>,
  connections: ReadonlyArray<Connection>,
  tables: ReadonlyArray<Table>
): string | undefined => {
  const operation = connections
    .find((candidate) => candidate.name === call.connection)
    ?.operations?.find((candidate) => candidate.name === call.operation)
  const refused = Object.entries(call.params ?? {}).find(
    ([name, value]) =>
      operation?.params?.[name]?.type === 'file' &&
      TRIGGER_EXPRESSION.test(textOf(value)) &&
      !triggers.every((trigger) => isRecordAttachment(value, trigger, tables))
  )
  return refused === undefined
    ? undefined
    : `passes file parameter '${refused[0]}' a value read from the trigger (${textOf(refused[1])}): the caller of the trigger would choose which stored file is sent. Pass a literal key, a step output or, on a record trigger, an attachment field of the record`
}

/**
 * Why one `connection` / `call` step of an automation cannot run as written,
 * or `undefined`: first the call against its operation, then its file sources.
 */
export const connectionCallIssue = (
  automation: { readonly triggers: ReadonlyArray<Trigger> },
  call: Call,
  app: {
    readonly connections?:
      | ReadonlyArray<{
          readonly name: string
          readonly operations?: ReadonlyArray<ConnectionOperation> | undefined
        }>
      | undefined
    readonly tables?: ReadonlyArray<Table> | undefined
  }
): string | undefined =>
  callIssue(call, app.connections ?? []) ??
  fileSourceIssue(call, automation.triggers, app.connections ?? [], app.tables ?? [])
