/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isFormulaVolatile, translateFormulaToPostgres } from './formula-utils'
import type { Fields } from '@/domain/models/app/table/fields'

/**
 * Type for formula fields with volatile functions
 */
type VolatileFormulaField = Fields[number] & { readonly type: 'formula'; readonly formula: string }

/**
 * Get formula fields that contain volatile functions
 * These fields need trigger-based computation instead of GENERATED ALWAYS AS
 */
const getVolatileFormulaFields = (
  fields: readonly Fields[number][]
): readonly VolatileFormulaField[] =>
  fields.filter(
    (field): field is VolatileFormulaField =>
      field.type === 'formula' &&
      'formula' in field &&
      typeof field.formula === 'string' &&
      isFormulaVolatile(field.formula)
  )

/**
 * Generate trigger function for volatile formula computation
 * Creates a single trigger function that computes all volatile formula fields
 */
export const generateVolatileFormulaTriggerFunction = (
  tableName: string,
  fields: readonly Fields[number][]
): string | undefined => {
  const volatileFields = getVolatileFormulaFields(fields)
  if (volatileFields.length === 0) {
    return undefined
  }

  const functionName = `compute_${tableName}_formulas`
  const assignments = volatileFields
    .map((field) => {
      // Translate formula to PostgreSQL syntax (e.g., SUBSTR → SUBSTRING, date::TEXT → TO_CHAR)
      const translatedFormula = translateFormulaToPostgres(field.formula, fields)
      // Replace column references with NEW.column_name
      // We need to handle this carefully - for now, use dynamic SQL with NEW.*
      return `  SELECT (${translatedFormula}) INTO NEW.${field.name} FROM (SELECT NEW.*) AS t;`
    })
    .join('\n')

  return `
CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
BEGIN
${assignments}
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`.trim()
}

/**
 * Generate trigger that calls the formula computation function
 * Fires BEFORE INSERT OR UPDATE to compute volatile formula values
 */
export const generateVolatileFormulaTrigger = (
  tableName: string,
  fields: readonly Fields[number][]
): string | undefined => {
  const volatileFields = getVolatileFormulaFields(fields)
  if (volatileFields.length === 0) {
    return undefined
  }

  const functionName = `compute_${tableName}_formulas`
  const triggerName = `trigger_compute_${tableName}_formulas`

  return `
CREATE TRIGGER ${triggerName}
BEFORE INSERT OR UPDATE ON ${tableName}
FOR EACH ROW
EXECUTE FUNCTION ${functionName}();
`.trim()
}

/**
 * Create volatile formula triggers for a table
 * Helper function to create both trigger function and trigger in one call
 */
/* eslint-disable functional/no-expression-statements */
export const createVolatileFormulaTriggers = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  tableName: string,
  fields: readonly Fields[number][]
): Promise<void> => {
  const triggerFunction = generateVolatileFormulaTriggerFunction(tableName, fields)
  if (triggerFunction) await tx.unsafe(triggerFunction)

  const trigger = generateVolatileFormulaTrigger(tableName, fields)
  if (trigger) await tx.unsafe(trigger)
}
/* eslint-enable functional/no-expression-statements */
