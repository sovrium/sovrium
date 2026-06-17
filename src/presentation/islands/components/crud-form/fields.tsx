/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import {
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '@/presentation/utils/design/form-layout-classes'
import { CodeEditorField } from '../code-editor-field'
import { RichTextEditorField } from '../rich-text-editor-field'
import { type ConditionRule, type FieldDef, labelOf } from './field-def'
import { FileField } from './file-field'

export { type ConditionRule, type FieldDef, labelOf }

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

const LABEL_CLASS = `${computeFormFieldClasses()} ${computeFormFieldLabelClasses()}`
const CONTROL_CLASS =
  'border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none'
const CHECKBOX_LABEL_CLASS = 'text-foreground flex items-center gap-2 text-sm font-medium'
const CHECKBOX_CLASS = 'accent-primary h-4 w-4'

function TextAreaField({
  field,
  value,
  onChange,
  invalid,
}: FieldInputProps & { readonly field: FieldDef; readonly invalid?: boolean }) {
  return (
    <label
      key={field.name}
      className={LABEL_CLASS}
    >
      {labelOf(field)}
      <textarea
        name={field.name}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        className={CONTROL_CLASS}
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
    <label
      key={field.name}
      className={LABEL_CLASS}
    >
      {labelOf(field)}
      <select
        name={field.name}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        className={CONTROL_CLASS}
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
    <label
      key={field.name}
      className={CHECKBOX_LABEL_CLASS}
    >
      <input
        type="checkbox"
        name={field.name}
        checked={value === 'true'}
        onChange={(e) => onChange(field.name, String(e.target.checked))}
        className={CHECKBOX_CLASS}
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
    <label
      key={field.name}
      className={LABEL_CLASS}
    >
      {labelOf(field)}
      <input
        type={inputType}
        name={field.name}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        className={CONTROL_CLASS}
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
        value={value}
        onChange={onChange}
      />
    )
  if (field.type === 'multiple-attachments')
    return (
      <FileField
        field={field}
        multiple={true}
        value={value}
        onChange={onChange}
      />
    )
  return renderSimpleField(field, value, onChange, invalid)
}
