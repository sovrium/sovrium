/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-refresh/only-export-components -- This module pairs
   per-field SSR React components (TextInput, SelectInput, ...) with the
   `FormFieldElement` orchestrator that picks the right one. The components
   are SSR-only and never participate in client-side HMR, so co-locating
   them here is purely an organisational concern; same rationale as the
   sibling form-renderer.tsx file. */

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
import { FileInput, UserInput } from './form-field-elements-media'
import { RatingInput, RequiredMark, SectionHeading } from './form-field-elements-typed'
import { HelpText } from './form-help-text'
import type { ControlAttributeField } from '@/presentation/design/field-control-attributes'
import type { ReactElement } from 'react'

export interface ResolvedFormField {
  readonly name: string
  readonly inputElement: string
  readonly htmlInputType: string
  readonly label: string
  readonly placeholder: string
  readonly helpText: string
  /**
   * `helpText` after its `$t:` key resolves, rendered as inline markdown and
   * sanitized (`renderInlineMarkdown`); `''` when there is no help text.
   */
  readonly helpTextHtml?: string
  readonly required: boolean
  readonly hidden: boolean
  /**
   * True when the field's `visibleWhen` is false for the values the page is
   * served with: the wrapper is served `hidden` and its controls `disabled`,
   * so it is neither shown, validated nor sent until the rule turns true.
   */
  readonly conditionHidden?: boolean
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
  /** File-upload accept attribute (MIME types or extensions). */
  readonly accept?: string
  /** Maximum file size in bytes (per file). */
  readonly maxFileSize?: number
  /** Maximum number of files for `multiple-attachments` columns. */
  readonly maxFiles?: number
  /** Whether to render a drag-and-drop zone alongside the file picker. */
  readonly dropZone?: boolean
  /** Seconds a browser recording may last; present only when `recordAudio` is set. */
  readonly recordAudioMaxSeconds?: number
  /**
   * For `user`-typed columns (Bug 4 / [internal ref]): whether the picker
   * allows multiple selections. Surfaces as the `data-allow-multiple`
   * attribute on the picker root so the inline runtime can choose between
   * single- and multi-select widgets.
   */
  readonly allowMultiple?: boolean
  /**
   * The bound column's type and its typed configuration (`precision`,
   * `currency`, `symbolPosition`, `min`, `max`, `ratingStyle`), for a
   * table-bound field. It decides a number input's `step` / bounds / keypad and
   * the unit beside it, through the same `field-control-attributes` the page
   * `form` component reads — so one column is drawn alike on both.
   */
  readonly column?: ControlAttributeField
  /** For a `section` item: its heading level, `3` inside a multi-step form. */
  readonly sectionLevel?: 2 | 3
}

/**
 * Prefill value supported by inline-create form-ref expansion.
 *
 * Scalars and homogeneous arrays cover every case the foundation tier
 * needs (multi-select inherits as `string[]`, scalar columns as
 * `string`/`number`/`boolean`). Arrays of mixed types fall back to
 * scalars per element via `String(...)` at render time.
 */
export type PrefillValue = string | number | boolean | readonly string[] | readonly number[]

/**
 * Coerce a prefill value into the string representation an HTML
 * `<input value=...>` expects. Arrays are joined with commas because the
 * foundation tier renders multi-select as a single `<input>`; a richer
 * follow-up tier can map array prefills onto multiple `<option selected>`
 * entries inside a `<select multiple>` once the renderer supports them.
 */
export function prefillValueToString(value: PrefillValue): string {
  if (Array.isArray(value)) return value.join(',')
  return String(value)
}

