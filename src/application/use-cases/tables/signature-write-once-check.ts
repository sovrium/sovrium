/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one check every record write road runs on its `signature` fields, and on
 * the fields a signing flow writes: the single create and update (the form post
 * included), the batch create and update (the grid's bulk edit included), the
 * upsert and the CSV import, whoever drives them — a person, a form mapping, an
 * automation, an agent.
 *
 * - A signature is authored by the engine only. A value reaches a `signature`
 *   column when it carries the engine's mark ({@link engineAuthoredSignature}):
 *   `captureSignature` gives it to the signature it builds, and `sovrium seed`
 *   to the operator's imported values. The mark is a symbol: no request body,
 *   JSON or form, can carry it. Any other value is refused naming the field.
 * - A signature already stored is kept: a write that would change or clear it
 *   is refused with a `ValidationError` naming the field; one resending the
 *   very value stored changes nothing and is left out of the write.
 * - A field a signing flow writes (`output`) is refused unless the write keeps
 *   what is stored.
 *
 * Two first signatures racing past these reads are settled by the write itself:
 * every signature column a write still carries is written only while it is
 * empty ({@link writeOnceColumnsOf}), and a write that finds it filled is
 * refused with the same answer.
 */

import { DateTime, Effect, Option } from 'effect'
import { SignatureRequestRepository } from '@/application/ports/repositories/signatures/signature-request-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import {
  flowDocumentFieldsOf,
  flowOutputFieldsOf,
} from '@/domain/models/app/signatures/signature-flow-fields-service'
import {
  importedSignatureValue,
  signatureClientWriteRefusal,
  signatureColumnsOf,
  signatureDocumentLockedRefusal,
  signatureFlowOutputRefusal,
  signatureKeptRefusal,
  signatureShapeRefusal,
} from '@/domain/models/app/tables/fields/field-types/media/signature-value-validation'
import {
  isSigned,
  keepsStoredValue,
  signatureOverwriteOf,
} from '@/domain/models/app/tables/fields/field-types/media/signature-write-once-validation'
import { findTableByName } from '@/domain/models/app/tables/table-lookup-service'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DatabaseError, ValidationError } from '@/domain/errors'
import type { SignatureValueV2 } from '@/domain/models/api/signatures/common'
import type { App } from '@/domain/models/app'

type Row = Readonly<Record<string, unknown>>

/** The engine's mark on a signature value it authored. Never serialised: it is a symbol. */
const ENGINE_AUTHORED: unique symbol = Symbol('sovrium/signatures/engine-authored')

/** A signature value carrying the engine's mark. */
export type EngineAuthoredSignature = SignatureValueV2 & { readonly [ENGINE_AUTHORED]: true }

/**
 * Mark `value` as authored by the engine, so a write road accepts it into an
 * empty `signature` field. Only `captureSignature` and the seeder call this.
 */
export const engineAuthoredSignature = (value: SignatureValueV2): EngineAuthoredSignature => ({
  ...value,
  [ENGINE_AUTHORED]: true,
})

/** The value as it is stored, or `undefined` when it does not carry the engine's mark. */
const engineValueOf = (value: unknown): SignatureValueV2 | undefined => {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, ENGINE_AUTHORED)) {
    return undefined
  }
  const { [ENGINE_AUTHORED]: _mark, ...stored } = value as EngineAuthoredSignature
  return stored
}

/** The engine's mark on a value it writes into a flow's output field. Never serialised. */
const ENGINE_FLOW_OUTPUT: unique symbol = Symbol('sovrium/signatures/engine-flow-output')

/** A value the engine writes into a flow's `output` field, carrying its mark. */
export interface EngineFlowOutput {
  readonly [ENGINE_FLOW_OUTPUT]: unknown
}

/**
 * Mark `value` as written by a signing flow, so a write road accepts it into
 * the flow's `output` field (the status, the signed file, the proof file).
 * Only the signing request use-cases call this; no request body can carry it.
 */
export const engineWrittenFlowOutput = (value: unknown): EngineFlowOutput => ({
  [ENGINE_FLOW_OUTPUT]: value,
})

