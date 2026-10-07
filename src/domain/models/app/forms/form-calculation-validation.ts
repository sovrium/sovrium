/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  CALCULATION_HELPERS,
  calculationHelpers,
  calculationReferences,
  orderCalculations,
  parseCalculationFormula,
  type ParsedCalculation,
} from './form-calculation-service'

interface CalculationFieldShape {
  readonly kind: string
  readonly column?: string
  readonly name?: string
  readonly formula?: string
}

interface CalculationFormShape {
  readonly name: string
  readonly fields?: ReadonlyArray<CalculationFieldShape>
}

/** The name another field's formula reads this field under. */
const readableName = (field: CalculationFieldShape): string | undefined => {
  if (field.kind === 'table-field') return field.column
  if (field.kind === 'section') return undefined
  return field.name
}

/** The first refusal for one calculation, read on its own. */
const refuseCalculation = (
  label: string,
  formula: string,
  known: ReadonlySet<string>
): string | ParsedCalculation['expression'] => {
  const parsed = parseCalculationFormula(formula)
  if ('error' in parsed) return `${label}: the formula ${formula} cannot be read: ${parsed.error}`
  const refused = calculationHelpers(parsed).find(
    (helper) => !(CALCULATION_HELPERS as ReadonlyArray<string>).includes(helper)
  )
  if (refused !== undefined) {
    return `${label}: helper '${refused}' is not a number helper (a calculation may use ${CALCULATION_HELPERS.join(', ')})`
  }
  const unknown = calculationReferences(parsed).find((ref) => !known.has(ref))
  if (unknown !== undefined) {
    return `${label}: the formula reads '${unknown}', which is not a field of this form`
  }
  return parsed
}

const validateFormCalculations = (form: CalculationFormShape, formIndex: number) => {
  const fields = form.fields ?? []
  const known = new Set(
    fields.map(readableName).filter((name): name is string => name !== undefined)
  )
  const calculations = fields.filter(
    (field) => field.kind === 'calculation' && field.name !== undefined
  )
  const parsed = calculations.reduce<string | ReadonlyArray<ParsedCalculation>>((acc, field) => {
    if (typeof acc === 'string') return acc
    const name = field.name ?? ''
    const label = `forms[${formIndex}] '${form.name}' calculation '${name}'`
    const result = refuseCalculation(label, field.formula ?? '', known)
    return typeof result === 'string' ? result : [...acc, { name, expression: result }]
  }, [])
  if (typeof parsed === 'string') return parsed
  const order = orderCalculations(parsed)
  if ('cycle' in order) {
    return `forms[${formIndex}] '${form.name}': calculations form a cycle, each reading the next: ${order.cycle.join(' → ')}`
  }
  return undefined
}

/**
 * Refuse, at boot, a calculation whose formula cannot be read, calls a helper
 * outside the number family, reads a name that is not a field of its form, or
 * depends on itself through other calculations. Answers the first refusal, or
 * `undefined` when every calculation of every form is computable.
 */
export const validateCalculationFormulas = (
  forms: ReadonlyArray<CalculationFormShape>
): string | undefined =>
  forms.reduce<string | undefined>(
    (acc, form, formIndex) => acc ?? validateFormCalculations(form, formIndex),
    undefined
  )
