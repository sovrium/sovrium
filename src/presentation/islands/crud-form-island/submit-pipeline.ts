/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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

/**
 * Length of the empty Tiptap document HTML (`<p></p>`). Subtracted from the
 * raw HTML length so the visible character counter matches what the user
 * typed. Must stay in sync with `RICH_TEXT_EMPTY_DOC_LENGTH` in
 * `rich-text-editor-field.tsx`.
 */
const RICH_TEXT_EMPTY_DOC_LENGTH = '<p></p>'.length // 7

/**
 * Detect rich-text fields whose current value exceeds the configured
 * `maxLength` (asserted by APP-PAGES-CRUD-WYSIWYG-006). Returns the first
 * over-limit field, or `undefined` when all fields are within their limit.
 *
 * The character count is the raw HTML length minus the empty-document
 * baseline (`<p></p>` = 7 chars) — same heuristic as the editor's
 * counter, so the visible counter and the submit gate stay aligned.
 */
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
  // eslint-disable-next-line functional/no-throw-statements -- caller (submitCrudForm) expects thrown errors
  if (!name) throw new Error('Automation name is required')
  const resolvedInput = resolveFormInputData(ctx.inputData ?? {}, ctx.values)
  const response = await fetch(`/api/automations/${encodeURIComponent(name)}/form-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputData: resolvedInput }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string }
    // eslint-disable-next-line functional/no-throw-statements -- caller (submitCrudForm) expects thrown errors
    throw new Error(body.message ?? 'Automation failed')
  }
}

async function executeMutation(ctx: SubmitContext): Promise<void> {
  // Exclude values for fields that are conditionally hidden (visibleWhen not met).
  // Always include hidden-input fields (field.hidden) — they are submitted unconditionally.
  const visibleValues = Object.fromEntries(
    Object.entries(ctx.values).filter(([key, value]) => {
      const field = ctx.fields.find((f) => f.name === key)
      if (!field) return true
      if (field.hidden) return true
      if (!isFieldVisible(field, ctx.values)) return false
      // Omit unselected single-select fields: '' is the unselected sentinel and is never a
      // valid option value. Omitting lets the DB column stay NULL (satisfies CHECK constraints).
      if (field.type === 'single-select' && value === '') return false
      return true
    })
  )
  switch (ctx.operation) {
    case 'create':
      await ctx.createRecord.mutateAsync(visibleValues)
      break
    case 'update':
      if (ctx.recordId) {
        await ctx.updateRecord.mutateAsync({ recordId: ctx.recordId, fields: visibleValues })
      }
      break
    case 'delete':
      if (ctx.recordId) {
        await ctx.deleteRecord.mutateAsync(ctx.recordId)
      }
      break
  }
}

function handleMutationSuccess(ctx: SubmitContext): void {
  if (ctx.operation === 'delete') {
    ctx.setState({ isPending: false, deleted: true })
  } else {
    ctx.setState({ isPending: false })
  }
  if (ctx.successToast?.message) {
    showSuccessToast(ctx.successToast)
  }
  if (ctx.redirectUrl?.startsWith('/')) {
    // Delay redirect to allow DB writes to propagate before external queries
    setTimeout(() => globalThis.location.assign(ctx.redirectUrl!), 500)
  }
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
  const runMutation =
    ctx.operation === 'automation' ? () => submitAutomationForm(ctx) : () => executeMutation(ctx)
  try {
    await runMutation()
    handleMutationSuccess(ctx)
  } catch (err) {
    handleMutationError(ctx, err)
  }
}
