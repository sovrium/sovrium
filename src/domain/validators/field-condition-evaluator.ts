/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Field Condition Evaluator
 *
 * Single-select fields may declare behavioral `conditions` — when the
 * field's value matches a `when` clause, the `then` object describes
 * property changes (e.g. `{ readOnly: true }`).
 *
 * A `readOnly: true` condition that matches the record's current value
 * places the record in a read-only state: subsequent updates to ANY field
 * must be rejected. This module is the pure, server-side evaluator that the
 * record-update route consults before applying a mutation.
 *
 * @see [internal ref] — field conditions change behavior based on value
 */

/** A behavioral condition on a single-select field. */
interface FieldCondition {
  readonly when: string
  readonly then: Readonly<Record<string, unknown>>
}

/** Minimal field shape needed for condition evaluation. */
interface ConditionalField {
  readonly name: string
  readonly conditions?: ReadonlyArray<FieldCondition>
}

/**
 * Determine whether a record is currently in a read-only state.
 *
 * Walks every field that declares `conditions`. For each field, if the
 * record's stored value for that field equals a condition's `when` clause
 * AND the condition's `then` sets `readOnly: true`, the record is locked.
 *
 * @param fields - The table's field definitions
 * @param record - The record's current (stored) values, keyed by field name
 * @returns `true` when at least one read-only condition matches
 */
export const isRecordReadOnly = (
  fields: ReadonlyArray<ConditionalField>,
  record: Readonly<Record<string, unknown>>
): boolean =>
  fields.some((field) => {
    if (!field.conditions || field.conditions.length === 0) return false
    const currentValue = record[field.name]
    return field.conditions.some(
      (condition) => condition.when === currentValue && condition.then['readOnly'] === true
    )
  })
