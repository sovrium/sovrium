/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { computeFormLayoutClasses } from '../../../design/forms-default-classes'
import { buildResolvedFieldDefs } from './crud-form-field-resolver'
import { buildCrudIslandProps, readAutoSaveConfig } from './crud-form-island-props'
import { renderSkeletonField, renderUpdateSkeletonField } from './crud-form-skeleton'
import type { ElementProps } from '../html-element-renderer'
import type {
  CrudFieldOverride,
  CrudFormAction,
  CrudFormRenderContext,
  ResolvedFieldDef,
} from './crud-form-types'
import type { RouteParams } from '@/domain/kernel/matching/route-matcher'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/**
 * Localize a label/placeholder string through the page language + app
 * translations. Resolves `$t:key` references server-side and passes plain
 * strings through unchanged. Mirrors the auth-form `localize` helper.
 */
function localize(text: string, context: CrudFormRenderContext): string {
  const { lang, languages } = context
  return resolveTranslationPattern(text, lang ?? languages?.default ?? '', languages)
}

/**
 * Apply action-level `fields[]` label/placeholder overrides onto the resolved
 * field set, then localize every label + placeholder (and the override values,
 * which may themselves be `$t:key` references) through the page language.
 *
 * Overrides target a field by `name` (the table column name); fields not listed
 * keep their localized table-derived label. Mirrors the auth-form
 * `applyFieldOverrides` helper. Always runs so a built-in label that is itself a
 * `$t:key` (rare) is still localized.
 */
function applyCrudFieldOverrides(
  fields: readonly ResolvedFieldDef[],
  overrides: readonly CrudFieldOverride[] | undefined,
  context: CrudFormRenderContext
): readonly ResolvedFieldDef[] {
  const overrideByName = new Map((overrides ?? []).map((o) => [o.name, o] as const))
  return fields.map((field) => {
    const override = overrideByName.get(field.name)
    const displayLabel = localize(override?.label ?? field.displayLabel, context)
    const rawPlaceholder = override?.placeholder ?? field.placeholder
    const placeholder = rawPlaceholder !== undefined ? localize(rawPlaceholder, context) : undefined
    return { ...field, displayLabel, ...(placeholder !== undefined && { placeholder }) }
  })
}

// ---------------------------------------------------------------------------
// Island props builders
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