const TextareaInput = ({
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
      name={field.name}
      required={field.required}
      {...ariaRequired(field.required)}
      disabled={field.conditionHidden}
      placeholder={field.placeholder || undefined}
      defaultValue={defaultValue ?? undefined}
    />
    <HelpText html={field.helpTextHtml} />
  </div>
)

/**
 * Single-select input.
 *
 * The leading `<option value="">` is not decoration — it is what lets a select
 * express "no answer". Without it the browser applies its own rule (no empty
 * option, therefore the first one is selected), so a field reads as answered
 * before the visitor has touched the page: someone who came for one option and
 * submitted without opening the dropdown is recorded as having chosen a
 * different one. That is silently WRONG data rather than missing data, and
 * `required` cannot catch it, because something is always selected.
 *
 * Three properties this relies on, all of them load-bearing:
 *
 * - It must LEAD the list and be a direct child of the `<select>`. HTML only
 *   treats an empty option as a "placeholder label option" under exactly those
 *   conditions, and only then does constraint validation report `valueMissing`
 *   on a required select. Move it, wrap it in an `<optgroup>`, or give it a
 *   non-empty value and `required` silently stops biting.
 * - It is rendered ALWAYS, not only when the field is unanswered. That keeps
 *   the rule one sentence long — "the empty option leads the list; it is
 *   selected only when nothing else resolves" — rather than a conditional the
 *   config author has to reason about. A visitor may return to a required
 *   field and blank it, and being stopped there is correct.
 * - `defaultValue` falls back to `''`, NOT `undefined`. `undefined` hands the
 *   choice back to the browser's first-option rule and reinstates the defect.
 *   A resolved prefill or literal default still wins outright, which is what
 *   keeps the prefill contract intact.
 *
 * The label is the field's own `placeholder` — already an AppSchema property
 * on every form field. A select is simply the one input type with nowhere to
 * put it, so it used to be dropped without a word.
 */
const SelectInput = ({
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
    <select
      id={`field-${field.name}`}
      name={field.name}
      required={field.required}
      {...ariaRequired(field.required)}
      disabled={field.conditionHidden}
      defaultValue={defaultValue ?? ''}
    >
      <option value="">{field.placeholder}</option>
      {(field.options ?? []).map((option) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
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
const RadioInput = ({
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
const SignatureInput = ({ field }: { readonly field: ResolvedFormField }) => (
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

const TextInput = ({
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
        name={field.name}
        required={field.required}
        {...ariaRequired(field.required)}
        {...typedAttributesOf(field)}
        disabled={field.conditionHidden}
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
 * Dispatch a non-hidden, non-locked field to the right input component
 * based on its `inputElement` discriminator. Pulled out of the
 * `FormFieldElement` body so the parent function stays under the
 * project's max-lines-per-function cap. The Prettier
 * `singleAttributePerLine` rule expands each `<XInput field={f} defaultValue={dv}/>`
 * across 4 lines, so 8 branches → 53 lines (3 over the function cap).
 * Splitting further would be more indirection than it's worth — this is the
 * leaf dispatcher.
 *
 * Bug 4 / [internal ref] added the `'user'` branch.
 */

/** A `section` item and a `rating` scale, the two items that are not a single input. */
function dispatchAnswerlessOrScale(field: ResolvedFormField, defaultValue: string | undefined) {
  if (field.inputElement === 'section') return <SectionHeading field={field} />
  if (field.inputElement === 'rating')
    return (
      <RatingInput
        field={field}
        defaultValue={defaultValue}
      />
    )
  return undefined
}

function dispatchFieldInput(field: ResolvedFormField, defaultValue: string | undefined) {
  const f = field
  const dv = defaultValue
  if (f.inputElement === 'textarea')
    return (
      <TextareaInput
        field={f}
        defaultValue={dv}
      />
    )
  if (f.inputElement === 'select')
    return (
      <SelectInput
        field={f}
        defaultValue={dv}
      />
    )
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
  if (lockPrefill && prefillValue !== undefined) {
    return (
      <LockedHiddenInput
        field={field}
        value={prefillValue}
      />
    )
  }
  const defaultValue = prefillValue !== undefined ? prefillValueToString(prefillValue) : undefined
  return dispatchFieldInput(field, defaultValue)
}
