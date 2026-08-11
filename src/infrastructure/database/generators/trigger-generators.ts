/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQLITE_ISO_NOW } from '@/infrastructure/database/sql/dialect-ddl'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { sanitizeTableName } from '../table-queries/shared/field-utils'
import type { Table } from '@/domain/models/app/tables'

/**
 * Trigger generation — dialect notes
 * ----------------------------------
 * The triggers below are all written in PL/pgSQL (`CREATE FUNCTION … LANGUAGE
 * plpgsql` + `CREATE TRIGGER … EXECUTE FUNCTION`). SQLite has no procedural
 * language and a different trigger grammar, so the per-trigger behavior on
 * SQLite is:
 *
 *   - `created_at`     — handled by the column `DEFAULT CURRENT_TIMESTAMP`
 *     emitted by `column-generators.ts`; the PL/pgSQL "set on INSERT, freeze
 *     on UPDATE" trigger is **skipped**. Immutability of `created_at` is not
 *     enforced at the DB level on SQLite (a low-risk degradation — the column
 *     still defaults correctly on INSERT).
 *   - `autonumber`     — immutability trigger **skipped** on SQLite.
 *   - `updated-by`     — the PL/pgSQL `set_updated_by()` function is a no-op
 *     stub on Postgres too (it just `RETURN NEW`); **skipped** on SQLite.
 *   - `updated_at`     — emitted as a **native SQLite `AFTER UPDATE` trigger**
 *     so the column is bumped on every row update, matching the Postgres
 *     behavior. This is the lightest portable option (pure SQL, no app-side
 *     change to the records-CRUD layer).
 */

/**
 * Generate triggers for created-at fields (set on INSERT, prevent UPDATE)
 * Includes intrinsic created_at column if not explicitly defined
 */
