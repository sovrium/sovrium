/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Class names and attributes every form-field wrapper shares, split out of
 * `form-field-elements.tsx` so its sibling input modules read one copy.
 */

import {
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
  computeFormHelpTextClasses,
} from '@/presentation/design/form-layout-classes'
import type { ResolvedFormField } from './form-resolved-field'

// Shared form-field chrome — composes the semantic class names (kept as theme /
// back-compat hooks) with the shared form-layout design contract so STANDALONE
// forms render with the same field spacing + label/help typography as the
// EMBEDDED CRUD pipeline by default. The semantic classes (`form-field`,
// `help-text`, `form-field-legend`, …) stay so `app.design`-driven CSS that
// targets them keeps working.
export const FIELD_WRAPPER_CLASS = `form-field ${computeFormFieldClasses()}`
export const FIELD_LABEL_CLASS = computeFormFieldLabelClasses()
export const HELP_TEXT_CLASS = `help-text ${computeFormHelpTextClasses()}`

// A field hidden by its `visibleWhen` keeps its wrapper in the page (the
// inline runtime shows it again when the rule turns true), marked so that
// both the browser and the runtime read the same state. Module-level so no
// object is allocated per render.
const CONDITION_HIDDEN_ATTRIBUTES = { hidden: true, 'data-condition-hidden': 'true' } as const
const NO_WRAPPER_ATTRIBUTES = {} as const

/** Attributes every field wrapper spreads: the hidden-by-condition marker, or nothing. */
export function fieldWrapperAttributes(field: ResolvedFormField) {
  return field.conditionHidden === true ? CONDITION_HIDDEN_ATTRIBUTES : NO_WRAPPER_ATTRIBUTES
}

const REQUIRED_ARIA = { 'aria-required': true } as const

/** `aria-required` on a required control, nothing on an optional one. */
export function ariaRequired(required: boolean): { readonly 'aria-required'?: true } {
  return required ? REQUIRED_ARIA : NO_WRAPPER_ATTRIBUTES
}

/** The field a help text belongs to: its name, and its help text as inline HTML. */
export interface HelpTextField {
  readonly name: string
  readonly helpTextHtml?: string | undefined
}

/**
 * The id of a field's help text, which its control names in
 * `aria-describedby` so a screen reader reads the hint with the label; none
 * when the field has no help text. It starts `field-`, as a control id does,
 * so an embed that scopes control ids scopes it with them.
 */
export function helpTextIdOf(field: HelpTextField): string | undefined {
  const html = field.helpTextHtml
  return html === undefined || html === '' ? undefined : `field-${field.name}-help`
}

/** A control's `aria-describedby` naming its field's help text, or nothing. */
export function describedByHelpOf(field: HelpTextField): { readonly 'aria-describedby'?: string } {
  const id = helpTextIdOf(field)
  return id === undefined ? {} : { 'aria-describedby': id }
}
