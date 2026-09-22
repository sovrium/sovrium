/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeFormFieldErrorClasses } from '@/presentation/design/form-layout-classes'
import { evaluateCondition, isFieldVisible } from './conditions'
import { type FieldDef, labelOf, renderField } from './fields'

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

function renderVisibleField(field: FieldDef, props: RenderProps, invalidSet: Set<string>) {
  const effectiveField = applyConditionalFlags(field, props.values)
  return (
    <React.Fragment key={field.name}>
      <div>
        {renderField({
          field: effectiveField,
          value: props.values[field.name] ?? '',
          onChange: props.onChange,
          invalid: invalidSet.has(field.name),
          ...(props.binding === undefined ? {} : { binding: props.binding }),
        })}
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
  const renderProps: RenderProps = { values, onChange, fieldError, binding }

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
  readonly variant?: string
  readonly fieldGroups?: readonly FieldGroup[]
  readonly layout?: string
  /** Forwarded to the fields so a `button` field can address its own record. */
  readonly binding?: { readonly table?: string; readonly recordId?: string }
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
        {state.isPending ? 'Saving...' : submitLabel}
      </button>
    </>
  )
}
