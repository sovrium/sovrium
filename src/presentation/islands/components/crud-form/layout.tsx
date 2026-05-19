/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React from 'react'
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

function renderVisibleField(field: FieldDef, props: RenderProps, invalidSet: Set<string>) {
  const isDisabled = !!(
    field.disabled ||
    (field.disabledWhen && evaluateCondition(field.disabledWhen, props.values))
  )
  const isRequired = !!(
    field.required ||
    (field.requiredWhen && evaluateCondition(field.requiredWhen, props.values))
  )
  const effectiveField: FieldDef =
    isDisabled !== !!field.disabled || isRequired !== !!field.required
      ? { ...field, disabled: isDisabled, required: isRequired }
      : field
  return (
    <React.Fragment key={field.name}>
      <div>
        {renderField(
          effectiveField,
          props.values[field.name] ?? '',
          props.onChange,
          invalidSet.has(field.name)
        )}
      </div>
      {props.fieldError?.field === field.name && (
        <span
          role="alert"
          data-error={field.name}
        >
          {props.fieldError.message}
        </span>
      )}
    </React.Fragment>
  )
}

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
  const { fields, values, onChange, fieldError, invalidFields, fieldGroups, layout } = props
  const invalidSet = new Set(invalidFields ?? [])
  const renderProps: RenderProps = { values, onChange, fieldError }

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
}

function ErrorSummary(props: {
  readonly fields: readonly FieldDef[]
  readonly fieldError: { readonly field: string; readonly message: string }
}) {
  const { fields, fieldError } = props
  const matchedField = fields.find((f) => f.name === fieldError.field) ?? {
    name: fieldError.field,
    type: 'text',
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
        disabled={state.isPending}
        {...(variant && { 'data-variant': variant })}
      >
        {state.isPending ? 'Saving...' : submitLabel}
      </button>
    </>
  )
}
