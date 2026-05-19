/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { buildResolvedFieldDefs } from './crud-form-field-resolver'
import { renderSkeletonField, renderUpdateSkeletonField } from './crud-form-skeleton'
import type { ElementProps } from './html-element-renderer'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Component } from '@/domain/models/app/pages/components'
import type { VisibleWhenCondition } from '@/domain/models/app/pages/components/component-types/data/form'
import type { Tables } from '@/domain/models/app/tables'
import type { RouteParams } from '@/domain/utils/route-matcher'

export type CrudFormAction = {
  readonly type: string
  readonly operation: string
  readonly table: string
  readonly onSuccess?: {
    readonly navigate?: string
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
}): string {
  return JSON.stringify({
    operation: ctx.operation,
    table: ctx.action.table,
    fields: ctx.fields,
    record: ctx.record,
    recordId: ctx.recordId,
    redirectUrl: ctx.action.onSuccess?.navigate,
    successToast: ctx.action.onSuccess?.toast,
    confirm: ctx.action.confirm,
    confirmMessage: ctx.action.confirmMessage,
    buttonLabel: ctx.buttonLabel,
    variant: ctx.variant,
    layout: ctx.layout,
    fieldGroups: ctx.fieldGroups,
    wizard: ctx.wizard,
    'data-testid': ctx.testId,
    id: ctx.id,
  })
}


function readSubmitButtonProps(component?: Component): {
  readonly label?: string
  readonly variant?: string
} {
  const componentProps = (component?.props ?? {}) as Record<string, unknown>
  return {
    label: typeof componentProps['label'] === 'string' ? componentProps['label'] : undefined,
    variant: typeof componentProps['variant'] === 'string' ? componentProps['variant'] : undefined,
  }
}

export function renderCrudCreateForm(
  props: ElementProps,
  action: CrudFormAction,
  tables?: Tables,
  component?: Component,
  buckets?: Buckets
): ReactElement {
  const fields = buildResolvedFieldDefs(tables, action.table, component, buckets)
  const submitBtn = readSubmitButtonProps(component)
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
  })

  return (
    <div
      {...props}
      data-island="crud-form"
      data-island-props={islandProps}
    >
      {}
      <form
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
  buckets?: Buckets
): ReactElement {
  const record = (props._record ?? {}) as Record<string, unknown>
  const fields = buildResolvedFieldDefs(tables, action.table, component, buckets)
  const submitBtn = readSubmitButtonProps(component)
  const { _record: _rec, _dataSourceBound: _dsb, ...restProps } = props as Record<string, unknown>
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
  })
  const formAction = buildUpdateFormAction(action.table, recordId)

  return (
    <div
      {...(restProps as ElementProps)}
      data-island="crud-form"
      data-island-props={islandProps}
    >
      <form
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
        <button type="submit">Update</button>
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
  const submitBtn = readSubmitButtonProps(component)
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
