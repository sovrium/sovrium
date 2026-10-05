/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import { computeFormFieldErrorClasses } from '@/presentation/design/form-layout-classes'
import { evaluateCondition, isFieldVisible } from './conditions'
import { type FieldDef, labelOf, renderField } from './fields'
import { clearMarkOf, isMarkedCleared } from './wire-values'

export interface FieldGroup {
  readonly label: string
  readonly fields: readonly string[]
}

export interface FormFieldsState {
  readonly fieldError?: { readonly field: string; readonly message: string }
  readonly invalidFields?: readonly string[]
}

export interface FormBodyState extends FormFieldsState {
  readonly error?: string
  readonly isPending: boolean
}

interface RenderProps {
  readonly values: Record<string, string>
  readonly onChange: (name: string, value: string) => void
  readonly fieldError?: { readonly field: string; readonly message: string }
  /**
   * The record this form edits, when it edits one. Only a `button` field reads
   * it — an automation button needs a row to run against, and a create form
   * has none yet.
   */
  readonly binding?: { readonly table?: string; readonly recordId?: string }
  /** The form's interface strings in the page language, keyed by catalogue key; English when absent. */
  readonly uiStrings?: Readonly<Record<string, string>> | undefined
}

function renderHiddenField(field: FieldDef, values: Record<string, string>): React.ReactElement {
  return (
    <input
      key={field.name}
      type="hidden"
      name={field.name}
      value={values[field.name] ?? ''}
      readOnly
    />
  )
}

/**
 * Recompute a field's disabled / required flags from its conditional rules,
 * returning the original object when neither moved so the render stays
 * referentially stable.
 */
function applyConditionalFlags(field: FieldDef, values: Record<string, string>): FieldDef {
  const isDisabled = !!(
    field.disabled ||
    (field.disabledWhen && evaluateCondition(field.disabledWhen, values))
  )
  const isRequired = !!(
    field.required ||
    (field.requiredWhen && evaluateCondition(field.requiredWhen, values))
  )
  return isDisabled !== !!field.disabled || isRequired !== !!field.required
    ? { ...field, disabled: isDisabled, required: isRequired }
    : field
}

/** The widgets whose empty control means "untouched", so clearing needs its own gesture. */
const CLEARABLE_WIDGETS: ReadonlySet<string> = new Set([
  'date',
  'datetime',
  'number',
  'select',
  'record-picker',
])

/**
 * Whether a field offers its Clear control: on a form editing a record, for an
 * optional, editable date, number, choice or relationship that holds a value.
 */
function offersClear(field: FieldDef, value: string, props: RenderProps): boolean {
  if (props.binding?.recordId === undefined) return false
  if (field.required || field.readOnly || field.disabled) return false
  return CLEARABLE_WIDGETS.has(fieldWidgetOf(field.type)) && value.trim() !== ''
}

/**
 * The Clear control: empties the field and marks it cleared, so the save
 * stores it empty (`<field>__clear` posted natively, `null` from a script).
 */
function ClearControl(props: {
  readonly field: FieldDef
  readonly onChange: RenderProps['onChange']
  readonly uiStrings: RenderProps['uiStrings']
}) {
  const { field, onChange, uiStrings } = props
  const onClick = React.useCallback(() => {
    onChange(field.name, '')
    onChange(clearMarkOf(field.name), '1')
  }, [field.name, onChange])
  return (
    <button
      type="button"
      aria-label={(uiStrings?.['form.clearNamed'] ?? 'Clear {label}')
        .split('{label}')
        .join(labelOf(field))}
      onClick={onClick}
      className="text-foreground-muted hover:text-foreground mt-1 text-xs underline"
    >
      {uiStrings?.['form.clear'] ?? 'Clear'}
    </button>
  )
}

function renderVisibleField(field: FieldDef, props: RenderProps, invalidSet: Set<string>) {
  const effectiveField = applyConditionalFlags(field, props.values)
  const value = props.values[field.name] ?? ''
  return (
    <React.Fragment key={field.name}>
      <div>
        {renderField({
          field: effectiveField,
          value,
          onChange: props.onChange,
          invalid: invalidSet.has(field.name),
          ...(props.binding === undefined ? {} : { binding: props.binding }),
        })}
        {offersClear(effectiveField, value, props) && (
          <ClearControl
            field={effectiveField}
            onChange={props.onChange}
            uiStrings={props.uiStrings}
          />
        )}
        {isMarkedCleared(props.values, field.name) && (
          <input
            type="hidden"
            name={clearMarkOf(field.name)}
            value="1"
          />
        )}
      </div>
      {props.fieldError?.field === field.name && (
        // Same recipe as every other field message in the system
        // (`form-layout-classes.ts`): the error tone at caption size, so the
        // message pairs with the invalid control's border instead of
        // inheriting the body's foreground at the body size.
        <span
          role="alert"
          className={computeFormFieldErrorClasses()}
          data-error={field.name}
        >
          {props.fieldError.message}
        </span>
      )}
    </React.Fragment>
  )
}

/**
 * Render a single field in a form (hidden, conditionally hidden, or visible).
 * Returns `undefined` (not rendered) when the field is hidden by `visibleWhen`.
 */
