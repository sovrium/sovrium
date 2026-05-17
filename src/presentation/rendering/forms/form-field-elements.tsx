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
export interface ResolvedFormField {
  readonly name: string
  readonly inputElement: string
  readonly htmlInputType: string
  readonly label: string
  readonly placeholder: string
  readonly helpText: string
  readonly required: boolean
  readonly hidden: boolean
  readonly options?: ReadonlyArray<{ readonly value: string; readonly label: string }>
  /** File-upload accept attribute (MIME types or extensions). */
  readonly accept?: string
  /** Maximum file size in bytes (per file). */
  readonly maxFileSize?: number
  /** Maximum number of files for `multiple-attachments` columns. */
  readonly maxFiles?: number
  /** Whether to render a drag-and-drop zone alongside the file picker. */
  readonly dropZone?: boolean
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
  <div className="form-field">
    <label htmlFor={`field-${field.name}`}>{field.label}</label>
    <textarea
      id={`field-${field.name}`}
      name={field.name}
      required={field.required}
      placeholder={field.placeholder || undefined}
      defaultValue={defaultValue ?? undefined}
    />
    {field.helpText && <small className="help-text">{field.helpText}</small>}
  </div>
)

const SelectInput = ({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}) => (
  <div className="form-field">
    <label htmlFor={`field-${field.name}`}>{field.label}</label>
    <select
      id={`field-${field.name}`}
      name={field.name}
      required={field.required}
      defaultValue={defaultValue ?? undefined}
    >
      {(field.options ?? []).map((option) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
    {field.helpText && <small className="help-text">{field.helpText}</small>}
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
    className="form-field form-field-radio"
    role="radiogroup"
    aria-labelledby={`field-${field.name}-legend`}
  >
    <div
      id={`field-${field.name}-legend`}
      className="form-field-legend"
    >
      {field.label}
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
            defaultChecked={defaultValue === option.value}
          />
          <label htmlFor={optionId}>{option.label}</label>
        </div>
      )
    })}
    {field.helpText && <small className="help-text">{field.helpText}</small>}
  </div>
)

const SignatureInput = ({ field }: { readonly field: ResolvedFormField }) => (
  <div
    className="form-field"
    data-island="signature"
    data-field-name={field.name}
  >
    <label htmlFor={`field-${field.name}`}>{field.label}</label>
    <canvas
      id={`field-${field.name}`}
      className="signature"
      data-name={field.name}
    />
    {field.helpText && <small className="help-text">{field.helpText}</small>}
  </div>
)

const TextInput = ({
  field,
  defaultValue,
}: {
  readonly field: ResolvedFormField
  readonly defaultValue: string | undefined
}) => (
  <div className="form-field">
    <label htmlFor={`field-${field.name}`}>{field.label}</label>
    <input
      id={`field-${field.name}`}
      type={field.htmlInputType}
      name={field.name}
      required={field.required}
      placeholder={field.placeholder || undefined}
      defaultValue={defaultValue ?? undefined}
    />
    {field.helpText && <small className="help-text">{field.helpText}</small>}
  </div>
)

/**
 * File-input component for `single-attachment` / `multiple-attachments`
 * columns and standalone `attachment` fields. Emits a vanilla `<input
 * type="file">` plus a host `<div>` for the file-chips list and (when
 * `dropZone: true`) a sibling drop-target. The inline runtime
 * (`form-runtime.tsx`) wires up multipart pre-upload, accept / maxFileSize
 * / maxFiles validation, thumbnail previews, and remove buttons against
 * these elements via stable `data-*` markers.
 *
 * Field-level required/disabled/help-text rendering matches the rest of
 * the form-field family for consistency.
 */
const FileInput = ({
  field,
  multiple,
}: {
  readonly field: ResolvedFormField
  readonly multiple: boolean
}) => (
  <div
    className="form-field form-field-file"
    data-field-name={field.name}
  >
    <label htmlFor={`field-${field.name}`}>{field.label}</label>
    {field.dropZone === true && (
      <div
        className="form-dropzone"
        data-testid={`dropzone-${field.name}`}
        data-form-dropzone={field.name}
      >
        <span>Drop files here or click to browse</span>
      </div>
    )}
    <input
      id={`field-${field.name}`}
      type="file"
      name={field.name}
      required={field.required}
      multiple={multiple}
      accept={field.accept || undefined}
      data-form-file-input={field.name}
      {...(field.maxFileSize !== undefined
        ? { 'data-max-file-size': String(field.maxFileSize) }
        : {})}
      {...(multiple && field.maxFiles !== undefined
        ? { 'data-max-files': String(field.maxFiles) }
        : {})}
    />
    <div
      className="form-file-chips"
      data-form-file-chips={field.name}
    />
    {field.helpText && <small className="help-text">{field.helpText}</small>}
  </div>
)

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
 * project's max-lines-per-function cap.
 */
function dispatchFieldInput(field: ResolvedFormField, defaultValue: string | undefined) {
  if (field.inputElement === 'textarea')
    return (
      <TextareaInput
        field={field}
        defaultValue={defaultValue}
      />
    )
  if (field.inputElement === 'select')
    return (
      <SelectInput
        field={field}
        defaultValue={defaultValue}
      />
    )
  if (field.inputElement === 'radio')
    return (
      <RadioInput
        field={field}
        defaultValue={defaultValue}
      />
    )
  if (field.inputElement === 'signature') return <SignatureInput field={field} />
  if (field.inputElement === 'file')
    return (
      <FileInput
        field={field}
        multiple={false}
      />
    )
  if (field.inputElement === 'file-multi')
    return (
      <FileInput
        field={field}
        multiple={true}
      />
    )
  return (
    <TextInput
      field={field}
      defaultValue={defaultValue}
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
    // Server-side defaults are applied at submission time; nothing to render.
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
