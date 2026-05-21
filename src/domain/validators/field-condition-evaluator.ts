/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


interface FieldCondition {
  readonly when: string
  readonly then: Readonly<Record<string, unknown>>
}

interface ConditionalField {
  readonly name: string
  readonly conditions?: ReadonlyArray<FieldCondition>
}

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
