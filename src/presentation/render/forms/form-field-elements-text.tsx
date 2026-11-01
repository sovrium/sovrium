/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SSR text-entry controls of a form field: the text input, the textarea,
 * the radio group and the signature pad, with the typed attributes a table
 * column adds.
 */

import { inputComponentTypeOf } from '@/presentation/design/field-control-attributes'
import { computeFormFieldClasses } from '@/presentation/design/form-layout-classes'
import {
  typedInputAttributes,
  withAdornment,
} from '@/presentation/render/elements/crud-form/crud-form-typed-input'
import {
  ariaRequired,
  FIELD_LABEL_CLASS,
  FIELD_WRAPPER_CLASS,
  fieldWrapperAttributes,
} from './form-field-chrome'
import { RequiredMark } from './form-field-elements-typed'
import { HelpText } from './form-help-text'
import type { ResolvedFormField } from './form-resolved-field'
import type { ReactElement } from 'react'

export const TextareaInput = ({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}) => (
  <div
    className={FIELD_WRAPPER_CLASS}
    {...fieldWrapperAttributes(field)}
  >
    <label
      htmlFor={`field-${field.name}`}
      className={FIELD_LABEL_CLASS}
    >
      {field.label}
      <RequiredMark required={field.required} />
    </label>
    <textarea
      id={`field-${field.name}`}
      data-component-type="textarea"
      name={field.name}
      required={field.required}
      {...ariaRequired(field.required)}
      disabled={field.conditionHidden}
      autoComplete={field.autocomplete}
      placeholder={field.placeholder || undefined}
      defaultValue={defaultValue ?? undefined}
    />
    <HelpText html={field.helpTextHtml} />
  </div>
)

/**
 * Radio-group input. Renders the field's `options[]` as a vertical list
 * of `<input type="radio">` controls — each with its own `<label>` so
 * Playwright's `getByLabel(optionLabel)` matches the individual option.
 *
 * Used both for `inputType: 'radio'` standalone fields AND for the
 * `inputType: 'select'` standalone field when the form uses
 * `layout: one-question` (one-question's auto-advance UX is built around
 * "click an option, advance" — a `<select>` dropdown does not surface a
 * stable per-option label and would force the runtime to fall back to
 * onChange + delay tricks). The form-renderer rewrites the inputElement
 * to `'radio'` for those select fields before dispatch.
 */
export const RadioInput = ({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}) => (
  <div
    className={`form-field form-field-radio ${computeFormFieldClasses()}`}
    role="radiogroup"
    aria-labelledby={`field-${field.name}-legend`}
    {...ariaRequired(field.required)}
    {...fieldWrapperAttributes(field)}
  >
    <div
      id={`field-${field.name}-legend`}
      className={`form-field-legend ${FIELD_LABEL_CLASS}`}
    >
      {field.label}
      <RequiredMark required={field.required} />
    </div>
    {(field.options ?? []).map((option) => {
      const optionId = `field-${field.name}-${option.value}`
      return (
        <div
          key={option.value}
          className="form-radio-option"
        >
          <input
            id={optionId}
            type="radio"
            name={field.name}
            value={option.value}
            required={field.required}
            disabled={field.conditionHidden}
            defaultChecked={defaultValue === option.value}
          />
          <label htmlFor={optionId}>{option.label}</label>
        </div>
      )
    })}
    <HelpText html={field.helpTextHtml} />
  </div>
)

/**
 * SSR-only signature field: a labelled `<canvas class="signature">` and nothing
 * more. There is deliberately NO `data-island` marker — no `signature` key
 * exists in ISLANDS (src/presentation/islands/island-registry.ts) and no
 * signature island file exists, so a marker here would advertise a mount that
 * never happens. `data-field-name` stays: it is the submission hook, not a
 * hydration hook. If drawing capture is ever built, add the island FIRST and the
 * marker second — `[internal ref]` fails on a marker with no
 * island.
 */
export const SignatureInput = ({ field }: { readonly field: ResolvedFormField }) => (
  <div
    className={FIELD_WRAPPER_CLASS}
    data-field-name={field.name}
    {...fieldWrapperAttributes(field)}
  >
    <label
      htmlFor={`field-${field.name}`}
      className={FIELD_LABEL_CLASS}
    >
      {field.label}
      <RequiredMark required={field.required} />
    </label>
    <canvas
      id={`field-${field.name}`}
      className="signature"
      data-name={field.name}
    />
    <HelpText html={field.helpTextHtml} />
  </div>
)

export const TextInput = ({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}) => (
  <div
    className={FIELD_WRAPPER_CLASS}
    {...fieldWrapperAttributes(field)}
  >
    <label
      htmlFor={`field-${field.name}`}
      className={FIELD_LABEL_CLASS}
    >
      {field.label}
      <RequiredMark required={field.required} />
    </label>
    {typedInput(
      field,
      <input
        id={`field-${field.name}`}
        type={field.htmlInputType}
        data-component-type={inputComponentTypeOf(field.htmlInputType)}
        name={field.name}
        required={field.required}
        {...ariaRequired(field.required)}
        {...typedAttributesOf(field)}
        disabled={field.conditionHidden}
        readOnly={field.readOnly}
        autoComplete={field.autocomplete}
        placeholder={field.placeholder || undefined}
        defaultValue={defaultValue ?? undefined}
      />
    )}
    <HelpText html={field.helpTextHtml} />
  </div>
)

/**
 * A table-bound number input with its unit (`€`, `%`) beside it, drawn by the
 * helper the page `form` component draws it with; any other input as is.
 */
function typedInput(field: ResolvedFormField, input: ReactElement): ReactElement {
  return field.column === undefined ? input : withAdornment(field.column, input)
}

/** A table-bound number input's `inputMode` / `step` / `min` / `max`; nothing otherwise. */
function typedAttributesOf(field: ResolvedFormField): Readonly<Record<string, unknown>> {
  return field.column === undefined ? NO_TYPED_ATTRIBUTES : typedInputAttributes(field.column)
}
const NO_TYPED_ATTRIBUTES = {} as const
