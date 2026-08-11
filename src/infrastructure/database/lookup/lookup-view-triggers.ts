/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { getColumnDefaultExpression } from '../sql/sql-column-generators'
import type { Table } from '@/domain/models/app/tables'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * The `id` insert-value expression for a view-backed table's `INSTEAD OF INSERT`
 * trigger. `id` is deliberately kept OUT of {@link getBaseFields} so the UPDATE
 * trigger never rewrites it, but the INSERT path must PRESERVE an explicitly
 * supplied id — e.g. a spec seeding `INSERT INTO invoices (id, ...) VALUES (500, ...)`
 * then referencing invoice 500 from a foreign key. Without this, the trigger
 * omitted `id` entirely and the base sequence assigned a different value, breaking
 * the FK reference.
 *
 * The expression mirrors {@link generateIdColumn}'s default per primary-key type
 * so an OMITTED id (the normal create path, `NEW.id = NULL`) still picks up the
 * base column's default, while an EXPLICIT id is honoured:
 *   - serial / bigserial (default): PG `COALESCE(NEW.id, nextval(pg_get_serial_sequence(...)))`
 *     — COALESCE short-circuits, so `nextval` only advances when `NEW.id` is NULL,
 *     and `lastval()` still resolves the new id on the omitted-id path. SQLite
 *     `NEW.id` — a NULL flows into `INTEGER PRIMARY KEY AUTOINCREMENT` and
 *     auto-assigns; an explicit value is honoured.
 *   - uuid / text: `COALESCE(NEW.id, <uuid-default>)` on both dialects — SERIAL's
 *     omit-to-default trick does not apply to a defaulted TEXT/UUID column (an
 *     explicit NULL would fail NOT NULL), so COALESCE supplies the default.
 */
export const getInsertIdExpression = (table: Table, baseTableName: string): string => {
  const pkType = table.primaryKey?.type
  if (isSqliteRuntime()) {
    // uuid/text ids are `TEXT NOT NULL DEFAULT (lower(hex(randomblob(16))))`;
    // serial ids are `INTEGER PRIMARY KEY AUTOINCREMENT` (NULL auto-assigns).
    return pkType === 'uuid' || pkType === 'text'
      ? 'COALESCE(NEW.id, (lower(hex(randomblob(16)))))'
      : 'NEW.id'
  }
  if (pkType === 'uuid') return 'COALESCE(NEW.id, gen_random_uuid())'
  if (pkType === 'text') return 'COALESCE(NEW.id, gen_random_uuid()::text)'
  return `COALESCE(NEW.id, nextval(pg_get_serial_sequence('${baseTableName}', 'id')))`
}

/**
 * Predicate: is this field a writable base column for the INSTEAD OF trigger?
 * Excludes lookup / rollup / count (handled by VIEW), ALL formula fields,
 * one-to-many / many-to-many relationship fields (no base column), and `id`.
 *
 * A `formula` field is NEVER a writable base column, on either dialect:
 *   - Postgres, immutable row-local formula → emitted as a `GENERATED ALWAYS AS
 *     (…) STORED` base column that computes itself. Writing `NEW.<formula>` (even
 *     the NULL that flows in through the view for an unsupplied computed field)
 *     is rejected by Postgres with "cannot insert a non-DEFAULT value into column
 *     …" / "column … can only be updated to DEFAULT". This is the whole bug: a
 *     view-backed rollup SOURCE (a table carrying BOTH a lookup and a row-local
 *     formula) fails EVERY `INSERT`/`UPDATE` through its view.
 *   - Postgres, volatile / formula-over-formula → emitted as a plain base column
 *     populated by a BEFORE INSERT/UPDATE trigger on the base table, which fires
 *     when the INSTEAD OF trigger writes to `<table>_base`. Omitting it from the
 *     view trigger lets the base-table trigger own the value (it recomputes
 *     regardless), so exclusion is safe.
 *   - SQLite → the formula column is a plain, non-self-computing column
 *     (Phase-6 degradation); the value arriving through the view is NULL anyway,
 *     so excluding it is a no-op for the observable result.
 * In every case the formula's value is computed, never carried by the view's
 * INSTEAD OF trigger — so it must be excluded from the base write.
 */
const isBaseColumnField = (field: Fields[number]): boolean => {
  if (field.type === 'lookup' || field.type === 'rollup' || field.type === 'count') return false
  if (field.type === 'formula') return false
  if (
    field.type === 'relationship' &&
    'relationType' in field &&
    (field.relationType === 'one-to-many' || field.relationType === 'many-to-many')
  ) {
    return false
  }
  if (field.name === 'id') return false
  return true
}

/**
 * Get base fields (non-lookup, non-rollup, non-count, non-formula,
 * non-one-to-many, non-many-to-many, non-id fields)
 */
