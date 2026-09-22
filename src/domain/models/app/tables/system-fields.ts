/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The system field namespace — every column name that can exist on a table
 * WITHOUT appearing in its `fields[]`.
 *
 * This module exists because "is this a real field?" was being answered from
 * six independent hand-written lists, and a hand-written list of what another
 * file creates is a drift bug with a delay fuse. The two halves below are each
 * anchored to the code that actually produces the name, and the DDL half is
 * additionally pinned by a parity test (the DDL-side parity test) that generates
 * a real `CREATE TABLE` for a field-less table and asserts the emitted column
 * set equals {@link INTRINSIC_TABLE_COLUMNS}. Adding a fifth intrinsic column
 * to the DDL without adding it here fails that test.
 */

/**
 * Intrinsic columns — the ones `generateCreateTableSQL` adds to EVERY table
 * when the author declares no field of that name.
 *
 * Each constant is CONSUMED by the generator that emits the column
 * (`infrastructure/database/table-operations/column-generators.ts`), so these
 * are the same strings the DDL is built from rather than a transcription of
 * them.
 */
export const INTRINSIC_ID_COLUMN = 'id'
/** @see generateCreatedAtColumn */
export const INTRINSIC_CREATED_AT_COLUMN = 'created_at'
/** @see generateUpdatedAtColumn */
export const INTRINSIC_UPDATED_AT_COLUMN = 'updated_at'
/** @see generateDeletedAtColumn */
export const INTRINSIC_DELETED_AT_COLUMN = 'deleted_at'

/**
 * Every column the DDL creates implicitly. Order matches the emission order in
 * `generateCreateTableSQL` so the parity test can compare positionally.
 */
export const INTRINSIC_TABLE_COLUMNS = [
  INTRINSIC_ID_COLUMN,
  INTRINSIC_CREATED_AT_COLUMN,
  INTRINSIC_UPDATED_AT_COLUMN,
  INTRINSIC_DELETED_AT_COLUMN,
] as const

/**
 * Authorship columns. These are NOT intrinsic — they exist only when the author
 * declares a `created-by` / `updated-by` / `deleted-by` field, which is why
 * `batch-delete.ts` probes for `deleted_by` with a runtime `columnExists` check
 * rather than assuming it.
 *
 * They still belong to the system namespace because `transformRecord` lifts
 * them OUT of the record's `fields` object and promotes them to camelCase root
 * properties — so a declared `created_by` is addressable from a grid column as
 * `createdBy` and NOT as `created_by`. Both spellings are admitted below; see
 * the note on {@link SYSTEM_FIELD_NAMES}.
 */
export const AUTHORSHIP_TABLE_COLUMNS = ['created_by', 'updated_by', 'deleted_by'] as const

/**
 * The camelCase spellings `transformRecord` promotes to the root of an API
 * record. The grid flattens `{ ...root, ...fields }` into one row object, so
 * these are live row keys that a `columns[].field` legitimately resolves
 * against.
 *
 * @see application/use-cases/tables/utils/record-transformer.ts
 */
export const PROMOTED_SYSTEM_FIELD_NAMES = [
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedBy',
] as const

/**
 * The full system namespace, in every spelling a config may legitimately use.
 *
 * **This set is deliberately permissive, and the validator that consumes it
 * deliberately does not adjudicate within it.** The addressable spelling
 * differs by CONTEXT, and no static check can pick the right one reliably:
 *
 * - `dataSource.filter` / `dataSource.sort` are applied SERVER-side and travel
 *   as raw DB column names — `created_at`, snake_case.
 * - `columns[].field`, `groupBy`, `summary`, `kanbanGroupBy`, `dateField` and
 *   `rowColorField` resolve against the FLATTENED client row, whose system keys
 *   are the transformer's promotions — `createdAt`, camelCase.
 *
 * Splitting the check by context would trade a rare wrong-spelling miss for a
 * class of false REJECTIONS, and the asymmetry there is not close: a false
 * rejection refuses to start a working app, while a false acceptance renders
 * one empty cell. So the rule is "outside this namespace, the author must have
 * declared it" — nothing more.
 */
export const SYSTEM_FIELD_NAMES: ReadonlySet<string> = new Set<string>([
  ...INTRINSIC_TABLE_COLUMNS,
  ...AUTHORSHIP_TABLE_COLUMNS,
  ...PROMOTED_SYSTEM_FIELD_NAMES,
])

/**
 * Whether `name` is a system column rather than an author-declared field.
 *
 * Callers use this to EXEMPT a name from a `fields[]` existence check — never
 * to assert the name resolves in their particular context (see the note on
 * {@link SYSTEM_FIELD_NAMES}).
 */
export const isSystemFieldName = (name: string): boolean => SYSTEM_FIELD_NAMES.has(name)

/**
 * Whether `name` can resolve to a real column of a table whose author-declared
 * fields are `declaredFieldNames` — i.e. it is either declared, or a member of
 * the system namespace above.
 *
 * This is the single predicate behind BOTH halves of the record-filter field
 * check, and it exists as one function precisely because they are two halves:
 * the AppSchema cross-validation refuses a field written LITERALLY in the
 * config, while the automation runtime refuses one that arrives through a
 * `{{...}}` template and therefore does not exist at decode time. Two copies of
 * "is this a real column?" is how the boot-time verdict and the runtime verdict
 * come to disagree about the same name — and the disagreement is not
 * symmetrical: on SQLite an accepted-but-unknown identifier degrades to a
 * string literal and the predicate matches the WHOLE table.
 *
 * Callers pass the declared set rather than the table, so the lookup is theirs
 * to build once and reuse across every condition in a filter.
 */
export const isResolvableColumnName = (
  declaredFieldNames: ReadonlySet<string>,
  name: string
): boolean => declaredFieldNames.has(name) || isSystemFieldName(name)
