/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Authorship-field name resolution (pure domain).
 *
 * `created-by` / `updated-by`-typed table fields can carry ANY column name
 * (the literal `created_by` / `updated_by`, or a custom name like `author`).
 * They are generated `TEXT NOT NULL` when auth is configured, so a write that
 * leaves them unpopulated violates the NOT-NULL constraint.
 *
 * The infrastructure authorship injection only fills the LITERAL `created_by`
 * / `updated_by` columns (it discovers them by name via DB introspection and
 * has no access to the app schema's field-TYPE information). These helpers run
 * in the application layer — where the table schema IS available — to compute
 * the BY-NAME overrides for custom-named authorship fields, which the caller
 * folds into the record payload before the bound-table write.
 *
 * Pure-domain: no DB, no Effect. Operates on the minimal structural shape of a
 * table's fields so it can be shared by the forms and automations use-cases
 * without importing a feature-model type into a shared service.
 */

/** Minimal structural shape of a table field needed for authorship resolution. */
interface AuthorshipFieldShape {
  readonly name: string
  readonly type: string
}

/** Minimal structural shape of a table needed for authorship resolution. */
interface AuthorshipTableShape {
  readonly name: string
  readonly fields: ReadonlyArray<AuthorshipFieldShape>
}

const findTable = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string
): AuthorshipTableShape | undefined => tables?.find((table) => table.name === tableName)

/**
 * Names of the `created-by`-typed fields declared on the named table. Includes
 * the literal `created_by` as well as any custom-named field (e.g. `author`).
 */
export const createdByFieldNames = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string
): readonly string[] =>
  (findTable(tables, tableName)?.fields ?? [])
    .filter((field) => field.type === 'created-by')
    .map((field) => field.name)

/**
 * Names of the `updated-by`-typed fields declared on the named table.
 */
export const updatedByFieldNames = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string
): readonly string[] =>
  (findTable(tables, tableName)?.fields ?? [])
    .filter((field) => field.type === 'updated-by')
    .map((field) => field.name)

/**
 * Names of the `deleted-by`-typed fields declared on the named table.
 *
 * Completes the trio for consumers that must reason about the WHOLE authorship
 * surface rather than the write path alone — GDPR Art. 17 erasure being the
 * case that forced it. Erasure matched authorship by the LITERAL column names,
 * so a table declaring `{ name: 'author', type: 'created-by' }` had zero rows
 * deleted while reporting success.
 */
export const deletedByFieldNames = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string
): readonly string[] =>
  (findTable(tables, tableName)?.fields ?? [])
    .filter((field) => field.type === 'deleted-by')
    .map((field) => field.name)

/**
 * Build the override map that stamps `actorId` into every `created-by`-typed
 * field of the named table (on create, both created-by and updated-by fields
 * are stamped — authorship starts as "created and last-modified by the same
 * actor"). Returns `{}` when the table is unknown or declares no authorship
 * fields, so the caller can spread it unconditionally.
 */
export const buildCreateAuthorshipOverrides = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string,
  actorId: string
): Readonly<Record<string, string>> => {
  const names = [
    ...createdByFieldNames(tables, tableName),
    ...updatedByFieldNames(tables, tableName),
  ]
  return Object.fromEntries(names.map((name) => [name, actorId]))
}

/**
 * Build the override map that stamps `actorId` into every `updated-by`-typed
 * field of the named table on UPDATE. Created-by fields are NEVER touched on
 * update — only the last-writer is re-stamped.
 */
export const buildUpdateAuthorshipOverrides = (
  tables: ReadonlyArray<AuthorshipTableShape> | undefined,
  tableName: string,
  actorId: string
): Readonly<Record<string, string>> => {
  const names = updatedByFieldNames(tables, tableName)
  return Object.fromEntries(names.map((name) => [name, actorId]))
}
