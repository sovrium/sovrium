/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { translateFormula } from './formula-translation'
import {
  castFormulaDivisionOperands,
  isFormulaVolatile,
  getFormulaFieldsNeedingTrigger,
  getViewComputedFormulaFields,
  qualifyColumnReferences,
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
  // View-computed formulas (reference rollup/lookup/count) are computed in the
  // VIEW's CTE, not as base-table columns — so the BEFORE INSERT/UPDATE trigger
  // on the base table must NOT try to populate them (the referenced rollup
  // columns do not exist on the base table).
  const viewComputedNames = getViewComputedFormulaFields(fields)

  const triggerFields = fields.filter((field): field is TriggerFormulaField => {
    if (field.type !== 'formula' || !('formula' in field) || typeof field.formula !== 'string') {
      return false
    }
    if (viewComputedNames.has(field.name)) return false
    // Check volatility on translated formula
    const translatedFormula = translateFormula(field.formula, fields)
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
      // Translate formula to the active dialect's syntax (e.g. on Postgres,
      // SUBSTR → SUBSTRING, date::TEXT → TO_CHAR)
      const translatedFormula = translateFormula(field.formula, fields)
      // Qualify column references with 't.' prefix for the subquery alias
      const qualifiedFormula = qualifyColumnReferences(translatedFormula, fields, 't')
      // Cast numeric `/` division operands so integer division does not truncate
      // (`t.total_minutes / 60` → `CAST(t.total_minutes AS NUMERIC) / 60`) —
      // [internal ref]. Runs AFTER qualification so it
      // matches the already-aliased references.
      const castFormula = castFormulaDivisionOperands(qualifiedFormula, fields, 't')
      return `  SELECT (${castFormula}) INTO NEW.${field.name} FROM (SELECT NEW.*) AS t;`
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
 * Native SQLite triggers that populate the trigger-computed formula columns.
 *
 * Why this arm has to exist at all: `generateFormulaColumn` emits a PLAIN
 * column (not `GENERATED ALWAYS AS`) for volatile and chained formulas on BOTH
 * engines, because neither engine allows a generated column to be
 * non-deterministic or to read another generated column. On Postgres the
 * PL/pgSQL trigger above fills it. Without an equivalent here, SQLite created
 * the column, accepted every write, and left the value NULL forever.
 *
 * Three details are load-bearing:
 *
 * - **AFTER, not BEFORE.** A SQLite BEFORE trigger cannot assign to `NEW`, so
 *   the value is written by an `UPDATE ... WHERE rowid = NEW.rowid` after the
 *   row lands. This mirrors the `updated_at` trigger in `trigger-generators.ts`,
 *   which already ships this exact shape.
 * - **One UPDATE per field, in dependency order.** A single multi-column SET
 *   evaluates every right-hand side against the PRE-update row, so a chained
 *   formula would read its dependency's stale value. `getTriggerFormulaFields`
 *   already returns dependencies first; issuing them as separate statements is
 *   what makes that ordering mean anything.
 * - **`AFTER UPDATE OF <base columns>`.** Scoping the update trigger to the
 *   non-formula columns stops it re-entering when its own UPDATE writes the
 *   formula columns. SQLite's `recursive_triggers` is off by default, so this
 *   is a second line of defence rather than the only one — but it is the line
 *   that survives someone turning that PRAGMA on.
 *
 * Column references are left UNQUALIFIED, unlike the Postgres arm: this runs as
 * a plain UPDATE against the table, not as a `SELECT ... FROM (SELECT NEW.*) AS
 * t` subquery, so there is no alias to qualify against.
 */
export const generateSqliteFormulaTriggers = (
  tableName: string,
  fields: readonly Fields[number][]
): readonly string[] => {
  const triggerFields = getTriggerFormulaFields(fields)
  if (triggerFields.length === 0) return []

  const triggerComputedNames = new Set(triggerFields.map((field) => field.name))
  const baseColumns = fields
    .filter((field) => field.type !== 'formula' && !triggerComputedNames.has(field.name))
    .map((field) => field.name)

  const assignments = triggerFields
    .map((field) => {
      const translated = translateFormula(field.formula, fields)
      const castFormula = castFormulaDivisionOperands(translated, fields)
      return `  UPDATE ${tableName} SET ${field.name} = (${castFormula}) WHERE rowid = NEW.rowid;`
    })
    .join('\n')

  const insertTrigger = `trigger_compute_${tableName}_formulas_ins`
  const updateTrigger = `trigger_compute_${tableName}_formulas_upd`
  // With no base columns to watch there is nothing a user write could change
  // that the formulas depend on, so fall back to the unscoped form rather than
  // emitting `UPDATE OF ()`, which is a syntax error.
  const updateScope = baseColumns.length > 0 ? ` OF ${baseColumns.join(', ')}` : ''

  return [
    `DROP TRIGGER IF EXISTS ${insertTrigger}`,
    `CREATE TRIGGER ${insertTrigger}
AFTER INSERT ON ${tableName}
FOR EACH ROW
BEGIN
${assignments}
END`,
    `DROP TRIGGER IF EXISTS ${updateTrigger}`,
    `CREATE TRIGGER ${updateTrigger}
AFTER UPDATE${updateScope} ON ${tableName}
FOR EACH ROW
BEGIN
${assignments}
END`,
  ]
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
