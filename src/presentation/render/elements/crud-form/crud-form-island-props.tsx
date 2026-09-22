/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CrudFormAction, ResolvedFieldDef } from './crud-form-types'
import type { Component } from '@/domain/models/app/pages/components'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'

export function buildCrudIslandProps(ctx: {
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
