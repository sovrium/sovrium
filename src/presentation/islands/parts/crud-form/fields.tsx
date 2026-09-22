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

/* eslint-disable react-perf/jsx-no-new-function-as-prop,
                  react-perf/jsx-no-new-array-as-prop --
   Field dispatcher: each per-type field component receives fresh `onChange`
   and option arrays per render because the parent form passes them via the
   field def. Lifting these out requires restructuring the form state model,
   covered by the future crud-form refactor. */

import { fieldDescribedBy, fieldDescriptionId } from '@/presentation/design/field-display'
import { fieldWidgetOf, type FieldWidget } from '@/presentation/design/field-type-behavior'
import {
  computeFormControlClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
  computeFormHelpTextClasses,
} from '@/presentation/design/form-layout-classes'
import { readsAsTrue } from '../../runtime/cell-value-semantics'
import { RecordButton } from '../../runtime/record-button'
import { CodeFieldBoundary } from './code-field-boundary'
import { type ConditionRule, type FieldDef, labelOf } from './field-def'
import { FileField } from './file-field'
import { RecordPickerField } from './record-picker-field'
import { RichTextFieldBoundary } from './rich-text-field-boundary'

// Re-exported so existing importers of `crud-form/fields` keep working.
export { type ConditionRule, type FieldDef, labelOf }

interface FieldInputProps {
  readonly name: string
  readonly value: string
  readonly onChange: (name: string, value: string) => void
}

/**
 * Native `<input type>` per plain-input widget. Keyed by widget rather than by
 * field type so it cannot drift from the SSR skeleton's equivalent map.
 */
const INPUT_TYPE_BY_WIDGET: Partial<Record<FieldWidget, string>> = {
  email: 'email',
  url: 'url',
}

// Shared design-system token classes for crud-form field chrome. Kept as
// module-level consts so every per-type field stays consistent and the file
// remains within the island max-lines cap.
// - `LABEL_CLASS`: stacked label + control with foreground text. Sourced from
//   the shared form-layout contract (`computeFormFieldClasses` for the stack,
//   `computeFormFieldLabelClasses` for the label's typography) so the hydrated
//   island matches the SSR `CrudFieldShell` exactly — no label→control spacing
//   jump on hydration. The VALUES are deliberately not restated here: they moved
//   with the drawings and a copy of them in prose goes stale silently, which is
//   what this comment did.
// - `CONTROL_CLASS`: the canonical input/select/textarea surface, from the
//   shared form-layout contract.
// - `CHECKBOX_LABEL_CLASS` / `CHECKBOX_CLASS`: inline checkbox row + accent.
const LABEL_CLASS = `${computeFormFieldClasses()} ${computeFormFieldLabelClasses()}`
const CONTROL_CLASS = computeFormControlClasses()
// 12px, like every other form label since the contract moved — a checkbox's
// label sits BESIDE its box rather than above it, but it is the same caption.
// `spec-fields.mjs`'s selection row draws it at 12px on a 36px line.
const CHECKBOX_LABEL_CLASS = 'text-foreground flex items-center gap-2 text-sm font-medium'
const CHECKBOX_CLASS = 'accent-primary h-4 w-4'
const HELP_TEXT_CLASS = `help-text ${computeFormHelpTextClasses()}`

/**
 * The field's persistent guidance, under its control and addressed by the
 * control's `aria-describedby`. Renders NOTHING when the field declares no
 * description — an empty node would be announced as a blank pause. Mirrors the
 * SSR `CrudFieldShell` so hydration does not move the text.
 */
function FieldHelpText({ field }: { readonly field: FieldDef }) {
  if (field.description === undefined) return undefined
  return (
    <small
      id={fieldDescriptionId(field.name)}
      className={HELP_TEXT_CLASS}
    >
      {field.description}
    </small>
  )
}

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
        {...fieldDescribedBy(field)}
      />
      <FieldHelpText field={field} />
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
        {...fieldDescribedBy(field)}
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
      <FieldHelpText field={field} />
    </label>
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
        {...fieldDescribedBy(field)}
      />
      <FieldHelpText field={field} />
    </label>
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
   * The record the form is bound to, when there is one. A create form has no
   * record yet, so an automation button renders disabled there — there is
   * nothing to run it against until the row exists.
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
  email: (args) => renderTypedInputField(args, INPUT_TYPE_BY_WIDGET.email ?? 'text'),
  url: (args) => renderTypedInputField(args, INPUT_TYPE_BY_WIDGET.url ?? 'text'),

  // ── Widgets the FORM has not been given a real control for yet ──────────
  //
  // These render as text boxes, which is exactly what they rendered before the
  // widget vocabulary named them — the form's behaviour is unchanged here. What
  // changed is that the gap is now VISIBLE: each line below is a control this
  // form owes its user, rather than a field type quietly resolving to `text`
  // three files away. The data-table's inline editor implements all five.
  //
  // `record-picker` LEFT this list under [internal ref]: a `relationship` column now
  // renders the same searchable picker on the form that it always did in the
  // grid, so the form no longer posts a typed label as a foreign key.
  //
  // `number` and `date` are deliberate divergences rather than gaps: the grid
  // gives them native typed inputs, and switching the form to match would
  // change how every existing numeric and date form field accepts input. That
  // is its own change with its own specs.
  number: (args) => renderTypedInputField(args, 'text'),
  date: (args) => renderTypedInputField(args, 'text'),
  datetime: (args) => renderTypedInputField(args, 'text'),
  'multi-select': (args) => renderTypedInputField(args, 'text'),
  'user-picker': (args) => renderTypedInputField(args, 'text'),
  rating: (args) => renderTypedInputField(args, 'text'),
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