/** The value an engine-marked output carries, boxed; `undefined` when it carries no mark. */
const engineOutputOf = (value: unknown): { readonly value: unknown } | undefined =>
  typeof value === 'object' && value !== null && Object.hasOwn(value, ENGINE_FLOW_OUTPUT)
    ? { value: (value as EngineFlowOutput)[ENGINE_FLOW_OUTPUT] }
    : undefined

/** Which table a write goes to. */
interface WriteScope {
  readonly app: App | undefined
  readonly tableName: string
}

/** One write as the check reads it: the fields it sends, and the row it would change. */
export interface SignatureWriteScope<E> {
  readonly fields: Row
  /** The row as it stands, `null`/`undefined` when not found; absent for a create. */
  readonly held?: Effect.Effect<Row | null | undefined, E>
}

/** The table's fields, as the rules read them. */
const tableFieldsOf = (app: App | undefined, tableName: string) =>
  (findTableByName(app?.tables, tableName)?.fields ?? []) as readonly {
    readonly name: string
    readonly type: string
  }[]

/** The signature columns of a table, which its writes fill only while they are empty. */
export const writeOnceColumnsOf = (app: App | undefined, tableName: string): readonly string[] =>
  signatureColumnsOf(tableFieldsOf(app, tableName))

/**
 * A flow's output field: written when the engine marked the value, left out
 * when the write keeps what is stored, refused otherwise.
 */
const settleOutputField = (
  rest: Row,
  cell: { readonly field: string; readonly value: unknown; readonly held: unknown },
  index: number
): Effect.Effect<Row, ValidationError> => {
  const written = engineOutputOf(cell.value)
  if (written !== undefined) return Effect.succeed({ ...rest, [cell.field]: written.value })
  return keepsStoredValue(cell.held, cell.value)
    ? Effect.succeed(rest)
    : Effect.fail(signatureFlowOutputRefusal(cell.field, index))
}

/** One field of one write, settled: the fields with it kept, written, or left out. */
const settleField = (
  write: { readonly fields: Row; readonly held: Row | null | undefined; readonly index: number },
  field: string,
  outputs: readonly string[],
  documents: ReadonlyMap<string, readonly string[]> = new Map()
): Effect.Effect<Row, ValidationError> => {
  // A flow's document is checked by its lock (`documentLockRefusal`), and written as sent.
  if (documents.has(field)) return Effect.succeed(write.fields)
  const { [field]: value, ...rest } = write.fields
  const held = write.held?.[field]
  if (outputs.includes(field)) return settleOutputField(rest, { field, value, held }, write.index)
  // The write-once pass proved a stored one unchanged, and nothing over an empty
  // cell changes nothing: either way the write leaves the column out.
  if (isSigned(held) || value === null || value === undefined) return Effect.succeed(rest)
  const authored = engineValueOf(value)
  return authored === undefined
    ? Effect.fail(signatureClientWriteRefusal(field, write.index))
    : Effect.succeed({ ...rest, [field]: authored })
}

/**
 * The refusal of a write changing the document of a signing request that has
 * not ended: the file every signer signs is frozen when the request is sent,
 * and the record keeps the same file until the request ends. Read only when a
 * write changes a flow's document field of a stored row, and only where the
 * server provides the requests (a unit test without them judges nothing).
 */
const documentLockRefusal = (
  input: WriteScope & { readonly documents: ReadonlyMap<string, readonly string[]> },
  write: { readonly fields: Row; readonly held: Row | null | undefined; readonly index: number }
) =>
  Effect.gen(function* () {
    const { held } = write
    const changed = [...input.documents.entries()].filter(
      ([field]) =>
        Object.hasOwn(write.fields, field) && !keepsStoredValue(held?.[field], write.fields[field])
    )
    if (changed.length === 0 || held === null || held === undefined) return undefined
    const requests = yield* Effect.serviceOption(SignatureRequestRepository)
    if (Option.isNone(requests)) return undefined
    const recordId = String(held['id'])
    const locked = yield* Effect.filter(changed, ([, flowNames]) =>
      requests.value.hasUnended({ tableName: input.tableName, recordId, flowNames })
    )
    const [first] = locked
    return first === undefined ? undefined : signatureDocumentLockedRefusal(first[0], write.index)
  })

/**
 * Settle the signature and flow-output fields of every write: each write's
 * fields as they are to be written, in order. Writes naming none are handed
 * back untouched and read nothing. Any refusal fails the whole call, so nothing
 * is written — the write-once refusals first, over every write, then the
 * checks of each value.
 */
