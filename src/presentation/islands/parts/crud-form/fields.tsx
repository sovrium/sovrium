/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-refresh/only-export-components -- This module pairs the
   FieldDef type and renderField dispatcher (non-component utilities) with the
   per-type field components they delegate to. Splitting them across multiple
   files produces awkward circular helpers without an HMR benefit, since the
   field components are not used as JSX leaves anywhere else. */

/* eslint-disable react-perf/jsx-no-new-array-as-prop --
   Field dispatcher: each per-type field component receives fresh `onChange`
   and option arrays per render because the parent form passes them via the
   field def. Lifting these out requires restructuring the form state model,
   covered by the future crud-form refactor. */

import { nativeInputTypeOf } from '@/presentation/design/field-control-attributes'
import { fieldDescribedBy } from '@/presentation/design/field-display'
import { fieldWidgetOf, type FieldWidget } from '@/presentation/design/field-type-behavior'
import { readsAsTrue } from '../../runtime/cell-value-semantics'
import { RecordButton } from '../../runtime/record-button'
import { CodeFieldBoundary } from './code-field-boundary'
import { CONTROL_CLASS } from './field-chrome-classes'
import { type FieldDef, labelOf } from './field-def'
import { FieldHelpText } from './field-help-text'
import { LabelledControl } from './field-label'
import { FileField } from './file-field'
import { RecordPickerField } from './record-picker-field'
import { RichTextFieldBoundary } from './rich-text-field-boundary'
import {
  DateField,
  DateTimeField,
  MultiSelectField,
  NumberField,
  RatingField,
  UserPickerField,
} from './typed-fields'

// Re-exported so existing importers of `crud-form/fields` keep working.
export { type FieldDef, labelOf }

interface FieldInputProps {
  readonly name: string
  readonly value: string
  readonly onChange: (name: string, value: string) => void
}

// Chrome shared with the typed controls lives in `field-chrome-classes` and
// `field-help-text`.
// - `CHECKBOX_LABEL_CLASS` / `CHECKBOX_CLASS`: inline checkbox row + accent,
//   12px like every other form label — a checkbox's label sits BESIDE its box
//   rather than above it, but it is the same caption.
const CHECKBOX_LABEL_CLASS = 'text-foreground flex items-center gap-2 text-sm font-medium'
const CHECKBOX_CLASS = 'accent-primary h-4 w-4'

function TextAreaField({
  field,
  value,
  onChange,
  invalid,
}: FieldInputProps & { readonly field: FieldDef; readonly invalid?: boolean }) {
  return (
    <LabelledControl
      key={field.name}
      label={labelOf(field)}
      help={<FieldHelpText field={field} />}
      control={(id) => (
        <textarea
          id={id}
          name={field.name}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={CONTROL_CLASS}
          {...(field.placeholder && { placeholder: field.placeholder })}
          {...(field.readOnly && { readOnly: true })}
          {...(field.disabled && { disabled: true })}
          {...(field.required && { required: true })}
          {...(invalid && { 'aria-invalid': 'true' })}
          {...fieldDescribedBy(field)}
        />
      )}
    />
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
  readonly options: NonNullable<FieldDef['options']>
  readonly invalid?: boolean
}) {
  return (
    <LabelledControl
      key={field.name}
      label={labelOf(field)}
      help={<FieldHelpText field={field} />}
      control={(id) => (
        <select
          id={id}
          name={field.name}
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          className={CONTROL_CLASS}
          {...(field.disabled && { disabled: true })}
          {...(field.required && { required: true })}
          {...(invalid && { 'aria-invalid': 'true' })}
          {...fieldDescribedBy(field)}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
            >
              {opt.label}
            </option>
          ))}
        </select>
      )}
    />
  )
}

/**
 * The form's checkbox control.
 *
 * `checked` is decided by the SHARED {@link readsAsTrue}, not by a local
 * comparison. This control used to test `value === 'true'` — a third, stricter
 * copy of a decoding the grid already owned twice. `buildInitialValues` seeds
 * the form by `String()`-ing the stored column, and SQLite has no boolean type:
 * every ticked checkbox comes back as `1`, which `=== 'true'` reads as FALSE. So
 * on the zero-config default engine every CRUD form rendered ticked rows
 * unticked, while the grid beside it rendered them ticked — and saving the form
 * then wrote that phantom untick back.
 */
