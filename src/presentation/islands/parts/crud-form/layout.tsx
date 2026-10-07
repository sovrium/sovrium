/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React from 'react'
import {
  type FormSectionLayout,
  groupFieldsIntoSections,
} from '@/domain/models/app/pages/components/component-types/data/form/sections-service'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { fieldWidgetOf } from '@/presentation/design/field-type-behavior'
import {
  computeFormFieldErrorClasses,
  computeFormGroupClasses,
  computeFormGroupLabelClasses,
  computeFormHelpTextClasses,
} from '@/presentation/design/form-layout-classes'
import { type FieldDef, labelOf, renderField } from './fields'
import { FormRegions } from './main-aside'
import { formAsideOf, type FormAsideLayout } from './main-aside-regions'
import { SaveBar, type SaveBarState } from './save-bar'
import { clearMarkOf, isMarkedCleared } from './wire-values'

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
   * it — an automation button needs a row to run against.
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
  const value = props.values[field.name] ?? ''
  return (
    <React.Fragment key={field.name}>
      <div>
        {renderField({
          field,
          value,
          onChange: props.onChange,
          invalid: invalidSet.has(field.name),
          ...(props.binding === undefined ? {} : { binding: props.binding }),
        })}
        {offersClear(field, value, props) && (
          <ClearControl
            field={field}
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

/** Render a single field in a form: a hidden input, or its visible control. */
function renderOneField(
  field: FieldDef | undefined,
  props: RenderProps,
  invalidSet: Set<string>
): React.ReactElement | undefined {
  if (!field) return
  if (field.hidden) return renderHiddenField(field, props.values)
  return renderVisibleField(field, props, invalidSet)
}

interface FormFieldsProps extends FormFieldsState, RenderProps {
  readonly fields: readonly FieldDef[]
  readonly layout?: string
  /** Titled groups of fields — layout only; a field in no section follows the last one. */
  readonly sections?: readonly FormSectionLayout[]
}

function renderFieldRun(
  fields: readonly FieldDef[],
  layout: string | undefined,
  renderProps: RenderProps,
  invalidSet: Set<string>
): React.ReactNode {
  const drawn = fields.map((field) => renderOneField(field, renderProps, invalidSet))
  return layout === 'two-column' ? <div className="grid grid-cols-2 gap-4">{drawn}</div> : drawn
}

export function FormFields(props: FormFieldsProps) {
  const { fields, values, onChange, fieldError, invalidFields, layout, binding } = props
  const invalidSet = new Set(invalidFields ?? [])
  const renderProps: RenderProps = {
    values,
    onChange,
    fieldError,
    binding,
    uiStrings: props.uiStrings,
  }
  const grouped = groupFieldsIntoSections(fields, props.sections)

  return (
    <>
      {grouped.sections.map((section) => (
        <fieldset
          key={section.title}
          className={computeFormGroupClasses()}
        >
          {/* The title is the group's name AND a heading, so a reader can jump to it. */}
          <legend>
            <h2 className={computeFormGroupLabelClasses()}>{section.title}</h2>
          </legend>
          {section.description !== undefined && (
            <p className={computeFormHelpTextClasses()}>{section.description}</p>
          )}
          {renderFieldRun(section.fields, layout, renderProps, invalidSet)}
        </fieldset>
      ))}
      {renderFieldRun(grouped.rest, layout, renderProps, invalidSet)}
    </>
  )
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
  readonly layout?: string
  /** Forwarded to the fields so a `button` field can address its own record. */
  readonly binding?: { readonly table?: string; readonly recordId?: string }
  /** Forwarded to the fields — see `RenderProps.uiStrings`. */
  readonly uiStrings?: Readonly<Record<string, string>> | undefined
  /** Forwarded to the fields — see `FormFieldsProps.sections`. */
  readonly sections?: readonly FormSectionLayout[]
  /** `layout: main-aside` — the aside's width and fields; the submit button joins them. */
  readonly aside?: FormAsideLayout
  /** `stickyActions` — the pinned bar the submit button moves into. */
  readonly saveBar?: SaveBarState
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

/** The form's submit button, its caption the saving label while a save is in flight. */
function SubmitButton({
  props,
  locked,
}: {
  readonly props: FormBodyProps
  readonly locked: boolean
}) {
  return (
    <button
      type="submit"
      data-crud-submit=""
      className={computeButtonDefaultClasses()}
      disabled={props.state.isPending || locked}
      {...(props.variant && { 'data-variant': props.variant })}
    >
      {props.state.isPending ? (props.savingLabel ?? 'Saving...') : props.submitLabel}
    </button>
  )
}

/** The submit button at the end of the form, or inside the pinned save bar. */
function FormFooter({
  bar,
  children,
}: {
  readonly bar: SaveBarState | undefined
  readonly children: React.ReactElement
}) {
  if (bar === undefined) return children
  return (
    <SaveBar
      bar={bar}
      submit={children}
    />
  )
}

export function FormBody(props: FormBodyProps) {
  const { fields, values, state, onFieldChange, redirectUrl, useNativeForm, layout, binding } =
    props
  const fieldsOf = (subset: readonly FieldDef[]) => (
    <FormFields
      fields={subset}
      values={values}
      onChange={onFieldChange}
      fieldError={state.fieldError}
      invalidFields={state.invalidFields}
      layout={layout}
      {...(binding === undefined ? {} : { binding })}
      {...(props.sections === undefined ? {} : { sections: props.sections })}
      uiStrings={props.uiStrings}
    />
  )
  const submit = (
    <SubmitButton
      props={props}
      locked={props.saveBar?.changes === 0}
    />
  )
  const aside = formAsideOf(layout, props.aside)
  return (
    <>
      {state.fieldError && (
        <ErrorSummary
          fields={fields}
          fieldError={state.fieldError}
        />
      )}
      <FormRegions
        fields={fields}
        aside={aside}
        fieldsOf={fieldsOf}
        submit={submit}
      />
      {redirectUrl && useNativeForm && (
        <input
          type="hidden"
          name="_redirect"
          value={redirectUrl}
        />
      )}
      {state.error && <div role="alert">{state.error}</div>}
      {aside === undefined && <FormFooter bar={props.saveBar}>{submit}</FormFooter>}
    </>
  )
}
