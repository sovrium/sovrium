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

type TriggerFormulaField = Fields[number] & { readonly type: 'formula'; readonly formula: string }

const getTriggerFormulaFields = (
  fields: readonly Fields[number][]
): readonly TriggerFormulaField[] => {
  const triggerFieldNames = getFormulaFieldsNeedingTrigger(fields)

  const triggerFields = fields.filter((field): field is TriggerFormulaField => {
    if (field.type !== 'formula' || !('formula' in field) || typeof field.formula !== 'string') {
      return false
    }
    const translatedFormula = translateFormulaToPostgres(field.formula, fields)
    return isFormulaVolatile(translatedFormula) || triggerFieldNames.has(field.name)
  })

  return triggerFields.toSorted((a, b) => {
    const aFormula = a.formula.toLowerCase()
    const bFormula = b.formula.toLowerCase()
    const aRefsB = new RegExp(`\\b${b.name}\\b`, 'i').test(aFormula)
    const bRefsA = new RegExp(`\\b${a.name}\\b`, 'i').test(bFormula)
    if (aRefsB && !bRefsA) return 1
    if (bRefsA && !aRefsB) return -1
    return 0
  })
}

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
      const translatedFormula = translateFormulaToPostgres(field.formula, fields)
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