export const getBaseFields = (table: Table): readonly string[] =>
  table.fields.filter((field) => isBaseColumnField(field)).map((field) => field.name)

/**
 * Writable column list for the INSTEAD OF UPDATE trigger.
 *
 * {@link getBaseFields} enumerates DECLARED fields, but the base table carries
 * more columns than the schema declares: `generateDeletedAtColumn` appends an
 * automatic `deleted_at` to every table (soft-delete-by-default). Because that
 * column is not a declared field it was absent from the UPDATE trigger's SET
 * list — so `UPDATE <view> SET deleted_at = …` was rewritten by the trigger
 * into a base UPDATE that never touched `deleted_at`, while the trigger still
 * returned NEW and `RETURNING id` still yielded a row. Every soft delete,
 * restore and cascade on a view-backed table therefore reported success and
 * wrote nothing, and the record kept reading back 200.
 *
 * A table that declares a field literally NAMED `deleted_at` already carries it
 * in `getBaseFields`, which is why that one shape happened to work — and why
 * the fix belongs here rather than in the naming rules: renaming the tombstone
 * field (`archived_at`) never restored the platform's own hardcoded write.
 *
 * `deleted_at` is the ONLY column that needs appending. It is the only base
 * column the platform writes through the view without the schema declaring it
 * (`executeSoftDelete`, `cascadeSoftDelete`, batch delete/restore and
 * `restoreRecord` all target it by that literal name); `deleted_by` exists only
 * when declared, and the automatic `created_at` / `updated_at` are never
 * written after insert.
 *
 * The presence test matches `generateDeletedAtColumn`'s exactly — by NAME, over
 * all declared fields, not by field type and not over the filtered base list.
 * A field named `deleted_at` means the automatic column was suppressed, so the
 * column is either already writable (a plain declared field) or deliberately
 * excluded by {@link isBaseColumnField} (a formula/computed column the trigger
 * must never write). Both cases want "leave the list alone".
 */
export const getUpdateBaseFields = (table: Table): readonly string[] => {
  const baseFields = getBaseFields(table)
  const declaresDeletedAt = table.fields.some((field) => field.name === 'deleted_at')
  return declaresDeletedAt ? baseFields : [...baseFields, 'deleted_at']
}

/**
 * The `VALUES` expression list for the INSTEAD OF INSERT trigger, aligned
 * positionally with {@link getBaseFields}. [internal ref]: a base column that carries a
 * DEFAULT is emitted as `COALESCE(NEW.col, <default>)` so an omitted column
 * (arriving as `NEW.col = NULL` through the view) still takes its base default
 * instead of failing a `NOT NULL` constraint; columns without a default pass
 * `NEW.col` straight through. Applies to both dialects — the default expression
 * is already dialect-resolved by `getColumnDefaultExpression`.
 */
export const getInsertValueExpressions = (table: Table): readonly string[] =>
  table.fields
    .filter((field) => isBaseColumnField(field))
    .map((field) => {
      const defaultExpr = getColumnDefaultExpression(field)
      return defaultExpr === undefined
        ? `NEW.${field.name}`
        : `COALESCE(NEW.${field.name}, ${defaultExpr})`
    })

/**
 * Generate INSTEAD OF INSERT trigger for a VIEW (PostgreSQL dialect).
 *
 * Wraps the redirect in a PL/pgSQL trigger function — required because
 * PostgreSQL's `INSTEAD OF` trigger fires a function reference, not an
 * inline statement body.
 */
export const generateInsertTrigger = (
  viewName: string,
  baseTableName: string,
  baseFields: readonly string[],
  insertValues?: readonly string[]
): readonly string[] => {
  const insertTriggerFunction = `${viewName}_instead_of_insert`
  const insertTrigger = `${viewName}_insert_trigger`
  const insertFieldsList = baseFields.join(', ')
  const insertValuesList = (insertValues ?? baseFields.map((name) => `NEW.${name}`)).join(', ')

  return [
    `CREATE OR REPLACE FUNCTION ${insertTriggerFunction}()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ${baseTableName} (${insertFieldsList})
  VALUES (${insertValuesList});
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${insertTrigger} ON ${viewName}`,
    `CREATE TRIGGER ${insertTrigger}
INSTEAD OF INSERT ON ${viewName}
FOR EACH ROW
EXECUTE FUNCTION ${insertTriggerFunction}()`,
  ]
}

/**
 * Generate INSTEAD OF UPDATE trigger for a VIEW (PostgreSQL dialect).
 */
