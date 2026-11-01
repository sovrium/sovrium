/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SSR React components that render a single form field for the embedded
 * form output. Extracted from `form-renderer.tsx` so the sibling file
 * stays under the line cap and so the prefill / locked-prefill rendering
 * variants can grow independently of the form-document orchestration.
 */

/**
 * Resolved-field shape consumed by every input component below. Mirrors
 * the `ResolvedField` interface in `form-renderer.tsx`; kept structural
 * (no shared import) because both files re-derive it from the same
 * `Form` schema and circular imports would otherwise force a third
 * module purely for the type alias.
 */
import {
  DateInput,
  isDesignField,
  MultiChoiceInput,
  SelectInput,
} from './form-field-elements-design'
import { FileInput, UserInput } from './form-field-elements-media'
import { TextareaInput, RadioInput, SignatureInput, TextInput } from './form-field-elements-text'
import { CheckboxInput, RatingInput, SectionHeading, zonedValue } from './form-field-elements-typed'
import { prefillValueToString } from './form-resolved-field'
import type { ResolvedFormField, PrefillValue } from './form-resolved-field'

/**
 * Hidden submission input used when `inlinePrefill.lockPrefill: true` is
 * set on the host page-form component. Renders only an `<input
 * type="hidden">` (one per array element when the prefill is an array) so
 * the value is submitted but no UI surfaces; the field's `<label>` and
 * help text are intentionally suppressed because the submitter has no
 * opportunity to interact with them.
 *
 * Array-shaped prefill (e.g. multi-select tags inherited from `$parent`)
 * renders as multiple `<input type="hidden" name="tags">` entries — the
 * native browser form encoding then sends `tags=urgent&tags=backend`,
 * which Hono's `parseBody({ all: true })` expands into a `string[]` that
 * Postgres TEXT[] columns accept directly.
 */
const LockedHiddenInput = ({
  field,
  value,
}: {
  readonly field: ResolvedFormField
  readonly value: PrefillValue
}) => {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <input
          type="hidden"
          name={field.name}
          value=""
          data-locked-prefill="true"
        />
      )
    }
    return (
      <>
        {value.map((entry, index) => (
          <input
            key={`${field.name}-${index}`}
            type="hidden"
            name={field.name}
            value={String(entry)}
            data-locked-prefill="true"
          />
        ))}
      </>
    )
  }
  return (
    <input
      type="hidden"
      name={field.name}
      value={String(value)}
      data-locked-prefill="true"
    />
  )
}

/**
 * React component for a single resolved form field. Hidden fields are
 * skipped entirely from the rendered output (their default values are
 * applied server-side at submit-time, so they never need a DOM input).
 *
 * When the host page supplies an `inlinePrefill` value for this field
 * AND `lockPrefill: true` is set, the field renders as a single
 * `<input type="hidden">` carrying the prefilled value — the submitter
 * cannot edit it and the server revalidates the parent on submit.
 *
 * When `lockPrefill` is false (or omitted), the prefilled value becomes
 * the input's `defaultValue` so the submitter sees it as the initial
 * value and can override it inline.
 */
/**
 * Dispatch a non-hidden, non-locked field to the right input component by its
 * `inputElement` discriminator — pulled out of `FormFieldElement` so it stays
 * under the max-lines-per-function cap. This is the leaf dispatcher.
 */

/** A `section` item, a `rating` scale and a checkbox, the items not drawn as a labelled box. */
function dispatchAnswerlessOrScale(field: ResolvedFormField, defaultValue: string | undefined) {
  if (field.inputElement === 'section') return <SectionHeading field={field} />
  if (field.inputElement === 'rating') return <RatingInput {...{ field, defaultValue }} />
  if (field.inputElement === 'checkbox') return <CheckboxInput {...{ field, defaultValue }} />
  return undefined
}

/** A single choice or a date, drawn by the design system; a set of choices, by the browser. */
function designOrNative(field: ResolvedFormField, defaultValue: string | undefined) {
  if (!isDesignField(field)) return <MultiChoiceInput {...{ field, defaultValue }} />
  if (field.inputElement === 'date') return <DateInput {...{ field, defaultValue }} />
  return <SelectInput {...{ field, defaultValue }} />
}

function dispatchFieldInput(field: ResolvedFormField, defaultValue: string | undefined) {
  const f = field
  const dv = defaultValue
  if (f.inputElement === 'textarea') return <TextareaInput {...{ field: f, defaultValue: dv }} />
  if (f.inputElement === 'select' || f.inputElement === 'date') return designOrNative(f, dv)
  if (f.inputElement === 'radio')
    return (
      <RadioInput
        field={f}
        defaultValue={dv}
      />
    )
  if (f.inputElement === 'signature') return <SignatureInput field={f} />
  const item = dispatchAnswerlessOrScale(f, dv)
  if (item !== undefined) return item
  if (f.inputElement === 'file')
    return (
      <FileInput
        field={f}
        multiple={false}
      />
    )
  if (f.inputElement === 'file-multi')
    return (
      <FileInput
        field={f}
        multiple={true}
      />
    )
  if (f.inputElement === 'user')
    return (
      <UserInput
        field={f}
        defaultValue={dv}
      />
    )
  return (
    <TextInput
      field={f}
      defaultValue={dv}
    />
  )
}

export function FormFieldElement({
  field,
  prefillValue,
  lockPrefill,
}: {
  readonly field: ResolvedFormField
  readonly prefillValue: PrefillValue | undefined
  readonly lockPrefill: boolean
}) {
  if (field.hidden) {
    // A hidden field with a RESOLVED prefill value (e.g. `$query.ref` from the
    // form-level `prefill` map) must still carry that value into the submission —
    // render it as an `<input type="hidden">` so the runtime collects it and the
    // server writes it to the record. Without a prefill value
    // there is nothing to submit (the server applies any literal `defaultValue`
    // at submit-time), so render nothing.
    if (prefillValue !== undefined) {
      return (
        <LockedHiddenInput
          field={field}
          value={prefillValue}
        />
      )
    }
    return undefined
  }
  if (lockPrefill && field.prefillEditable !== true && prefillValue !== undefined) {
    return (
      <LockedHiddenInput
        field={field}
        value={prefillValue}
      />
    )
  }
  const defaultValue = prefillValue !== undefined ? prefillValueToString(prefillValue) : undefined
  return dispatchFieldInput(field, zonedValue(field, defaultValue))
}
