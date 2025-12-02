/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/table'

/**
 * Generate trigger to prevent updates to created-at fields (immutability)
 */
export const generateCreatedAtTriggers = (table: Table): readonly string[] => {
  const createdAtFields = table.fields.filter((field) => field.type === 'created-at')

  if (createdAtFields.length === 0) return []

  const fieldNames = createdAtFields.map((f) => f.name)
  const triggerFunctionName = `prevent_${table.name}_created_at_update`
  const triggerName = `trigger_${table.name}_created_at_immutable`

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
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${table.name}`,
    `CREATE TRIGGER ${triggerName}
BEFORE UPDATE ON ${table.name}
FOR EACH ROW
EXECUTE FUNCTION ${triggerFunctionName}()`,
  ]
}

/**
 * Generate trigger to prevent updates to autonumber fields (immutability)
 */
export const generateAutonumberTriggers = (table: Table): readonly string[] => {
  const autonumberFields = table.fields.filter((field) => field.type === 'autonumber')

  if (autonumberFields.length === 0) return []

  const fieldNames = autonumberFields.map((f) => f.name)
  const triggerFunctionName = `prevent_${table.name}_autonumber_update`
  const triggerName = `trigger_${table.name}_autonumber_immutable`

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
    `DROP TRIGGER IF EXISTS ${triggerName} ON ${table.name}`,
    `CREATE TRIGGER ${triggerName}
BEFORE UPDATE ON ${table.name}
FOR EACH ROW
EXECUTE FUNCTION ${triggerFunctionName}()`,
  ]
}

/**
 * Generate trigger to automatically update updated-by fields on UPDATE
 */
export const generateUpdatedByTriggers = (table: Table): readonly string[] => {
  const updatedByFields = table.fields.filter((field) => field.type === 'updated-by')

  if (updatedByFields.length === 0) return []

  return [
    // Create trigger
    `DROP TRIGGER IF EXISTS set_updated_by ON ${table.name}`,
    `CREATE TRIGGER set_updated_by
BEFORE UPDATE ON ${table.name}
FOR EACH ROW
EXECUTE FUNCTION set_updated_by()`,
  ]
}
