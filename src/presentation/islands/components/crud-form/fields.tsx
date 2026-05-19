/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { useState } from 'react'
import { humanizeFieldName } from '@/presentation/utils/string-utils'
import { CodeEditorField } from '../code-editor-field'
import { RichTextEditorField } from '../rich-text-editor-field'

export type ConditionRule =
  | {
      readonly field: string
      readonly operator: string
      readonly value?: string | number | boolean
    }
  | { readonly or: readonly ConditionRule[] }
  | { readonly and: readonly ConditionRule[] }

export interface FieldDef {
  readonly name: string
  readonly type: string
  readonly required?: boolean
  readonly options?: readonly string[]
  readonly language?: string
  readonly lineNumbers?: boolean
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly tabSize?: number
  readonly minLines?: number
  readonly maxLines?: number
  readonly toolbar?: readonly string[]
  readonly placeholder?: string
  readonly maxLength?: number
  readonly displayLabel?: string
  readonly defaultValue?: string | number | boolean
  readonly hidden?: boolean
  readonly visibleWhen?: ConditionRule
  readonly requiredWhen?: ConditionRule
  readonly disabledWhen?: ConditionRule
  readonly imageBucket?: string
  readonly accept?: string
  readonly dropZone?: boolean
  readonly maxFiles?: number
  readonly maxFileSize?: number
  readonly allowedFileTypes?: readonly string[]
}

interface FieldInputProps {
  readonly name: string
  readonly value: string
  readonly onChange: (name: string, value: string) => void
}

const INPUT_TYPE_MAP: Record<string, string> = {
  number: 'number',
  email: 'email',
  url: 'url',
}

export function labelOf(field: FieldDef): string {
  return field.displayLabel ?? humanizeFieldName(field.name)
}

function TextAreaField({
  field,
  value,
  onChange,
  invalid,
}: FieldInputProps & { readonly field: FieldDef; readonly invalid?: boolean }) {
  return (
    <label key={field.name}>
      {labelOf(field)}
      <textarea
        name={field.name}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        {...(field.placeholder && { placeholder: field.placeholder })}
        {...(field.readOnly && { readOnly: true })}
        {...(field.disabled && { disabled: true })}
        {...(field.required && { required: true })}
        {...(invalid && { 'aria-invalid': 'true' })}
      />
    </label>
  )
}

