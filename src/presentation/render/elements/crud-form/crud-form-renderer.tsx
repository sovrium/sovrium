/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  resolveInterpreterString,
  resolveInterpreterStringOverrides,
  resolveTranslationPattern,
} from '@/domain/models/app/languages/translation-resolver'
import { computeFormLayoutClasses } from '../../../design/forms-default-classes'
import { omitInternalMarkers } from '../../props/internal-marker-props'
import {
  buildCreateFieldDefs,
  buildResolvedFieldDefs,
  updateFieldDefsForReader,
} from './crud-form-field-resolver'
import { applyInlineCrudPrefill } from './crud-form-inline-prefill'
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
 * The form's own interface strings in the page language: one default label
 * for the server-rendered button, and the `form.*` strings that differ from
 * English for the island (absent on an English page).
 */
function formString(key: string, context: CrudFormRenderContext): string {
  return resolveInterpreterString(
    key,
    context.lang ?? context.languages?.default,
    context.languages
  )
}

function formUiStrings(
  context: CrudFormRenderContext
): Readonly<Record<string, string>> | undefined {
  const { lang, languages } = context
  return resolveInterpreterStringOverrides(['form.'], lang ?? languages?.default, languages)
}

/**
 * The author's `id` and `data-testid` name the `<form>` a reader fills in, not
 * the island host around it: the island draws the same names on its own form,
 * so a host carrying them too would give one page two elements per name.
 */
function formNames(props: ElementProps): {
  readonly id?: string
  readonly 'data-testid'?: string
} {
  const { id, 'data-testid': testId } = props as Record<string, unknown>
  return {
    ...(typeof id === 'string' && { id }),
    ...(typeof testId === 'string' && { 'data-testid': testId }),
  }
}

/** The island host's attributes: the element props minus the names the form carries. */
function hostProps(props: ElementProps): ElementProps {
  const {
    id: _id,
    'data-testid': _testId,
    ...rest
  } = omitInternalMarkers(props) as Record<string, unknown>
  return rest as ElementProps
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
  const baseFields = applyInlineCrudPrefill(
    buildCreateFieldDefs(tables, action.table, component, buckets),
    component
  )
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
    uiStrings: formUiStrings(context),
  })

  return (
    <div
      {...hostProps(props)}
      data-island="crud-form"
      data-island-props={islandProps}
    >
      {/* SSR skeleton — the first paint, replaced by the island. The records
          API takes JSON, which only the island sends, so the skeleton's submit
          is drawn disabled (blocking Enter too) and the form posts, never GETs:
          a press before the script ran used to put every field in the URL. */}
      <form
        className={computeFormLayoutClasses()}
        aria-label={`Create ${action.table}`}
        {...formNames(props)}
        method="post"
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
          disabled
          {...(submitBtn.variant && { 'data-variant': submitBtn.variant })}
        >
          {submitBtn.label ?? formString('form.create', context)}
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

/**
 * The fields an update form renders an input for: every resolved field but the
 * ones the resolver marked unreadable for this visitor (`_unreadableFields`,
 * `resolve/data-source-modes.ts`). The form never received their values, and
 * an input it rendered anyway would be submitted empty over the stored value.
 */
function readableFieldDefs(
  fields: readonly ResolvedFieldDef[],
  unreadable: unknown
): readonly ResolvedFieldDef[] {
  if (!Array.isArray(unreadable) || unreadable.length === 0) return fields
  const withheld = new Set(unreadable as readonly string[])
  return fields.filter((field) => !withheld.has(field.name))
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
  const isReadOnly = props._readOnly === true
  const resolvedFields = updateFieldDefsForReader(
    readableFieldDefs(
      buildResolvedFieldDefs(tables, action.table, component, buckets),
      props._unreadableFields
    ),
    { table: tables?.find((t) => t.name === action.table), component, readOnly: isReadOnly }
  )
  const rawFields = applyCrudFieldOverrides(resolvedFields, action.fields, context)
  const submitBtn = readSubmitButtonProps(action, context, component)
  const restProps = omitInternalMarkers(props) as Record<string, unknown>
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
    uiStrings: formUiStrings(context),
  })
  const formAction = buildUpdateFormAction(action.table, recordId)

  return (
    <div
      {...hostProps(restProps as ElementProps)}
      data-island="crud-form"
      data-island-props={islandProps}
    >
      <form
        className={computeFormLayoutClasses()}
        aria-label={`Edit ${action.table}`}
        {...formNames(restProps as ElementProps)}
        method="POST"
        action={formAction}
        data-action-type="crud"
        data-action-method="update"
        data-action-table={action.table}
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
        {!isReadOnly && (
          <button type="submit">{submitBtn.label ?? formString('form.update', context)}</button>
        )}
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
  readonly uiStrings: Readonly<Record<string, string>> | undefined
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
    uiStrings: ctx.uiStrings,
  })
}

export function renderAutomationForm(
  props: ElementProps,
  action: AutomationFormAction,
  tables?: Tables,
  component?: Component,
  buckets?: Buckets,
  context: CrudFormRenderContext = {}
): ReactElement {
  const componentRecord = (component ?? {}) as Record<string, unknown>
  const dataSource = componentRecord['dataSource'] as { table?: string } | undefined
  const tableName = dataSource?.table ?? ''
  const fields = buildResolvedFieldDefs(tables, tableName, component, buckets)
  // Automation actions have no action-level submit label; reuse the helper with
  // an action carrying only the table identity so it falls back to props.label.
  const submitBtn = readSubmitButtonProps(
    { type: 'automation', operation: 'automation', table: tableName },
    context,
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
    uiStrings: formUiStrings(context),
  })

  return (
    <div
      {...hostProps(props)}
      data-island="crud-form"
      data-island-props={islandProps}
    >
      {/* SSR skeleton, replaced by the island: an automation is triggered over
          JSON only, so — like the create form — the submit waits disabled for
          the island and the form posts, never GETs. */}
      <form
        className={computeFormLayoutClasses()}
        aria-label={`Submit ${action.name}`}
        {...formNames(props)}
        method="post"
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
          disabled
          {...(submitBtn.variant && { 'data-variant': submitBtn.variant })}
        >
          {submitBtn.label ?? formString('form.submit', context)}
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

function buildDeleteButtonAttrs(action: CrudFormAction): Record<string, unknown> {
  return {
    'data-action-type': 'crud',
    'data-action-method': 'delete',
    'data-action-table': action.table,
    ...(action.onSuccess?.navigate && { 'data-on-success-redirect': action.onSuccess.navigate }),
    ...(action.confirm && { 'data-confirm': 'true' }),
    ...(action.confirmMessage && { 'data-confirm-message': action.confirmMessage }),
  }
}

export function renderCrudDeleteButton(config: DeleteButtonConfig): ReactElement {
  const { props, content, action, tables, routeParams } = config
  const record = (props._record ?? {}) as Record<string, unknown>
  const restProps = omitInternalMarkers(props) as Record<string, unknown>
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
  const buttonAttrs = buildDeleteButtonAttrs(action)

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