export const settleSignatureWrites = <E = never>(
  input: WriteScope & { readonly writes: readonly SignatureWriteScope<E>[] }
): Effect.Effect<readonly Row[], ValidationError | DatabaseError | E> =>
  Effect.gen(function* () {
    const tableFields = tableFieldsOf(input.app, input.tableName)
    const outputs = flowOutputFieldsOf(input.app?.signatures, input.tableName)
    const documents = flowDocumentFieldsOf(input.app?.signatures, input.tableName)
    const columns = [...signatureColumnsOf(tableFields), ...outputs, ...documents.keys()]
    const namedIn = (fields: Row) => columns.filter((column) => Object.hasOwn(fields, column))
    if (!input.writes.some((write) => namedIn(write.fields).length > 0)) {
      return input.writes.map((write) => write.fields)
    }
    // A create, or a write naming none of them, holds no row: it is never read.
    const held = yield* Effect.forEach(input.writes, (write, index) =>
      namedIn(write.fields).length === 0 || write.held === undefined
        ? Effect.as(Effect.void, undefined)
        : Effect.flatMap(write.held, (row) => {
            const update = write.fields
            const field = signatureOverwriteOf({ fields: tableFields, held: row, update })
            return field === undefined
              ? Effect.succeed(row)
              : Effect.fail(signatureKeptRefusal(field, index))
          })
    )
    const locked = yield* Effect.forEach(input.writes, (write, index) =>
      documentLockRefusal({ ...input, documents }, { ...write, held: held[index], index })
    )
    const refusal = locked.find((found) => found !== undefined)
    if (refusal !== undefined) return yield* Effect.fail(refusal)
    return yield* Effect.forEach(input.writes, (write, index) =>
      Effect.reduce(
        namedIn(write.fields),
        (): Row => write.fields,
        (fields, field) =>
          settleField({ fields, held: held[index], index }, field, outputs, documents)
      )
    )
  }).pipe(Effect.withSpan('tables.settle-signature-writes'))

/**
 * The rows `sovrium seed` writes, each signature it carries turned into the
 * operator's imported signature: version 2, `identity: imported`, no evidence
 * id, marked as the engine's so the write road accepts it. A value that is not
 * a complete signature is refused naming the field, and nothing is written.
 */
export const seededSignaturesIn = (
  app: App | undefined,
  tableName: string,
  rows: readonly Row[]
): Effect.Effect<readonly Row[], ValidationError> =>
  Effect.gen(function* () {
    const columns = writeOnceColumnsOf(app, tableName)
    if (columns.length === 0) return rows
    const now = DateTime.formatIso(yield* DateTime.now)
    return yield* Effect.forEach(rows, (row, index) =>
      Effect.reduce(
        columns.filter((column) => Object.hasOwn(row, column)),
        (): Row => row,
        (fields, column) => {
          const value = fields[column]
          if (value === null || value === undefined) return Effect.succeed(fields)
          const imported = importedSignatureValue(value, now)
          return imported === undefined
            ? Effect.fail(signatureShapeRefusal(column, index))
            : Effect.succeed({ ...fields, [column]: engineAuthoredSignature(imported) })
        }
      )
    )
  }).pipe(Effect.withSpan('tables.seeded-signatures-in'))

/**
 * A batch update's records, each one's signatures settled against the row it
 * changes as the caller reads it ({@link settleSignatureWrites}).
 */
export const settleBatchUpdateSignatures = <
  R extends { readonly id: string; readonly fields?: Record<string, unknown> },
>(
  scope: WriteScope & { readonly session: Readonly<UserSession> },
  records: readonly R[]
): Effect.Effect<readonly R[], ValidationError | DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName } = scope
    const settled = yield* settleSignatureWrites({
      ...{ app: scope.app, tableName },
      writes: records.map((record) => ({
        fields: record.fields ?? {},
        held: repo.getRecord(session, tableName, record.id),
      })),
    })
    return records.map((record, index) =>
      record.fields === undefined ? record : { ...record, fields: { ...settled[index] } }
    )
  }).pipe(Effect.withSpan('tables.settle-batch-update-signatures'))
