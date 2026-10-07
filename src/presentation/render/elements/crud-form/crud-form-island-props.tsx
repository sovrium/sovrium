/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CrudFormAction, ResolvedFieldDef } from './crud-form-types'
import type { Component } from '@/domain/models/app/pages/components'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'
import type { FormSectionLayout } from '@/domain/models/app/pages/components/component-types/data/form/sections-service'

/** A `main-aside` form's aside: its width (px or rem) and the fields placed in it. */
export interface FormAside {
  readonly width?: string
  readonly fields: readonly string[]
}

/**
 * A form's `layout` and, under `main-aside`, its aside: the `asideWidth` and the
 * fields whose `region` is `aside`. Spread into {@link buildCrudIslandProps}.
 *
 * @param component - The form component, if any.
 */
export function formLayoutProps(component?: Component): {
  readonly layout?: string
  readonly aside?: FormAside
  readonly labelPlacement?: unknown
  readonly stickyActions?: unknown
} {
  const record = (component ?? {}) as {
    readonly labelPlacement?: unknown
    readonly stickyActions?: unknown
  }
  return {
    ...regionLayoutProps(component),
    ...(record.labelPlacement === undefined ? {} : { labelPlacement: record.labelPlacement }),
    ...(record.stickyActions === undefined ? {} : { stickyActions: record.stickyActions }),
  }
}

/** The form's `layout`, and for `main-aside` the aside's width and fields. */
function regionLayoutProps(component?: Component): {
  readonly layout?: string
  readonly aside?: FormAside
} {
  const record = (component ?? {}) as {
    readonly layout?: unknown
    readonly asideWidth?: unknown
    readonly fields?: unknown
  }
  const layout = typeof record.layout === 'string' ? record.layout : undefined
  if (layout !== 'main-aside') return layout === undefined ? {} : { layout }
  const fields = (Array.isArray(record.fields) ? record.fields : []).flatMap((entry) => {
    const { field, region } = (entry ?? {}) as { field?: unknown; region?: unknown }
    return region === 'aside' && typeof field === 'string' ? [field] : []
  })
  const width = typeof record.asideWidth === 'string' ? record.asideWidth : undefined
  return { layout, aside: { fields, ...(width === undefined ? {} : { width }) } }
}

export function buildCrudIslandProps(ctx: {
  readonly operation: string
  readonly action: CrudFormAction
  readonly fields: readonly ResolvedFieldDef[]
  readonly record?: Record<string, unknown>
  readonly recordId?: string
  readonly testId?: unknown
  readonly id?: unknown
  /** The author's `props.className`, merged over the form's layout classes. */
  readonly className?: string | undefined
  readonly buttonLabel?: string
  readonly variant?: string
  readonly layout?: string
  /** `layout: main-aside` — the aside column's width and the fields it holds. */
  readonly aside?: FormAside
  /** The page form's sections, titles localized — drawn by the island as titled groups. */
  readonly sections?: readonly FormSectionLayout[]
  readonly autoSave?: AutoSaveConfig
  /** `form.labelPlacement` and `form.stickyActions`, verbatim. */
  readonly labelPlacement?: unknown
  readonly stickyActions?: unknown
  /** The form's interface strings that differ from English (`form.*`), if any. */
  readonly uiStrings?: Readonly<Record<string, string>>
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
    ...(ctx.aside === undefined ? {} : { aside: ctx.aside }),
    sections: ctx.sections,
    autoSave: ctx.autoSave,
    labelPlacement: ctx.labelPlacement,
    stickyActions: ctx.stickyActions,
    uiStrings: ctx.uiStrings,
    'data-testid': ctx.testId,
    id: ctx.id,
    className: ctx.className,
  })
}

/**
 * Reads the optional `autoSave` configuration from a form component's schema.
 *
 * `autoSave` is declared on data-bound components via `dataBoundFields`
 * (sibling of `dataSource`/`action`), so it lives at the component's top
 * level — not inside `props`. Returns `undefined` when the component does
 * not opt into auto-save (preserving the default manual-save behavior).
 */
export function readAutoSaveConfig(component?: Component): AutoSaveConfig | undefined {
  const componentRecord = (component ?? {}) as Record<string, unknown>
  return componentRecord['autoSave'] as AutoSaveConfig | undefined
}

/** The island props of a form whose submit runs an automation. */
export function buildAutomationIslandProps(ctx: {
  readonly automationName: string
  readonly inputData: Record<string, unknown> | undefined
  readonly fields: readonly ResolvedFieldDef[]
  readonly redirectUrl: string | undefined
  readonly successToast: unknown
  readonly buttonLabel: string | undefined
  readonly variant: string | undefined
  readonly testId: unknown
  readonly id: unknown
  readonly className?: string | undefined
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
    className: ctx.className,
    uiStrings: ctx.uiStrings,
  })
}