export const generateCreatedAtTriggers = (table: Table): readonly string[] => {
  // SQLite: the column DEFAULT CURRENT_TIMESTAMP covers the INSERT case; the
  // PL/pgSQL "freeze on UPDATE" trigger is a Postgres-only guard.
  if (isSqliteRuntime()) return []

  const createdAtFields = table.fields.filter((field) => field.type === 'created-at')
  const hasCreatedAtField = table.fields.some((field) => field.name === 'created_at')

  // Collect all created_at field names
  const fieldNames = [
    ...createdAtFields.map((f) => f.name),
    // Include intrinsic created_at column if not explicitly defined
    ...(!hasCreatedAtField ? ['created_at'] : []),
  ]

  if (fieldNames.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  const setFunctionName = `set_${sanitized}_created_at`
  const setTriggerName = `a_trigger_${sanitized}_set_created_at` // Prefix with 'a_' to ensure it runs before formula triggers
  const preventFunctionName = `prevent_${sanitized}_created_at_update`
  const preventTriggerName = `a_trigger_${sanitized}_created_at_immutable` // Prefix with 'a_' to ensure it runs before formula triggers

  return [
    // Create trigger function to set created_at on INSERT
    `CREATE OR REPLACE FUNCTION ${setFunctionName}()
RETURNS TRIGGER AS $$
BEGIN
  ${fieldNames.map((name) => `IF NEW.${name} IS NULL THEN NEW.${name} = CURRENT_TIMESTAMP; END IF;`).join('\n  ')}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    // Create INSERT trigger
    `DROP TRIGGER IF EXISTS ${setTriggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${setTriggerName}
BEFORE INSERT ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${setFunctionName}()`,
    // Create trigger function to prevent updates
    `CREATE OR REPLACE FUNCTION ${preventFunctionName}()
RETURNS TRIGGER AS $$
BEGIN
  ${fieldNames.map((name) => `NEW.${name} = OLD.${name};`).join('\n  ')}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    // Create UPDATE trigger
    `DROP TRIGGER IF EXISTS ${preventTriggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${preventTriggerName}
BEFORE UPDATE ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${preventFunctionName}()`,
  ]
}

/**
 * Generate trigger to prevent updates to autonumber fields (immutability)
 */
export const generateAutonumberTriggers = (table: Table): readonly string[] => {
  // SQLite: the autonumber-immutability guard is a PL/pgSQL trigger; skipped.
  if (isSqliteRuntime()) return []

  const autonumberFields = table.fields.filter((field) => field.type === 'autonumber')

  if (autonumberFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  const fieldNames = autonumberFields.map((f) => f.name)
  const triggerFunctionName = `prevent_${sanitized}_autonumber_update`
  const triggerName = `trigger_${sanitized}_autonumber_immutable`

  return [
    // Create trigger function
    `CREATE OR REPLACE FUNCTION ${triggerFunctionName}()
RETURNS TRIGGER AS $$
BEGIN
  ${fieldNames.map((name) => `NEW.${name} = OLD.${name};`).join('\n  ')}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    // Create trigger
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${triggerName}
BEFORE UPDATE ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${triggerFunctionName}()`,
  ]
}

/**
 * Generate trigger to automatically update updated-by fields on UPDATE
 */
export const generateUpdatedByTriggers = (table: Table): readonly string[] => {
  // SQLite: the `set_updated_by()` PL/pgSQL function is a no-op stub even on
  // Postgres (it only `RETURN NEW`), so there is nothing to port — skipped.
  if (isSqliteRuntime()) return []

  const updatedByFields = table.fields.filter((field) => field.type === 'updated-by')

  if (updatedByFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)

  return [
    // Create trigger (fires on UPDATE only - updated_by should be NULL on INSERT)
    `DROP TRIGGER IF EXISTS set_updated_by ON ${sanitized}`,
    `CREATE TRIGGER set_updated_by
BEFORE UPDATE ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION set_updated_by()`,
  ]
}

/**
 * Generate triggers to automatically set/update updated-at fields on INSERT/UPDATE
 * Includes intrinsic updated_at column if not explicitly defined
 */
export const generateUpdatedAtTriggers = (table: Table): readonly string[] => {
  const updatedAtFields = table.fields.filter((field) => field.type === 'updated-at')
  const hasUpdatedAtField = table.fields.some((field) => field.name === 'updated_at')

  // Collect all updated_at field names
  const fieldNames = [
    ...updatedAtFields.map((f) => f.name),
    // Include intrinsic updated_at column if not explicitly defined
    ...(!hasUpdatedAtField ? ['updated_at'] : []),
  ]

  if (fieldNames.length === 0) return []

  const sanitized = sanitizeTableName(table.name)

  // SQLite: emit a native `AFTER UPDATE` trigger that re-stamps every
  // updated_at column. The value MUST be the ISO-8601 `strftime` expression
  // (SQLITE_ISO_NOW) — the same one the column DEFAULT uses on INSERT — and NOT
  // bare `CURRENT_TIMESTAMP`, which yields a space-separated `YYYY-MM-DD HH:MM:SS`
  // string that fails the records-API response schema's `z.iso.datetime()`
  // validation (surfacing as HTTP 500 on the get-by-id read of an updated row).
  // This is the lightest portable way to keep the column current — pure SQL,
  // no PL/pgSQL, no records-CRUD change.
  if (isSqliteRuntime()) {
    const triggerName = `a_trigger_${sanitized}_updated_at`
    const setClause = fieldNames.map((name) => `${name} = ${SQLITE_ISO_NOW}`).join(', ')
    return [
      `DROP TRIGGER IF EXISTS ${triggerName}`,
      `CREATE TRIGGER ${triggerName}
AFTER UPDATE ON ${sanitized}
FOR EACH ROW
BEGIN
  UPDATE ${sanitized} SET ${setClause} WHERE rowid = NEW.rowid;
END`,
    ]
  }

  const triggerFunctionName = `update_${sanitized}_updated_at`
  const triggerName = `a_trigger_${sanitized}_updated_at` // Prefix with 'a_' to ensure it runs before formula triggers

  return [
    // Create trigger function (handles both INSERT and UPDATE)
    `CREATE OR REPLACE FUNCTION ${triggerFunctionName}()
RETURNS TRIGGER AS $$
BEGIN
  ${fieldNames.map((name) => `NEW.${name} = CURRENT_TIMESTAMP;`).join('\n  ')}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    // Create trigger for both INSERT and UPDATE
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${triggerName}
BEFORE INSERT OR UPDATE ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${triggerFunctionName}()`,
  ]
}