function renderOneField(
  field: FieldDef | undefined,
  props: RenderProps,
  invalidSet: Set<string>
): React.ReactElement | undefined {
  if (!field) return
  if (field.hidden) return renderHiddenField(field, props.values)
  if (!isFieldVisible(field, props.values)) return
  return renderVisibleField(field, props, invalidSet)
}

interface FormFieldsProps extends FormFieldsState, RenderProps {
  readonly fields: readonly FieldDef[]
  readonly fieldGroups?: readonly FieldGroup[]
  readonly layout?: string
}

function GroupedFields(props: {
  readonly fields: readonly FieldDef[]
  readonly fieldGroups: readonly FieldGroup[]
  readonly layout?: string
  readonly renderProps: RenderProps
  readonly invalidSet: Set<string>
}) {
  const { fields, fieldGroups, layout, renderProps, invalidSet } = props
  const fieldMap = new Map(fields.map((f) => [f.name, f]))
  const groupedFieldNames = new Set(fieldGroups.flatMap((g) => g.fields))
  const ungroupedFields = fields.filter((f) => !groupedFieldNames.has(f.name))
  const isTwoColumn = layout === 'two-column'
  const groupGridStyle = isTwoColumn
    ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }
    : undefined

  return (
    <>
      {fieldGroups.map((group) => (
        <div
          key={group.label}
          data-field-group
        >
          <div data-field-group-label>{group.label}</div>
          <div style={groupGridStyle}>
            {group.fields.map((fieldName) =>
              renderOneField(fieldMap.get(fieldName), renderProps, invalidSet)
            )}
          </div>
        </div>
      ))}
      {ungroupedFields.map((field) => renderOneField(field, renderProps, invalidSet))}
    </>
  )
}

export function FormFields(props: FormFieldsProps) {
  const { fields, values, onChange, fieldError, invalidFields, fieldGroups, layout, binding } =
    props
  const invalidSet = new Set(invalidFields ?? [])
  const renderProps: RenderProps = {
    values,
    onChange,
    fieldError,
    binding,
    uiStrings: props.uiStrings,
  }

  if (fieldGroups && fieldGroups.length > 0) {
    return (
      <GroupedFields
        fields={fields}
        fieldGroups={fieldGroups}
        layout={layout}
        renderProps={renderProps}
        invalidSet={invalidSet}
      />
    )
  }

  if (layout === 'two-column') {
    return (
      <div className="grid grid-cols-2 gap-4">
        {fields.map((field) => renderOneField(field, renderProps, invalidSet))}
      </div>
    )
  }

  return <>{fields.map((field) => renderOneField(field, renderProps, invalidSet))}</>
}

interface FormBodyProps {
  readonly fields: readonly FieldDef[]
  readonly values: Record<string, string>
  readonly state: FormBodyState
  readonly onFieldChange: (name: string, value: string) => void
  readonly redirectUrl?: string
  readonly useNativeForm: boolean
  readonly submitLabel: string
  /** The submit button's caption while a save is in flight; English when absent. */
  readonly savingLabel?: string
  readonly variant?: string
  readonly fieldGroups?: readonly FieldGroup[]
  readonly layout?: string
  /** Forwarded to the fields so a `button` field can address its own record. */
  readonly binding?: { readonly table?: string; readonly recordId?: string }
  /** Forwarded to the fields — see `RenderProps.uiStrings`. */
  readonly uiStrings?: Readonly<Record<string, string>> | undefined
}

function ErrorSummary(props: {
  readonly fields: readonly FieldDef[]
  readonly fieldError: { readonly field: string; readonly message: string }
}) {
  const { fields, fieldError } = props
  // Fallback for an error naming a field that is not in the rendered set: only
  // `labelOf` reads it, so the type is a placeholder — `'text'` was not a real
  // field type and is now rejected by the narrowed `FieldDef['type']`.
  const matchedField: FieldDef = fields.find((f) => f.name === fieldError.field) ?? {
    name: fieldError.field,
    type: 'single-line-text',
  }
  return (
    <div
      data-error-summary
      role="alert"
    >
      {labelOf(matchedField)}: {fieldError.message}
    </div>
  )
}

export function FormBody(props: FormBodyProps) {
  const {
    fields,
    values,
    state,
    onFieldChange,
    redirectUrl,
    useNativeForm,
    submitLabel,
    savingLabel,
    variant,
    fieldGroups,
    layout,
    binding,
  } = props
  return (
    <>
      {state.fieldError && (
        <ErrorSummary
          fields={fields}
          fieldError={state.fieldError}
        />
      )}
      <FormFields
        fields={fields}
        values={values}
        onChange={onFieldChange}
        fieldError={state.fieldError}
        invalidFields={state.invalidFields}
        fieldGroups={fieldGroups}
        layout={layout}
        {...(binding === undefined ? {} : { binding })}
        uiStrings={props.uiStrings}
      />
      {redirectUrl && useNativeForm && (
        <input
          type="hidden"
          name="_redirect"
          value={redirectUrl}
        />
      )}
      {state.error && <div role="alert">{state.error}</div>}
      <button
        type="submit"
        data-crud-submit=""
        className={computeButtonDefaultClasses()}
        disabled={state.isPending}
        {...(variant && { 'data-variant': variant })}
      >
        {state.isPending ? (savingLabel ?? 'Saving...') : submitLabel}
      </button>
    </>
  )
}
