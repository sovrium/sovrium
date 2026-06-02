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


export const generateCreatedAtTriggers = (table: Table): readonly string[] => {
  if (isSqliteRuntime()) return []

  const createdAtFields = table.fields.filter((field) => field.type === 'created-at')
  const hasCreatedAtField = table.fields.some((field) => field.name === 'created_at')

  const fieldNames = [
    ...createdAtFields.map((f) => f.name),
    ...(!hasCreatedAtField ? ['created_at'] : []),
  ]

  if (fieldNames.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  const setFunctionName = `set_${sanitized}_created_at`
  const setTriggerName = `a_trigger_${sanitized}_set_created_at`
  const preventFunctionName = `prevent_${sanitized}_created_at_update`
  const preventTriggerName = `a_trigger_${sanitized}_created_at_immutable`

  return [
    `CREATE OR REPLACE FUNCTION ${setFunctionName}()
RETURNS TRIGGER AS $$
BEGIN
  ${fieldNames.map((name) => `IF NEW.${name} IS NULL THEN NEW.${name} = CURRENT_TIMESTAMP; END IF;`).join('\n  ')}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${setTriggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${setTriggerName}
BEFORE INSERT ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${setFunctionName}()`,
    `CREATE OR REPLACE FUNCTION ${preventFunctionName}()
RETURNS TRIGGER AS $$
BEGIN
  ${fieldNames.map((name) => `NEW.${name} = OLD.${name};`).join('\n  ')}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${preventTriggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${preventTriggerName}
BEFORE UPDATE ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${preventFunctionName}()`,
  ]
}

export const generateAutonumberTriggers = (table: Table): readonly string[] => {
  if (isSqliteRuntime()) return []

  const autonumberFields = table.fields.filter((field) => field.type === 'autonumber')

  if (autonumberFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)
  const fieldNames = autonumberFields.map((f) => f.name)
  const triggerFunctionName = `prevent_${sanitized}_autonumber_update`
  const triggerName = `trigger_${sanitized}_autonumber_immutable`

  return [
    `CREATE OR REPLACE FUNCTION ${triggerFunctionName}()
RETURNS TRIGGER AS $$
BEGIN
  ${fieldNames.map((name) => `NEW.${name} = OLD.${name};`).join('\n  ')}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${triggerName}
BEFORE UPDATE ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${triggerFunctionName}()`,
  ]
}

export const generateUpdatedByTriggers = (table: Table): readonly string[] => {
  if (isSqliteRuntime()) return []

  const updatedByFields = table.fields.filter((field) => field.type === 'updated-by')

  if (updatedByFields.length === 0) return []

  const sanitized = sanitizeTableName(table.name)

  return [
    `DROP TRIGGER IF EXISTS set_updated_by ON ${sanitized}`,
    `CREATE TRIGGER set_updated_by
BEFORE UPDATE ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION set_updated_by()`,
  ]
}

export const generateUpdatedAtTriggers = (table: Table): readonly string[] => {
  const updatedAtFields = table.fields.filter((field) => field.type === 'updated-at')
  const hasUpdatedAtField = table.fields.some((field) => field.name === 'updated_at')

  const fieldNames = [
    ...updatedAtFields.map((f) => f.name),
    ...(!hasUpdatedAtField ? ['updated_at'] : []),
  ]

  if (fieldNames.length === 0) return []

  const sanitized = sanitizeTableName(table.name)

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
  const triggerName = `a_trigger_${sanitized}_updated_at`

  return [
    `CREATE OR REPLACE FUNCTION ${triggerFunctionName}()
RETURNS TRIGGER AS $$
BEGIN
  ${fieldNames.map((name) => `NEW.${name} = CURRENT_TIMESTAMP;`).join('\n  ')}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${sanitized}`,
    `CREATE TRIGGER ${triggerName}
BEFORE INSERT OR UPDATE ON ${sanitized}
FOR EACH ROW
EXECUTE FUNCTION ${triggerFunctionName}()`,
  ]
}
