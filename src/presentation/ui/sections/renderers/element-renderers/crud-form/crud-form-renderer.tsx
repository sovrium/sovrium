/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveTranslationPattern } from '@/domain/utils/translation-resolver'
import { computeFormLayoutClasses } from '../recipes/forms-default-classes'
import { buildResolvedFieldDefs } from './crud-form-field-resolver'
import { renderSkeletonField, renderUpdateSkeletonField } from './crud-form-skeleton'
import type { ElementProps } from '../html-element-renderer'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/pages/components'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type { VisibleWhenCondition } from '@/domain/models/app/pages/components/component-types/data/form'
import type { Tables } from '@/domain/models/app/tables'
import type { RouteParams } from '@/domain/utils/matching/route-matcher'

export type SuccessPageActionConfig = {
  readonly label: string
  readonly action: 'reset' | 'navigate'
  readonly url?: string
}

export type CrudFieldOverride = {
  readonly name: string
  readonly label?: string
  readonly placeholder?: string
}

export type CrudFormAction = {
  readonly type: string
  readonly operation: string
  readonly table: string
  readonly submitLabel?: string
  readonly fields?: readonly CrudFieldOverride[]
  readonly onSuccess?: {
    readonly type?: string
    readonly navigate?: string
    readonly preserveFields?: readonly string[]
    readonly title?: string
    readonly message?: string
    readonly actions?: readonly SuccessPageActionConfig[]
    readonly showSummary?: boolean
    readonly redirect?: string
    readonly toast?: {
      readonly message: string
      readonly variant?: string
      readonly duration?: number
    }
  }
  readonly confirm?: boolean
  readonly confirmMessage?: string
}

export type ResolvedFieldDef = {
  readonly name: string
  readonly type: string
  readonly required?: boolean
  readonly options?: readonly string[]
  readonly displayLabel: string
  readonly placeholder?: string
  readonly readOnly?: boolean
  readonly disabled?: boolean
  readonly defaultValue?: string | number | boolean
  readonly hidden?: boolean
  readonly visibleWhen?: VisibleWhenCondition
  readonly requiredWhen?: VisibleWhenCondition
  readonly disabledWhen?: VisibleWhenCondition
  readonly maxLength?: number
  readonly toolbar?: readonly string[]
  readonly imageBucket?: string
  readonly language?: string
  readonly lineNumbers?: boolean
  readonly tabSize?: number
  readonly minLines?: number
  readonly maxLines?: number
  readonly accept?: string
  readonly dropZone?: boolean
  readonly maxFiles?: number
  readonly maxFileSize?: number
  readonly allowedFileTypes?: readonly string[]
}

export interface CrudFormRenderContext {
  readonly lang?: string
  readonly languages?: Languages
}

function localize(text: string, context: CrudFormRenderContext): string {
  const { lang, languages } = context
  return resolveTranslationPattern(text, lang ?? languages?.default ?? '', languages)
}

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


function buildCrudIslandProps(ctx: {
  readonly operation: string
  readonly action: CrudFormAction
  readonly fields: readonly ResolvedFieldDef[]
  readonly record?: Record<string, unknown>
  readonly recordId?: string
  readonly testId?: unknown
  readonly id?: unknown
  readonly buttonLabel?: string
  readonly variant?: string
  readonly layout?: string
  readonly fieldGroups?: readonly { readonly label: string; readonly fields: readonly string[] }[]
  readonly wizard?: readonly { readonly label: string; readonly fields: readonly string[] }[]
  readonly autoSave?: AutoSaveConfig
}): string {
  const { onSuccess } = ctx.action
  const successPage =
    onSuccess?.type === 'successPage'
      ? {
          title: onSuccess.title,
          message: onSuccess.message,
          actions: onSuccess.actions,
          showSummary: onSuccess.showSummary,
          redirect: onSuccess.redirect,
        }
      : undefined
  return JSON.stringify({
    operation: ctx.operation,
    table: ctx.action.table,
    fields: ctx.fields,
    record: ctx.record,
    recordId: ctx.recordId,
    redirectUrl: onSuccess?.navigate,
    successToast: onSuccess?.toast,
    resetOnSuccess: onSuccess?.type === 'reset',
    preserveFields: onSuccess?.preserveFields,
    successPage,
    confirm: ctx.action.confirm,
    confirmMessage: ctx.action.confirmMessage,
    buttonLabel: ctx.buttonLabel,
    variant: ctx.variant,
    layout: ctx.layout,
    fieldGroups: ctx.fieldGroups,
    wizard: ctx.wizard,
    autoSave: ctx.autoSave,
    'data-testid': ctx.testId,
    id: ctx.id,
  })
}

function readAutoSaveConfig(component?: Component): AutoSaveConfig | undefined {
  const componentRecord = (component ?? {}) as Record<string, unknown>
  return componentRecord['autoSave'] as AutoSaveConfig | undefined
}


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
      {}
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


function buildUpdateFormAction(tableName: string, recordId: string): string {
  return recordId
    ? `/api/tables/${tableName}/records/${recordId}/update`
    : `/api/tables/${tableName}/records/update`
}

type FieldGroupsArray =
  | readonly { readonly label: string; readonly fields: readonly string[] }[]
  | undefined

type WizardStepsArray =
  | readonly { readonly label: string; readonly fields: readonly string[] }[]
  | undefined

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
