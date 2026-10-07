/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ResolvedFormField } from './form-field-elements'
import type { CalculationField } from '@/domain/models/app/forms'

/**
 * A `kind: calculation` entry, its label and help text resolved by `resolveText`:
 * a read-only text input under the field's name, filled in the browser by the
 * runtime as its inputs change and recomputed by the server on submit. Never
 * required — the submitter cannot type into it. `format: percent` adds the `%`
 * unit beside it; `format: currency` is shown with two decimals by the runtime.
 */
export const calculationItem = <L>(
  field: Readonly<CalculationField>,
  languages: L,
  activeLang: string | undefined,
  resolveText: (
    value: CalculationField['label'],
    languages: L,
    fallback: string,
    activeLang: string | undefined
  ) => string
): ResolvedFormField => ({
  name: field.name,
  inputElement: 'text',
  htmlInputType: 'text',
  label: resolveText(field.label, languages, field.name, activeLang),
  placeholder: '',
  helpText: resolveText(field.helpText, languages, '', activeLang),
  required: false,
  hidden: field.hidden ?? false,
  readOnly: true,
  // A percentage is drawn with its unit beside it, as a percentage column is.
  ...(field.format === 'percent' ? { column: { type: 'percentage' } } : {}),
})
