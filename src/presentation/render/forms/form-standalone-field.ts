/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A standalone form field (one bound to no table column) resolved to the field
 * a form draws, signature fields included.
 */

import { autofillHintOverlay } from '@/domain/models/app/forms/form-autofill-hint-service'
import { resolveText } from './form-field-text'
import { recordAudioOverlay } from './form-table-field'
import type { ResolvedFormField } from './form-resolved-field'
import type { SignatureField } from '@/domain/models/app/forms'
import type { StandaloneField } from '@/domain/models/app/forms/fields/standalone'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'
import type { Languages } from '@/domain/models/app/languages'

/**
 * A standalone field's `inputType` → the HTML input element type it is drawn
 * with. A phone number, a date-time and an attachment take the control a
 * table-bound column of the same type takes: no browser knows `type="phone"`,
 * `"datetime"` or `"attachment"`, and each would draw a bare text box — an
 * attachment field without a file picker. Every other `inputType` is its own
 * element type.
 */
const STANDALONE_INPUT_ELEMENT: Readonly<Record<string, string>> = {
  'long-text': 'textarea',
  'short-text': 'text',
  select: 'select',
  'multi-select': 'select',
  rating: 'number',
  checkbox: 'checkbox',
  radio: 'radio',
  phone: 'tel',
  datetime: 'datetime-local',
  attachment: 'file',
}

/** Map a standalone field's `inputType` onto an HTML input element type. */
const inputTypeForStandalone = (inputType: string): string =>
  STANDALONE_INPUT_ELEMENT[inputType] ?? inputType

export const resolveSignatureField = (
  field: Readonly<SignatureField>,
  languages: Languages | undefined,
  activeLang?: string
): ResolvedFormField => ({
  name: field.name,
  inputElement: 'signature',
  htmlInputType: 'signature',
  label: resolveText(field.label, languages, field.name, activeLang),
  placeholder: resolveText(field.placeholder, languages, '', activeLang),
  helpText: resolveText(field.helpText, languages, '', activeLang),
  required: field.required ?? false,
  hidden: field.hidden ?? false,
})

/**
 * A standalone field's choices: read from a table when it names an
 * `optionsSource` (row values are data, never `$t:` keys), else its authored
 * `options` with each label localized.
 */
function standaloneOptions(
  field: Readonly<StandaloneField>,
  optionSets: FormOptionSets,
  languages: Languages | undefined,
  activeLang: string | undefined
): ResolvedFormField['options'] {
  if (field.optionsSource !== undefined) return optionSets[field.name] ?? []
  // Resolve the option label's `$t:` token against the active locale
  // (a forms spec parity for standalone select fields); the stored `value` is
  // never localized.
  return field.options?.map((option) => ({
    value: option.value,
    label: resolveText(option.label ?? option.value, languages, option.value, activeLang),
  }))
}

export const resolveStandaloneField = (
  field: Readonly<StandaloneField>,
  languages: Languages | undefined,
  activeLang: string | undefined,
  optionSets: FormOptionSets
): ResolvedFormField => {
  const inputType = inputTypeForStandalone(field.inputType)
  const options = standaloneOptions(field, optionSets, languages, activeLang)
  return {
    name: field.name,
    inputElement: inputType,
    htmlInputType: inputType,
    label: resolveText(field.label, languages, field.name, activeLang),
    placeholder: resolveText(field.placeholder, languages, '', activeLang),
    helpText: resolveText(field.helpText, languages, '', activeLang),
    required: field.required ?? false,
    hidden: field.hidden ?? false,
    ...(options !== undefined ? { options } : {}),
    ...(field.inputType === 'multi-select' ? { multiChoice: true } : {}),
    ...(field.accept !== undefined ? { accept: field.accept } : {}),
    ...(field.maxFileSize !== undefined ? { maxFileSize: field.maxFileSize } : {}),
    ...(field.maxFiles !== undefined ? { maxFiles: field.maxFiles } : {}),
    ...(field.dropZone !== undefined ? { dropZone: field.dropZone } : {}),
    ...recordAudioOverlay(field.recordAudio),
    ...autofillHintOverlay(field.inputType, field.autocomplete),
  }
}
