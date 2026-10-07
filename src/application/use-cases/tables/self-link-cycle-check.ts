/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A record can never become its own ancestor.
 *
 * A relationship from a table to ITSELF nests its records — a folder under a
 * folder, a task under a task — and a `tree` reads exactly that nesting. A
 * write that files a record under itself, or under one of its own
 * descendants, would close a loop: a branch with no root, which no tree can
 * draw and no ancestor walk can finish. The database's foreign key cannot see
 * that (every row it points at exists), so the update path refuses it here,
 * before anything is written, naming the field.
 *
 * Only a single-key self link nests (many-to-one or one-to-one). A
 * many-to-many self link is a graph of peers — mentors, related items — where
 * a loop is ordinary, so it is not judged.
 *
 * Cost: one keyed read per ancestor of the proposed parent, for an update that
 * names a self link; nothing for any other write. The walk stops at a root, at
 * a row it has already seen (a loop the data held before this rule), or after
 * {@link MAX_DEPTH} levels.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { ValidationError } from '@/domain/errors'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DatabaseError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

/** How deep the ancestor walk goes before it stops looking. */
const MAX_DEPTH = 10_000

/** The fields of `tableName` that nest its records under one parent of the same table. */
const nestingFieldsOf = (app: App | undefined, tableName: string): readonly string[] =>
  (app?.tables?.find((t) => t.name === tableName)?.fields ?? []).flatMap((field) => {
    const candidate = field as {
      readonly name: string
      readonly type: string
      readonly relatedTable?: unknown
      readonly relationType?: unknown
    }
    if (candidate.type !== 'relationship' || candidate.relatedTable !== tableName) return []
    if (candidate.relationType === 'many-to-many' || candidate.relationType === 'one-to-many')
      return []
    return [candidate.name]
  })

/** The key a value names, or `undefined` for a blank. */
const keyOf = (value: unknown): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined
  const key = String(raw)
  return key === '' ? undefined : key
}

/**
 * Whether `recordId` is `start` or one of its ancestors through `field`.
 * `parentOf` reads one row's parent key.
 */
const reachesRecord = <E, R>(input: {
  readonly recordId: string
  readonly start: string
  readonly parentOf: (key: string) => Effect.Effect<string | undefined, E, R>
}): Effect.Effect<boolean, E, R> => {
  const walk = (
    key: string | undefined,
    seen: ReadonlySet<string>,
    depth: number
  ): Effect.Effect<boolean, E, R> => {
    if (key === undefined || seen.has(key) || depth > MAX_DEPTH) return Effect.succeed(false)
    if (key === input.recordId) return Effect.succeed(true)
    return input
      .parentOf(key)
      .pipe(Effect.flatMap((parent) => walk(parent, new Set([...seen, key]), depth + 1)))
  }
  return walk(input.start, new Set(), 0)
}

/** One record of a write and the fields it names. */
interface NestingWrite {
  readonly id: string
  readonly fields: Readonly<Record<string, unknown>>
}

/**
 * The batch index and field of the first write that would make its record its
 * own ancestor through `field`. Every write naming `field` is read as if the
 * whole batch had landed: a parent the batch changes is judged at its new
 * value, so two moves that close a loop only together are caught.
 */
const firstLoopThrough = <E, R>(
  field: string,
  writes: readonly NestingWrite[],
  storedParentOf: (key: string) => Effect.Effect<string | undefined, E, R>
): Effect.Effect<readonly [number, string] | undefined, E, R> => {
  const proposed = new Map(
    writes.filter((w) => Object.hasOwn(w.fields, field)).map((w) => [w.id, keyOf(w.fields[field])])
  )
  const parentOf = (key: string) =>
    proposed.has(key) ? Effect.succeed(proposed.get(key)) : storedParentOf(key)
  const moves = writes.flatMap((write, index) => {
    const start = Object.hasOwn(write.fields, field) ? keyOf(write.fields[field]) : undefined
    return start === undefined ? [] : [{ recordId: write.id, start, index }]
  })
  return Effect.forEach(moves, ({ recordId, start, index }) =>
    reachesRecord({ recordId, start, parentOf }).pipe(
      Effect.map((loops) => (loops ? ([index, field] as const) : undefined))
    )
  ).pipe(Effect.map((verdicts) => verdicts.find((verdict) => verdict !== undefined)))
}

/**
 * Refuse a write of one or many records that would make any of them its own
 * ancestor through a self link it names, with a `ValidationError` naming the
 * field (and, in a batch, the record's position). A batch is refused whole.
 */
export const refuseSelfLinkCycles = (input: {
  readonly app: App | undefined
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly records: readonly { readonly id: string; readonly fields?: Record<string, unknown> }[]
}): Effect.Effect<void, ValidationError | DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const { app, session, tableName } = input
    const writes = input.records.map((r) => ({ id: String(r.id), fields: r.fields ?? {} }))
    const named = nestingFieldsOf(app, tableName).filter((name) =>
      writes.some((w) => Object.hasOwn(w.fields, name))
    )
    if (named.length === 0) return
    const repo = yield* TableRepository
    const loops = yield* Effect.forEach(named, (field) =>
      firstLoopThrough(field, writes, (key) =>
        repo.getRecord(session, tableName, key).pipe(Effect.map((row) => keyOf(row?.[field])))
      )
    )
    const looping = loops.find((loop) => loop !== undefined)
    if (looping === undefined) return
    const [record, field] = looping
    return yield* Effect.fail(
      new ValidationError(`${field} would make the record its own ancestor`, [
        { record, field, error: 'A record cannot be filed under itself' },
      ])
    )
  }).pipe(Effect.withSpan('tables.refuse-self-link-cycles'))

/**
 * Refuse an update of `recordId` that would make it its own ancestor through
 * any self link it names — {@link refuseSelfLinkCycles} for one record.
 */
export const refuseSelfLinkCycle = (input: {
  readonly app: App | undefined
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordId: string
  readonly fields: Readonly<Record<string, unknown>>
}): Effect.Effect<void, ValidationError | DatabaseError, TableRepository> =>
  refuseSelfLinkCycles({
    ...input,
    records: [{ id: input.recordId, fields: { ...input.fields } }],
  }).pipe(Effect.withSpan('tables.refuse-self-link-cycle'))
