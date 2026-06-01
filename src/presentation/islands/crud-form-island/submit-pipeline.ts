/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { substituteRecordVars } from '@/domain/utils/substitute-record-vars'
import { dispatch as dispatchIslandEvent } from '../_shared/event-bus'
import { evaluateCondition, isFieldVisible } from '../components/crud-form/conditions'
import { type FieldDef } from '../components/crud-form/fields'
import { showSuccessToast } from '../components/crud-form/toast'
import { type SubmitContext } from './types'

export function findMissingRequiredFields(
  fields: readonly FieldDef[],
  values: Record<string, string>
): readonly string[] {
  return fields
    .filter((f) => {
      if (!isFieldVisible(f, values)) return false
      const dynamicRequired = f.requiredWhen ? evaluateCondition(f.requiredWhen, values) : false
      return !!(f.required || dynamicRequired) && !values[f.name]?.trim()
    })
    .map((f) => f.name)
}

const RICH_TEXT_EMPTY_DOC_LENGTH = '<p></p>'.length

function findOverLimitField(
  fields: readonly FieldDef[],
  values: Record<string, string>
): FieldDef | undefined {
  return fields.find((f) => {
    if (f.type !== 'rich-text' || f.maxLength === undefined) return false
    const value = values[f.name] ?? ''
    const charCount = Math.max(0, value.length - RICH_TEXT_EMPTY_DOC_LENGTH)
    return charCount > f.maxLength
  })
}

function resolveFormInputData(
  inputData: Record<string, unknown>,
  values: Record<string, string>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(inputData).map(([k, v]) => {
      if (typeof v === 'string' && v.startsWith('$form.')) {
        const field = v.slice(6)
        return [k, values[field] ?? '']
      }
      return [k, v]
    })
  )
}

async function submitAutomationForm(ctx: SubmitContext): Promise<void> {
  const name = ctx.automationName
  if (!name) throw new Error('Automation name is required')
  const resolvedInput = resolveFormInputData(ctx.inputData ?? {}, ctx.values)
  const response = await fetch(`/api/automations/${encodeURIComponent(name)}/form-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputData: resolvedInput }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    throw new Error(body.message ?? 'Automation failed')
  }
}

type MutationResult = { readonly record?: Record<string, unknown> }

async function executeMutation(ctx: SubmitContext): Promise<MutationResult> {
  const visibleValues = Object.fromEntries(
    Object.entries(ctx.values).filter(([key, value]) => {
      const field = ctx.fields.find((f) => f.name === key)
      if (!field) return true
      if (field.hidden) return true
      if (!isFieldVisible(field, ctx.values)) return false
      if (field.type === 'single-select' && value === '') return false
      if (
        (field.type === 'single-attachment' || field.type === 'multiple-attachments') &&
        value.trim() === ''
      )
        return false
      return true
    })
  )
  switch (ctx.operation) {
    case 'create': {
      const created = await ctx.createRecord.mutateAsync(visibleValues)
      return { record: created as Record<string, unknown> }
    }
    case 'update':
      if (ctx.recordId) {
        const updated = await ctx.updateRecord.mutateAsync({
          recordId: ctx.recordId,
          fields: visibleValues,
        })
        return { record: updated as Record<string, unknown> }
      }
      return {}
    case 'delete':
      if (ctx.recordId) {
        await ctx.deleteRecord.mutateAsync(ctx.recordId)
      }
      return {}
    default:
      return {}
  }
}

function resolveRecordFields(result: MutationResult): Record<string, unknown> {
  const record = result.record ?? {}
  const nested = (record as { record?: Record<string, unknown> }).record
  return nested ?? record
}

function handleSuccessPage(ctx: SubmitContext, result: MutationResult): void {
  ctx.setState({ isPending: false, successPageShown: { values: { ...ctx.values } } })
  const redirect = ctx.successPage?.redirect
  if (redirect?.startsWith('/')) {
    const resolved = substituteRecordVars(redirect, resolveRecordFields(result))
    setTimeout(() => globalThis.location.assign(resolved), 800)
  }
}

function handleDefaultSuccess(ctx: SubmitContext): void {
  ctx.setState(
    ctx.operation === 'delete' ? { isPending: false, deleted: true } : { isPending: false }
  )
  if (ctx.resetOnSuccess && ctx.operation !== 'delete') {
    ctx.resetValues()
    ctx.afterReset?.()
  }
  if (ctx.redirectUrl?.startsWith('/')) {
    setTimeout(() => globalThis.location.assign(ctx.redirectUrl!), 500)
  }
}

function dispatchCrudSuccess(ctx: SubmitContext, result: MutationResult): void {
  if (typeof ctx.tableName !== 'string') return
  if (ctx.operation === 'automation') return
  const recordId =
    typeof result.record?.['id'] === 'string' || typeof result.record?.['id'] === 'number'
      ? String(result.record['id'])
      : ctx.recordId
  dispatchIslandEvent('sovrium:crud-success', {
    table: ctx.tableName,
    operation: ctx.operation,
    ...(recordId !== undefined && { recordId }),
  })
}

function handleMutationSuccess(ctx: SubmitContext, result: MutationResult): void {
  if (ctx.successToast?.message) {
    showSuccessToast(ctx.successToast)
  }
  dispatchCrudSuccess(ctx, result)
  if (ctx.successPage && ctx.operation !== 'delete') {
    handleSuccessPage(ctx, result)
    return
  }
  handleDefaultSuccess(ctx)
}

function handleMutationError(ctx: SubmitContext, err: unknown): void {
  const error = err as { message?: string; code?: string; field?: string }
  if (error.code === 'VALIDATION_ERROR' && error.field) {
    ctx.setState({
      fieldError: { field: error.field, message: error.message ?? 'Validation error' },
      isPending: false,
    })
  } else {
    ctx.setState({ error: error.message ?? 'Operation failed', isPending: false })
  }
}

function validateCrudInputs(ctx: SubmitContext): boolean {
  if (ctx.operation !== 'create' && ctx.operation !== 'update') return true
  const missing = findMissingRequiredFields(ctx.fields, ctx.values)
  if (missing.length > 0) {
    const first = missing[0]!
    ctx.setState({
      fieldError: { field: first, message: 'This field is required' },
      invalidFields: missing,
      isPending: false,
    })
    return false
  }
  const overLimit = findOverLimitField(ctx.fields, ctx.values)
  if (overLimit) {
    ctx.setState({
      fieldError: {
        field: overLimit.name,
        message: `Content exceeds maximum of ${overLimit.maxLength} characters`,
      },
      invalidFields: [overLimit.name],
      isPending: false,
    })
    return false
  }
  return true
}

export async function submitCrudForm(ctx: SubmitContext): Promise<void> {
  ctx.setState({ isPending: true })
  if (!validateCrudInputs(ctx)) return
  const runMutation: () => Promise<MutationResult> =
    ctx.operation === 'automation'
      ? async () => {
          await submitAutomationForm(ctx)
          return {}
        }
      : () => executeMutation(ctx)
  try {
    const result = await runMutation()
    handleMutationSuccess(ctx, result)
  } catch (err) {
    handleMutationError(ctx, err)
  }
}