export function renderCrudCreateForm(
  props: ElementProps,
  action: CrudFormAction,
  tables?: Tables,
  component?: Component,
  buckets?: Buckets,
  context: CrudFormRenderContext = {}
): ReactElement {
  const baseFields = buildResolvedFieldDefs(tables, action.table, component, buckets)
  const fields = applyCrudFieldOverrides(baseFields, action.fields, context)
  const submitBtn = readSubmitButtonProps(action, context, component)
  const { layout, fieldGroups, wizardSteps } = readLayoutOptions(component)
  const islandProps = buildCrudIslandProps({
    operation: 'create',
    action,
    fields,
    testId: props['data-testid'],
    id: props.id,
    buttonLabel: submitBtn.label,
    variant: submitBtn.variant,
    layout,
    fieldGroups,
    wizard: wizardSteps,
    autoSave: readAutoSaveConfig(component),
  })

  return (
    <div
      {...props}
      data-island="crud-form"
      data-island-props={islandProps}
    >
      {/* SSR skeleton — progressive enhancement fallback */}
      <form
        className={computeFormLayoutClasses()}
        aria-label={`Create ${action.table}`}
        data-action-type="crud"
        data-action-method="create"
        data-action-table={action.table}
        {...(layout && { 'data-layout': layout })}
        {...(action.onSuccess?.navigate && {
          'data-on-success-redirect': action.onSuccess.navigate,
        })}
        noValidate
      >
        {fields.map((field) => renderSkeletonField(field))}
        <div
          data-error-summary
          hidden
        />
        <button
          type="submit"
          {...(submitBtn.variant && { 'data-variant': submitBtn.variant })}
        >
          {submitBtn.label ?? 'Create'}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Update form
// ---------------------------------------------------------------------------

function buildUpdateFormAction(tableName: string, recordId: string): string {
  return recordId
    ? `/api/tables/${tableName}/records/${recordId}/update`
    : `/api/tables/${tableName}/records/update`
}

type FieldGroupsArray =
  readonly { readonly label: string; readonly fields: readonly string[] }[] | undefined

type WizardStepsArray =
  readonly { readonly label: string; readonly fields: readonly string[] }[] | undefined

function readLayoutOptions(component?: Component): {
  readonly layout: string | undefined
  readonly fieldGroups: FieldGroupsArray
  readonly wizardSteps: WizardStepsArray
} {
  const componentRecord = (component ?? {}) as Record<string, unknown>
  const wizardConfig = componentRecord['wizard'] as { readonly steps: WizardStepsArray } | undefined
  return {
    layout: componentRecord['layout'] as string | undefined,
    fieldGroups: componentRecord['fieldGroups'] as FieldGroupsArray,
    wizardSteps: wizardConfig?.steps,
  }
}

export function renderCrudUpdateForm(
  props: ElementProps,
  action: CrudFormAction,
  tables?: Tables,
  component?: Component,
  buckets?: Buckets,
  context: CrudFormRenderContext = {}
): ReactElement {
  const record = (props._record ?? {}) as Record<string, unknown>
  const resolvedFields = buildResolvedFieldDefs(tables, action.table, component, buckets)
  const rawFields = applyCrudFieldOverrides(resolvedFields, action.fields, context)
  const submitBtn = readSubmitButtonProps(action, context, component)
  const {
    _record: _rec,
    _dataSourceBound: _dsb,
    _readOnly: readOnlyFlag,
    ...restProps
  } = props as Record<string, unknown>
  const isReadOnly = readOnlyFlag === true
  // PG-04: when the page filter detects that the
  // synthesized CRUD update would be denied by table-level update permissions,
  // it stamps `_readOnly: true` on the component's props. Propagate that to
  // every skeleton field as `disabled: true` (rendering the inputs disabled
  // but still visible) and suppress the Save button so the form can't even
  // attempt a submit.
  const fields = isReadOnly ? rawFields.map((f) => ({ ...f, disabled: true })) : rawFields
  const recordId = String(record['id'] ?? '')
  const { layout, fieldGroups } = readLayoutOptions(component)
  const islandProps = buildCrudIslandProps({
    operation: 'update',
    action,
    fields,
    record,
    recordId,
    testId: restProps['data-testid'],
    id: restProps['id'],
    buttonLabel: submitBtn.label,
    variant: submitBtn.variant,
    layout,
    fieldGroups,
    autoSave: readAutoSaveConfig(component),
  })
  const formAction = buildUpdateFormAction(action.table, recordId)

  return (
    <div
      {...(restProps as ElementProps)}
      data-island="crud-form"
      data-island-props={islandProps}
    >
      <form
        className={computeFormLayoutClasses()}
        aria-label={`Edit ${action.table}`}
        method="POST"
        action={formAction}
        data-action-type="crud"
        data-action-method="update"
        data-action-table={action.table}
        {...(recordId && { 'data-action-record-id': recordId })}
        {...(layout && { 'data-layout': layout })}
        {...(action.onSuccess?.navigate && {
          'data-on-success-redirect': action.onSuccess.navigate,
        })}
        noValidate
      >
        <input
          type="hidden"
          name="_redirect"
          value={action.onSuccess?.navigate ?? ''}
        />
        {fields.map((f) => renderUpdateSkeletonField(f, record))}
        {!isReadOnly && <button type="submit">{submitBtn.label ?? 'Update'}</button>}
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Automation form
// ---------------------------------------------------------------------------

export type AutomationFormAction = {
  readonly type: string
  readonly name: string
  readonly inputData?: Record<string, unknown>
  readonly await?: boolean
  readonly onSuccess?: {
    readonly navigate?: string
    readonly toast?: {
      readonly message: string
      readonly variant?: string
      readonly duration?: number
    }
  }
}

function buildAutomationIslandProps(ctx: {
  readonly automationName: string
  readonly inputData: Record<string, unknown> | undefined
  readonly fields: readonly ResolvedFieldDef[]
  readonly redirectUrl: string | undefined
  readonly successToast: NonNullable<AutomationFormAction['onSuccess']>['toast'] | undefined
  readonly buttonLabel: string | undefined
  readonly variant: string | undefined
  readonly testId: unknown
  readonly id: unknown
}): string {
  return JSON.stringify({
    operation: 'automation',
    automationName: ctx.automationName,
    inputData: ctx.inputData,
    table: '',
    fields: ctx.fields,
    redirectUrl: ctx.redirectUrl,
    successToast: ctx.successToast,
    buttonLabel: ctx.buttonLabel,
    variant: ctx.variant,
    'data-testid': ctx.testId,
    id: ctx.id,
  })
}

export function renderAutomationForm(
  props: ElementProps,
  action: AutomationFormAction,
  tables?: Tables,
  component?: Component,
  buckets?: Buckets
): ReactElement {
  const componentRecord = (component ?? {}) as Record<string, unknown>
  const dataSource = componentRecord['dataSource'] as { table?: string } | undefined
  const tableName = dataSource?.table ?? ''
  const fields = buildResolvedFieldDefs(tables, tableName, component, buckets)
  // Automation actions have no action-level submit label; reuse the helper with
  // an action carrying only the table identity so it falls back to props.label.
  const submitBtn = readSubmitButtonProps(
    { type: 'automation', operation: 'automation', table: tableName },
    {},
    component
  )
  const islandProps = buildAutomationIslandProps({
    automationName: action.name,
    inputData: action.inputData,
    fields,
    redirectUrl: action.onSuccess?.navigate,
    successToast: action.onSuccess?.toast,
    buttonLabel: submitBtn.label,
    variant: submitBtn.variant,
    testId: props['data-testid'],
    id: props.id,
  })

  return (
    <div
      {...props}
      data-island="crud-form"
      data-island-props={islandProps}
    >
      <form
        className={computeFormLayoutClasses()}
        aria-label={`Submit ${action.name}`}
        data-action-type="automation"
        data-action-automation={action.name}
        noValidate
      >
        {fields.map((field) => renderSkeletonField(field))}
        <div
          data-error-summary
          hidden
        />
        <button
          type="submit"
          {...(submitBtn.variant && { 'data-variant': submitBtn.variant })}
        >
          {submitBtn.label ?? 'Submit'}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete button
// ---------------------------------------------------------------------------

type DeleteButtonConfig = {
  readonly props: ElementProps
  readonly content: string | undefined
  readonly action: CrudFormAction
  readonly tables?: Tables
  readonly routeParams?: RouteParams
}

function isDeleteRestricted(action: CrudFormAction, tables?: Tables): boolean {
  const tableSchema = tables?.find((t) => t.name === action.table)
  const tableRecord = tableSchema as Record<string, unknown> | undefined
  const permissions = tableRecord?.['permissions'] as Record<string, unknown> | undefined
  const deleteRoles = permissions?.['delete'] as readonly string[] | undefined
  return deleteRoles !== undefined && deleteRoles.length > 0
}

function buildDeleteButtonAttrs(action: CrudFormAction, recordId: string): Record<string, unknown> {
  return {
    'data-action-type': 'crud',
    'data-action-method': 'delete',
    'data-action-table': action.table,
    ...(recordId && { 'data-action-record-id': recordId }),
    ...(action.onSuccess?.navigate && { 'data-on-success-redirect': action.onSuccess.navigate }),
    ...(action.confirm && { 'data-confirm': 'true' }),
    ...(action.confirmMessage && { 'data-confirm-message': action.confirmMessage }),
  }
}

export function renderCrudDeleteButton(config: DeleteButtonConfig): ReactElement {
  const { props, content, action, tables, routeParams } = config
  const record = (props._record ?? {}) as Record<string, unknown>
  const { _record: _rec, _dataSourceBound: _dsb, ...restProps } = props as Record<string, unknown>
  const recordId = String(record['id'] ?? routeParams?.['id'] ?? '')
  const islandProps = buildCrudIslandProps({
    operation: 'delete',
    action,
    fields: [],
    recordId,
    testId: restProps['data-testid'],
    id: restProps['id'],
    buttonLabel: content,
  })
  const buttonAttrs = buildDeleteButtonAttrs(action, recordId)

  return (
    <div
      {...(restProps as ElementProps)}
      data-island="crud-form"
      data-island-props={islandProps}
      {...(isDeleteRestricted(action, tables) && { hidden: true })}
    >
      <button {...buttonAttrs}>{content ?? 'Delete'}</button>
    </div>
  )
}

/**
 * Resolves the submit-button label + variant for a CRUD form.
 *
 * Precedence for the label: action-level `submitLabel` (localized, may be a
 * `$t:key`) → form component's `props.label` (localized) → the built-in
 * fallback (handled at the call site via `label ?? 'Create'`/`'Update'`).
 * `variant` comes from the form component's `props` block. Mirrors the
 * auth-form `submitLabel` precedence.
 */
function readSubmitButtonProps(
  action: CrudFormAction,
  context: CrudFormRenderContext,
  component?: Component
): {
  readonly label?: string
  readonly variant?: string
} {
  const componentProps = (component?.props ?? {}) as Record<string, unknown>
  const rawLabel =
    action.submitLabel ??
    (typeof componentProps['label'] === 'string' ? (componentProps['label'] as string) : undefined)
  return {
    label: rawLabel !== undefined ? localize(rawLabel, context) : undefined,
    variant: typeof componentProps['variant'] === 'string' ? componentProps['variant'] : undefined,
  }
}
