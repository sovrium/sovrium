/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isFormulaVolatile,
  getFormulaFieldsNeedingTrigger,
  qualifyColumnReferences,
  translateFormulaToPostgres,
} from './formula-utils'
import type { Fields } from '@/domain/models/app/tables/fields'

/**
 * Type for formula fields that need trigger-based computation
 */
type TriggerFormulaField = Fields[number] & { readonly type: 'formula'; readonly formula: string }

/**
 * Get formula fields that need trigger-based computation instead of GENERATED ALWAYS AS
 *
 * A formula needs trigger-based computation when:
 * 1. It contains volatile functions (CURRENT_DATE, NOW(), etc.) - PostgreSQL requires GENERATED
 *    columns to be immutable
 * 2. It is part of a formula-to-formula dependency chain - PostgreSQL does not allow GENERATED
 *    columns to reference other generated columns. Both the referencing and referenced formula
 *    fields must use triggers.
 *
 * IMPORTANT: Check volatility on TRANSLATED formula because date::TEXT becomes
 * TO_CHAR(date, 'format') which is STABLE, not IMMUTABLE.
 *
 * Returns fields in dependency order: fields that are referenced by other formula fields
 * come first, so their values are computed before dependents read them.
 */
const getTriggerFormulaFields = (
  fields: readonly Fields[number][]
): readonly TriggerFormulaField[] => {
  const triggerFieldNames = getFormulaFieldsNeedingTrigger(fields)

  const triggerFields = fields.filter((field): field is TriggerFormulaField => {
    if (field.type !== 'formula' || !('formula' in field) || typeof field.formula !== 'string') {
      return false
    }
    // Check volatility on translated formula
    const translatedFormula = translateFormulaToPostgres(field.formula, fields)
    return isFormulaVolatile(translatedFormula) || triggerFieldNames.has(field.name)
  })

  // Sort trigger fields so dependencies come first
  // A field that is referenced by another trigger field should be computed first
  return triggerFields.toSorted((a, b) => {
    const aFormula = a.formula.toLowerCase()
    const bFormula = b.formula.toLowerCase()
    const aRefsB = new RegExp(`\\b${b.name}\\b`, 'i').test(aFormula)
    const bRefsA = new RegExp(`\\b${a.name}\\b`, 'i').test(bFormula)
    // If A references B, B should come first (return positive to put A after B)
    if (aRefsB && !bRefsA) return 1
    // If B references A, A should come first
    if (bRefsA && !aRefsB) return -1
    return 0
  })
}

/**
 * Generate trigger function for volatile formula computation
 * Creates a single trigger function that computes all volatile formula fields
 */
export const generateVolatileFormulaTriggerFunction = (
  tableName: string,
  fields: readonly Fields[number][]
): string | undefined => {
  const volatileFields = getTriggerFormulaFields(fields)
  if (volatileFields.length === 0) {
    return undefined
  }

  const functionName = `compute_${tableName}_formulas`
  const assignments = volatileFields
    .map((field) => {
      // Translate formula to PostgreSQL syntax (e.g., SUBSTR → SUBSTRING, date::TEXT → TO_CHAR)
      const translatedFormula = translateFormulaToPostgres(field.formula, fields)
      // Qualify column references with 't.' prefix for the subquery alias
      const qualifiedFormula = qualifyColumnReferences(translatedFormula, fields, 't')
      return `  SELECT (${qualifiedFormula}) INTO NEW.${field.name} FROM (SELECT NEW.*) AS t;`
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
  const volatileFields = getTriggerFormulaFields(fields)
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
