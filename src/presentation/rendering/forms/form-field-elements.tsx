/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
  readonly accept?: string
  readonly maxFileSize?: number
  readonly maxFiles?: number
  readonly dropZone?: boolean
}

export type PrefillValue = string | number | boolean | readonly string[] | readonly number[]

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