export const generateUpdateTrigger = (
  viewName: string,
  baseTableName: string,
  baseFields: readonly string[]
): readonly string[] => {
  const updateTriggerFunction = `${viewName}_instead_of_update`
  const updateTrigger = `${viewName}_update_trigger`
  const updateSetList = baseFields.map((name) => `${name} = NEW.${name}`).join(', ')

  return [
    `CREATE OR REPLACE FUNCTION ${updateTriggerFunction}()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ${baseTableName}
  SET ${updateSetList}
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${updateTrigger} ON ${viewName}`,
    `CREATE TRIGGER ${updateTrigger}
INSTEAD OF UPDATE ON ${viewName}
FOR EACH ROW
EXECUTE FUNCTION ${updateTriggerFunction}()`,
  ]
}

/**
 * Generate INSTEAD OF DELETE trigger for a VIEW (PostgreSQL dialect).
 */
export const generateDeleteTrigger = (
  viewName: string,
  baseTableName: string
): readonly string[] => {
  const deleteTriggerFunction = `${viewName}_instead_of_delete`
  const deleteTrigger = `${viewName}_delete_trigger`

  return [
    `CREATE OR REPLACE FUNCTION ${deleteTriggerFunction}()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM ${baseTableName}
  WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${deleteTrigger} ON ${viewName}`,
    `CREATE TRIGGER ${deleteTrigger}
INSTEAD OF DELETE ON ${viewName}
FOR EACH ROW
EXECUTE FUNCTION ${deleteTriggerFunction}()`,
  ]
}

// ============================================================================
// SQLite dialect: INSTEAD OF triggers
// ============================================================================
//
// SQLite supports `CREATE TRIGGER … INSTEAD OF …` on views natively, but the
// trigger language is more restrictive than PostgreSQL's PL/pgSQL:
//
//   - No function wrapper. The body is a sequence of plain SQL statements
//     between `BEGIN` and `END;` — no `CREATE FUNCTION`, no `RETURNS TRIGGER`,
//     no `LANGUAGE` clause.
//   - No `OR REPLACE`. Use `DROP TRIGGER IF EXISTS` first, then `CREATE`.
//   - No `FOR EACH ROW` clause — INSTEAD OF triggers are row-level by default
//     (the only level SQLite supports for INSTEAD OF triggers).
//   - `NEW.<col>` / `OLD.<col>` row references work the same way they do in
//     PostgreSQL.
//
// Reference: https://www.sqlite.org/lang_createtrigger.html

/**
 * Generate INSTEAD OF INSERT trigger for a VIEW (SQLite dialect).
 *
 * SQLite triggers are statement-list bodies — no function wrapper — but the
 * redirect target (`*_base` table + writable column list) is identical to
 * the PostgreSQL form.
 */
export const generateInsertTriggerSqlite = (
  viewName: string,
  baseTableName: string,
  baseFields: readonly string[],
  insertValues?: readonly string[]
): readonly string[] => {
  const triggerName = `${viewName}_insert_trigger`
  const insertFieldsList = baseFields.join(', ')
  const insertValuesList = (insertValues ?? baseFields.map((name) => `NEW.${name}`)).join(', ')

  return [
    `DROP TRIGGER IF EXISTS ${triggerName}`,
    `CREATE TRIGGER ${triggerName}
INSTEAD OF INSERT ON ${viewName}
BEGIN
  INSERT INTO ${baseTableName} (${insertFieldsList})
  VALUES (${insertValuesList});
END`,
  ]
}

/**
 * Generate INSTEAD OF UPDATE trigger for a VIEW (SQLite dialect).
 *
 * Redirects `UPDATE <view> SET col = ?` to `UPDATE <view>_base SET col = ?`
 * matched on the base row's id, exactly mirroring the PostgreSQL semantics.
 */
export const generateUpdateTriggerSqlite = (
  viewName: string,
  baseTableName: string,
  baseFields: readonly string[]
): readonly string[] => {
  const triggerName = `${viewName}_update_trigger`
  const updateSetList = baseFields.map((name) => `${name} = NEW.${name}`).join(', ')

  return [
    `DROP TRIGGER IF EXISTS ${triggerName}`,
    `CREATE TRIGGER ${triggerName}
INSTEAD OF UPDATE ON ${viewName}
BEGIN
  UPDATE ${baseTableName}
  SET ${updateSetList}
  WHERE id = OLD.id;
END`,
  ]
}

/**
 * Generate INSTEAD OF DELETE trigger for a VIEW (SQLite dialect).
 */
export const generateDeleteTriggerSqlite = (
  viewName: string,
  baseTableName: string
): readonly string[] => {
  const triggerName = `${viewName}_delete_trigger`

  return [
    `DROP TRIGGER IF EXISTS ${triggerName}`,
    `CREATE TRIGGER ${triggerName}
INSTEAD OF DELETE ON ${viewName}
BEGIN
  DELETE FROM ${baseTableName}
  WHERE id = OLD.id;
END`,
  ]
}