function CheckboxField({ field, value, onChange }: FieldInputProps & { readonly field: FieldDef }) {
  return (
    <label
      key={field.name}
      className={CHECKBOX_LABEL_CLASS}
    >
      <input
        type="checkbox"
        name={field.name}
        checked={readsAsTrue(value)}
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
    <LabelledControl
      key={field.name}
      label={labelOf(field)}
      help={<FieldHelpText field={field} />}
      control={(id) => (
        <input
          id={id}
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
          {...fieldDescribedBy(field)}
        />
      )}
    />
  )
}

function renderCodeField(field: FieldDef, value: string, onChange: FieldInputProps['onChange']) {
  return (
    <CodeFieldBoundary
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
    <RichTextFieldBoundary
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

/** Everything a per-widget renderer needs, bundled so each stays single-argument. */
interface FieldRenderArgs {
  readonly field: FieldDef
  readonly value: string
  readonly onChange: FieldInputProps['onChange']
  readonly invalid: boolean
  /**
   * The record the form is bound to, when there is one. Without one an
   * automation button renders disabled — there is nothing to run it against.
   */
  readonly binding?: { readonly table?: string; readonly recordId?: string }
}

function renderTypedInputField(args: FieldRenderArgs, inputType: string) {
  const { field, value, onChange, invalid } = args
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

/**
 * TOTAL widget → control table for the hydrated form.
 *
 * `Record<FieldWidget, …>` is the exhaustiveness guard: a newly added widget
 * fails to compile here instead of silently degrading to a free-text box —
 * which is exactly how a `status` field ended up posting an empty string that
 * its CHECK constraint rejected.
 */
const WIDGET_RENDERERS: Record<FieldWidget, (args: FieldRenderArgs) => React.ReactNode> = {
  button: ({ field, binding }) =>
    field.button ? (
      <RecordButton
        config={field.button}
        fieldName={field.name}
        {...(binding?.table === undefined ? {} : { table: binding.table })}
        {...(binding?.recordId === undefined ? {} : { recordId: binding.recordId })}
      />
    ) : undefined,
  code: ({ field, value, onChange }) => renderCodeField(field, value, onChange),
  'rich-text': ({ field, value, onChange }) => renderRichTextField(field, value, onChange),
  'file-single': ({ field, value, onChange }) => (
    <FileField
      field={field}
      multiple={false}
      value={value}
      onChange={onChange}
    />
  ),
  'file-multiple': ({ field, value, onChange }) => (
    <FileField
      field={field}
      multiple={true}
      value={value}
      onChange={onChange}
    />
  ),
  textarea: ({ field, value, onChange, invalid }) => (
    <TextAreaField
      field={field}
      name={field.name}
      value={value}
      onChange={onChange}
      invalid={invalid}
    />
  ),
  'record-picker': ({ field, value, onChange, invalid }) => (
    <RecordPickerField
      field={field}
      value={value}
      onChange={onChange}
      invalid={invalid}
    />
  ),
  select: ({ field, value, onChange, invalid }) => (
    <SelectField
      field={field}
      name={field.name}
      value={value}
      onChange={onChange}
      options={field.options ?? []}
      invalid={invalid}
    />
  ),
  checkbox: ({ field, value, onChange }) => (
    <CheckboxField
      field={field}
      name={field.name}
      value={value}
      onChange={onChange}
    />
  ),
  text: (args) => renderTypedInputField(args, 'text'),
  email: (args) => renderTypedInputField(args, nativeInputTypeOf(args.field.type)),
  url: (args) => renderTypedInputField(args, nativeInputTypeOf(args.field.type)),
  // A typed column renders the control the data table edits it with, and the
  // form sends the column's own kind of value (see `wire-values`). A text box
  // here LOOKED editable and then posted a string — or an empty string — into
  // a numeric, temporal or foreign-key column.
  number: (args) => <NumberField {...args} />,
  date: (args) => <DateField {...args} />,
  datetime: (args) => <DateTimeField {...args} />,
  rating: (args) => <RatingField {...args} />,
  'multi-select': (args) => <MultiSelectField {...args} />,
  'user-picker': (args) => <UserPickerField {...args} />,
}

/**
 * Render a single CRUD-form field input as a controlled React element.
 *
 * Dispatches on the field type's WIDGET (see
 * `@/presentation/utils/field-type-behavior`) rather than on the raw type, so
 * the hydrated control and the SSR skeleton cannot disagree per field type.
 */
export function renderField(args: FieldRenderArgs) {
  return WIDGET_RENDERERS[fieldWidgetOf(args.field.type)](args)
}
