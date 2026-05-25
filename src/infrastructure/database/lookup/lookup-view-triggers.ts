/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/tables'

export const getBaseFields = (table: Table): readonly string[] =>
  table.fields
    .filter((field) => {
      if (field.type === 'lookup' || field.type === 'rollup' || field.type === 'count') {
        return false
      }
      if (
        field.type === 'relationship' &&
        'relationType' in field &&
        (field.relationType === 'one-to-many' || field.relationType === 'many-to-many')
      ) {
        return false
      }
      if (field.name === 'id') {
        return false
      }
      return true
    })
    .map((field) => field.name)

export const generateInsertTrigger = (
  viewName: string,
  baseTableName: string,
  baseFields: readonly string[]
): readonly string[] => {
  const insertTriggerFunction = `${viewName}_instead_of_insert`
  const insertTrigger = `${viewName}_insert_trigger`
  const insertFieldsList = baseFields.join(', ')
  const insertValuesList = baseFields.map((name) => `NEW.${name}`).join(', ')

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


export const generateInsertTriggerSqlite = (
  viewName: string,
  baseTableName: string,
  baseFields: readonly string[]
): readonly string[] => {
  const triggerName = `${viewName}_insert_trigger`
  const insertFieldsList = baseFields.join(', ')
  const insertValuesList = baseFields.map((name) => `NEW.${name}`).join(', ')

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
