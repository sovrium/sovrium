/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import { omitsEmptyValue } from '@/presentation/design/field-type-behavior'
import { type FieldDef } from '../parts/crud-form/fields'
import { showSuccessToast } from '../parts/crud-form/toast'
import { isMarkedCleared, toWireFields } from '../parts/crud-form/wire-values'
import { dispatch as dispatchIslandEvent } from '../runtime/event-bus'
import { formString } from './form-strings'
import { type FormState, type SubmitContext } from './types'

function findMissingRequiredFields(
  fields: readonly FieldDef[],
  values: Record<string, string>
): readonly string[] {
  return fields.filter((f) => !!f.required && !values[f.name]?.trim()).map((f) => f.name)
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
 * `maxLength`. Returns the first
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

/**
 * Result of a successful update mutation. Carries the updated record so
 * `onSuccess.redirect` can interpolate `$record.id` etc.
 */
type MutationResult = { readonly record?: Record<string, unknown> }

async function executeMutation(ctx: SubmitContext): Promise<MutationResult> {
  // Hidden-input fields (field.hidden) are submitted like any other — except an
  // EMPTY one whose column cannot hold '' (below): a hidden link nothing filled
  // is no link, stored as NULL, not a reference to a record that does not exist.
  const heldValues = Object.fromEntries(
    Object.entries(ctx.values).filter(([key, value]) => {
      const field = ctx.fields.find((f) => f.name === key)
      if (!field) return true
      // Omit untouched fields whose column cannot hold an empty string: '' is
      // the browser's "nothing entered" sentinel, never a legal value for a
      // choice / numeric / temporal / relational / attachment column. Omitting
      // lets the column stay NULL or take its DB default, instead of failing
      // the whole write on a CHECK / type / foreign-key violation.
      //
      // The decision is TOTAL over the field-type union (see
      // `@/presentation/utils/field-type-behavior`), so a newly added field
      // type has to declare its answer rather than defaulting into the bug.
      //
      // The whole FIELD is passed, not just its type: `barcode`'s CHECK is
      // opt-in via its own `format`, so two fields of one type legitimately
      // answer differently.
      if (omitsEmptyValue(field) && value.trim() === '' && !isMarkedCleared(ctx.values, key)) {
        return false
      }
      return true
    })
  )
  // The form HOLDS strings; the API takes each column's own kind of value — a
  // number, a list, an ISO instant. Converted once, on the way out.
  const visibleValues = toWireFields(ctx.fields, heldValues)
  switch (ctx.operation) {
    case 'update':
      if (ctx.recordId) {
        const updated = await ctx.updateRecord.mutateAsync({
          recordId: ctx.recordId,
          fields: visibleValues,
          ...(ctx.updatedAt !== undefined && { updatedAt: ctx.updatedAt }),
        })
        ctx.rememberUpdatedAt?.(updated)
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

/**
 * Resolve the canonical record fields from an update mutation result, which
 * nests them under `record.record` (a bare record is read as it is).
 */
function resolveRecordFields(result: MutationResult): Record<string, unknown> {
  const record = result.record ?? {}
  const nested = (record as { record?: Record<string, unknown> }).record
  return nested ?? record
}

/**
 * Handle `onSuccess.type: 'successPage'`: replace the form with the success
 * page (snapshotting the submitted values for an optional summary) and, when
 * `redirect` is set, navigate to the resolved URL after a short delay. Any
 * `$record.<field>` placeholders in `redirect` are substituted against the
 * updated record via the shared `substituteRecordVars` helper.
 */
function handleSuccessPage(ctx: SubmitContext, result: MutationResult): void {
  ctx.setState({ isPending: false, successPageShown: { values: { ...ctx.values } } })
  const redirect = ctx.successPage?.redirect
  if (redirect === undefined) return
  const resolved = substituteRecordVars(redirect, resolveRecordFields(result))
  // Validate AFTER substitution, not before: a template like `/$record.slug`
  // passes any leading-slash test on its own, yet a record field holding
  // `/evil.com` would expand it to the protocol-relative `//evil.com`. The
  // string actually handed to the browser is the one that must be checked.
  const target = toSafeRedirectPath(resolved)
  if (target !== undefined) {
    // Delay redirect so the success page is visible and DB writes propagate.
    setTimeout(() => globalThis.location.assign(target), 800)
  }
}

/**
 * Default post-submit handling for `navigate` / `reset` / `message` (or no
 * explicit) onSuccess responses. The `successPage` response is handled
 * separately by `handleSuccessPage`.
 */
function handleDefaultSuccess(ctx: SubmitContext): void {
  ctx.setState(
    ctx.operation === 'delete' ? { isPending: false, deleted: true } : { isPending: false }
  )
  // onSuccess.type: 'reset' — clear the form for rapid repeat entry. Retains
  // any fields listed in preserveFields. Skipped for delete operations.
  if (ctx.resetOnSuccess && ctx.operation !== 'delete') ctx.resetValues()
  const target = toSafeRedirectPath(ctx.redirectUrl)
  if (target !== undefined) {
    // Delay redirect to allow DB writes to propagate before external queries
    setTimeout(() => globalThis.location.assign(target), 500)
  }
}

/**
 * PG-04: dispatch a `sovrium:crud-success`
 * CustomEvent on `document` after a successful update / delete so:
 *
 *   1. Sibling data-table islands bound to the same `table` invalidate their
 *      TanStack Query cache and refetch (see use-island-setup.ts).
 *   2. Open drawer islands close themselves when the mutation originated
 *      inside them (see drawer-island.tsx).
 *
 * `automation` operations are excluded — those have no record-table context.
 * The event runs BEFORE `handleSuccessPage` / `handleDefaultSuccess` so the
 * data-table refetch overlaps with the (delayed) redirect that may follow,
 * and so the drawer closes before any redirect fires.
 */
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
  // onSuccess.type: 'successPage' — replace the form with a success page.
  // Skipped for delete operations (no form to replace).
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
    ctx.setState({
      error: error.message ?? formString(ctx.uiStrings, 'form.operationFailed', 'Operation failed'),
      isPending: false,
    })
  }
}

/**
 * The form state that stops a submit before it leaves the browser — a required
 * field left empty, or a rich-text body over its `maxLength` — or `undefined`
 * when every field may be sent. Read by the script submit and by the native
 * post an edit form makes, so both refuse the same values the same way.
 */
export function blockingFieldState(
  fields: readonly FieldDef[],
  values: Record<string, string>,
  uiStrings: SubmitContext['uiStrings']
): FormState | undefined {
  const missing = findMissingRequiredFields(fields, values)
  if (missing.length > 0) {
    return {
      fieldError: {
        field: missing[0]!,
        message: formString(uiStrings, 'form.required', 'This field is required'),
      },
      invalidFields: missing,
      isPending: false,
    }
  }
  const overLimit = findOverLimitField(fields, values)
  if (overLimit === undefined) return undefined
  return {
    fieldError: {
      field: overLimit.name,
      message: `Content exceeds maximum of ${overLimit.maxLength} characters`,
    },
    invalidFields: [overLimit.name],
    isPending: false,
  }
}

function validateCrudInputs(ctx: SubmitContext): boolean {
  if (ctx.operation !== 'update') return true
  const blocking = blockingFieldState(ctx.fields, ctx.values, ctx.uiStrings)
  if (blocking === undefined) return true
  ctx.setState(blocking)
  return false
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