function SelectField({
  field,
  value,
  onChange,
  options,
  invalid,
}: FieldInputProps & {
  readonly field: FieldDef
  readonly options: readonly string[]
  readonly invalid?: boolean
}) {
  return (
    <label key={field.name}>
      {labelOf(field)}
      <select
        name={field.name}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        {...(field.disabled && { disabled: true })}
        {...(field.required && { required: true })}
        {...(invalid && { 'aria-invalid': 'true' })}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option
            key={opt}
            value={opt}
          >
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

function CheckboxField({ field, value, onChange }: FieldInputProps & { readonly field: FieldDef }) {
  return (
    <label key={field.name}>
      <input
        type="checkbox"
        name={field.name}
        checked={value === 'true'}
        onChange={(e) => onChange(field.name, String(e.target.checked))}
        {...(field.disabled && { disabled: true })}
      />
      {labelOf(field)}
    </label>
  )
}

function TypedInputField({
  field,
  value,
  onChange,
  inputType,
  invalid,
}: FieldInputProps & {
  readonly field: FieldDef
  readonly inputType: string
  readonly invalid?: boolean
}) {
  return (
    <label key={field.name}>
      {labelOf(field)}
      <input
        type={inputType}
        name={field.name}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        {...(field.required && { required: true, 'data-required': 'true' })}
        {...(field.placeholder && { placeholder: field.placeholder })}
        {...(field.readOnly && { readOnly: true })}
        {...(field.disabled && { disabled: true })}
        {...(invalid && { 'aria-invalid': 'true' })}
      />
    </label>
  )
}

function renderCodeField(field: FieldDef, value: string, onChange: FieldInputProps['onChange']) {
  return (
    <CodeEditorField
      name={field.name}
      value={value}
      onChange={onChange}
      language={field.language}
      lineNumbers={field.lineNumbers}
      readOnly={field.readOnly}
      tabSize={field.tabSize}
      minLines={field.minLines}
      maxLines={field.maxLines}
    />
  )
}

function renderRichTextField(
  field: FieldDef,
  value: string,
  onChange: FieldInputProps['onChange']
) {
  return (
    <RichTextEditorField
      name={field.name}
      value={value}
      onChange={onChange}
      toolbar={field.toolbar}
      placeholder={field.placeholder}
      maxLength={field.maxLength}
      displayLabel={labelOf(field)}
      imageBucket={field.imageBucket}
    />
  )
}

function validateFileSelection(files: File[], field: FieldDef): string | undefined {
  if (field.allowedFileTypes !== undefined && field.allowedFileTypes.length > 0) {
    const rejected = files.find((f) => !field.allowedFileTypes!.includes(f.type))
    if (rejected) return `File type not allowed. Please upload a valid file.`
  }
  if (field.maxFileSize !== undefined && field.maxFileSize > 0) {
    const oversize = files.find((f) => f.size > field.maxFileSize!)
    if (oversize)
      return `File size exceeds maximum of ${Math.round(field.maxFileSize / (1024 * 1024))} MB`
  }
  return undefined
}

function FileField({ field, multiple }: { readonly field: FieldDef; readonly multiple: boolean }) {
  const [fileError, setFileError] = useState<string | undefined>(undefined)
  const [inputKey, setInputKey] = useState(0)
  const [hasValidFile, setHasValidFile] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const error = validateFileSelection(files, field)
    if (error !== undefined) {
      setFileError(error)
      setInputKey((k) => k + 1)
      setHasValidFile(false)
      return
    }
    setFileError(undefined)
    setHasValidFile(files.length > 0)
  }

  const fileInput = (
    <input
      key={inputKey}
      id={`file-${field.name}`}
      type="file"
      name={field.name}
      multiple={multiple}
      onChange={handleChange}
      {...(field.required && { required: true })}
      {...(field.disabled && { disabled: true })}
      {...(field.accept !== undefined && { accept: field.accept })}
    />
  )

  return (
    <div key={field.name}>
      <label htmlFor={`file-${field.name}`}>{labelOf(field)}</label>
      {field.dropZone === true ? (
        <div data-dropzone="true">
          <span>Drag and drop or browse to choose a file</span>
          {fileInput}
        </div>
      ) : (
        fileInput
      )}
      {fileError !== undefined && <span role="alert">{fileError}</span>}
      {hasValidFile && (
        <div
          role="progressbar"
          data-testid="upload-progress"
          aria-valuenow={100}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      )}
    </div>
  )
}

function renderSimpleField(
  field: FieldDef,
  value: string,
  onChange: FieldInputProps['onChange'],
  invalid: boolean
) {
  if (field.type === 'long-text') {
    return (
      <TextAreaField
        field={field}
        name={field.name}
        value={value}
        onChange={onChange}
        invalid={invalid}
      />
    )
  }
  if (field.type === 'single-select') {
    return (
      <SelectField
        field={field}
        name={field.name}
        value={value}
        onChange={onChange}
        options={field.options ?? []}
        invalid={invalid}
      />
    )
  }
  if (field.type === 'checkbox') {
    return (
      <CheckboxField
        field={field}
        name={field.name}
        value={value}
        onChange={onChange}
      />
    )
  }
  const inputType = INPUT_TYPE_MAP[field.type] ?? 'text'
  return (
    <TypedInputField
      field={field}
      name={field.name}
      value={value}
      onChange={onChange}
      inputType={inputType}
      invalid={invalid}
    />
  )
}

export function renderField(
  field: FieldDef,
  value: string,
  onChange: (name: string, value: string) => void,
  invalid: boolean
) {
  if (field.type === 'code') return renderCodeField(field, value, onChange)
  if (field.type === 'rich-text') return renderRichTextField(field, value, onChange)
  if (field.type === 'single-attachment')
    return (
      <FileField
        field={field}
        multiple={false}
      />
    )
  if (field.type === 'multiple-attachments')
    return (
      <FileField
        field={field}
        multiple={true}
      />
    )
  return renderSimpleField(field, value, onChange, invalid)
}
