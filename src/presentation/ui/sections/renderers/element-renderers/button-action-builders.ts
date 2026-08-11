/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Action-attribute builders for the button renderer.
 *
 * Each `buildXxxDataAttributes` turns a typed action config into the flat
 * `data-*` map that the always-loaded client runtime (`presentation/client.ts`)
 * reads to dispatch the interaction. Split out of `button-renderer.tsx` so the
 * dispatcher + core render stay under the React-component line cap; this file
 * carries the action type definitions, type guards, and the `$record.*`
 * resolution helpers.
 */

import { substituteRecordVars } from '@/domain/utils/substitute-record-vars'
import { substituteRecordInInputData } from '@/presentation/rendering/record-template-substitution'
import type { CrudFormAction } from './crud-form/crud-form-renderer'
import type { FetchAction } from '@/domain/models/app/pages/components/action'
import type { RouteParams } from '@/domain/utils/matching/route-matcher'

/**
 * Build data attributes for click interactions
 */
export function buildClickDataAttributes(clickInteraction: {
  animation?: string
  navigate?: string
  openUrl?: string
  openInNewTab?: boolean
  scrollTo?: string
  toggleElement?: string
  submitForm?: string
  modal?: string
}): Record<string, string> {
  return {
    ...(clickInteraction.animation && { 'data-click-animation': clickInteraction.animation }),
    ...(clickInteraction.navigate && { 'data-click-navigate': clickInteraction.navigate }),
    ...(clickInteraction.openUrl && { 'data-click-open-url': clickInteraction.openUrl }),
    ...(clickInteraction.openInNewTab !== undefined && {
      'data-click-open-in-new-tab': String(clickInteraction.openInNewTab),
    }),
    ...(clickInteraction.scrollTo && { 'data-click-scroll-to': clickInteraction.scrollTo }),
    ...(clickInteraction.toggleElement && {
      'data-click-toggle-element': clickInteraction.toggleElement,
    }),
    ...(clickInteraction.submitForm && {
      'data-click-submit-form': clickInteraction.submitForm,
    }),
    ...(clickInteraction.modal && { 'data-click-modal': clickInteraction.modal }),
  }
}

export type AutomationAction = {
  type: 'automation'
  name: string
  await?: boolean
  inputData?: Record<string, unknown>
  onSuccess?: { toast?: { message?: string; variant?: string } }
}

/**
 * Returns true if the given action is an automation action
 */
export function isAutomationAction(action: unknown): action is AutomationAction {
  return (action as { type?: string })?.type === 'automation'
}

/**
 * Build the `$record.*` substitution context for an automation button.
 *
 * Mirrors `renderCrudDeleteButton`'s `record['id'] ?? routeParams?.['id']`
 * precedence: a record-detail page exposes the bound record's fields, but a
 * button on a `/<table>/:id` route always has the record id available as the
 * route param even when the page-level single-record dataSource hasn't injected
 * a `_record`. The route params fill in missing keys (notably `id`); a bound
 * `_record` field always wins. Returns `undefined` when neither source exists,
 * so callers leave the template strings untouched.
 */
export function buildRecordContext(
  record: Readonly<Record<string, unknown>> | undefined,
  routeParams: RouteParams | undefined
): Readonly<Record<string, unknown>> | undefined {
  const hasRecord = record !== undefined && Object.keys(record).length > 0
  const hasParams = routeParams !== undefined && Object.keys(routeParams).length > 0
  if (!hasRecord && !hasParams) return undefined
  return { ...(routeParams ?? {}), ...(record ?? {}) }
}

/**
 * Resolve `$record.*` references inside an automation action's `inputData`.
 *
 * Each string value containing `$record.<field>` is substituted against the
 * record context so the substituted value reaches the automation via the
 * form-action endpoint (`{{trigger.data.body.<key>}}`). Non-string values pass
 * through unchanged. When no context is available, the template strings flow
 * through untouched (they resolve to '' if the field is missing — same coercion
 * as the rest of the platform).
 *
 * Shares the per-string-value loop with `substituteRecordInProps` /
 * `substituteRecordInAction` (via `substituteRecordInInputData`); the `domain`
 * `substituteRecordVars` variant (null → `''`) is injected here.
 */
export function resolveInputDataRecordVars(
  inputData: Record<string, unknown>,
  record: Readonly<Record<string, unknown>> | undefined
): Record<string, unknown> {
  if (record === undefined) return inputData
  return substituteRecordInInputData(inputData, record, substituteRecordVars)
}

/**
 * Build data attributes for automation actions. `data-action-input` carries
 * the JSON-serialized `inputData` (with `$record.*` already substituted) so
 * the client runtime can POST it to the form-action endpoint.
 */
export function buildAutomationDataAttributes(
  action: AutomationAction,
  resolvedInputData: Record<string, unknown> | undefined
): Record<string, string> {
  return {
    'data-action-type': 'automation',
    'data-action-name': action.name,
    'data-action-await': String(action.await ?? false),
    ...(resolvedInputData !== undefined && {
      'data-action-input': JSON.stringify(resolvedInputData),
    }),
    ...(action.onSuccess?.toast?.message && {
      'data-on-success-message': action.onSuccess.toast.message,
    }),
    ...(action.onSuccess?.toast?.variant && {
      'data-on-success-variant': action.onSuccess.toast.variant,
    }),
  }
}

export type AuthButtonAction = {
  type: 'auth'
  method: string
  onSuccess?: { navigate?: string }
}

/**
 * Returns true if the given action is an auth action (e.g. a logout button).
 */
export function isAuthAction(action: unknown): action is AuthButtonAction {
  return (action as { type?: string })?.type === 'auth'
}

/**
 * Build data attributes for an auth-action button (today: logout). The client
 * runtime reads `data-auth-method` to dispatch the Better Auth call and
 * `data-auth-navigate` for the post-action redirect.
 */
export function buildAuthDataAttributes(action: AuthButtonAction): Record<string, string> {
  return {
    'data-action-type': 'auth',
    'data-auth-method': action.method,
    ...(action.onSuccess?.navigate && { 'data-auth-navigate': action.onSuccess.navigate }),
  }
}

/**
 * Returns true if the given action is a CRUD delete action
 */
export function isCrudDeleteAction(action: unknown): action is CrudFormAction {
  return (
    (action as CrudFormAction)?.type === 'crud' &&
    (action as CrudFormAction)?.operation === 'delete'
  )
}

/**
 * The canonical fetch action shape is the domain `FetchActionSchema` type — it
 * carries the full CAP-3 operate vocabulary (`mode`, `confirm`, `confirmMessage`,
 * `filename`, `responseEnvelope`, `redirectKey`, `callbackPath`) the standalone
 * button now serializes wholesale, NOT the prior narrow url/method/headers/body
 * duplicate. Re-exported so `button-renderer.tsx` keeps importing it from here.
 */
export type { FetchAction }

/**
 * Returns true if the given action is a fetch action
 */
export function isFetchAction(action: unknown): action is FetchAction {
  return (action as { type?: string })?.type === 'fetch'
}

/**
 * Build the confirm-gate data attribute(s) overlaid onto a button's element
 * props from the schema's top-level `confirm` field. A STRING confirm rides on
 * `data-confirm` (the prompt); the rich OBJECT form (separate title / dialog role
 * / type-to-confirm input / label overrides) is serialized to `data-confirm-config`
 * so the always-loaded client runtime renders the richer gate. Author-supplied
 * `data-confirm` / `data-confirm-config` props win. Returns an empty object when
 * `confirm` is absent or already present in props.
 */
export function buildConfirmAttributes(
  rawConfirm: unknown,
  elementProps: Record<string, unknown>
): Record<string, string> {
  if (typeof rawConfirm === 'string') {
    return elementProps['data-confirm'] === undefined ? { 'data-confirm': rawConfirm } : {}
  }
  if (rawConfirm !== null && typeof rawConfirm === 'object') {
    return elementProps['data-confirm-config'] === undefined
      ? { 'data-confirm-config': JSON.stringify(rawConfirm) }
      : {}
  }
  return {}
}

/**
 * Build data attributes for a fetch action. Serializes the WHOLE action object
 * as a single `data-action-config` JSON blob so the always-loaded client runtime
 * (`presentation/client.ts`) can hand it verbatim to the shared `executeFetchAction`
 * — which already implements every dispatch `mode` (fetch / navigate / download /
 * oauth) + the `$record.*` resolution. The prior flat-attribute encoding dropped
 * `mode` / `confirm` / `filename`, so a `mode: download` standalone button fired a
 * background GET with no native download; emitting the full config closes that gap.
 * The top-level button `confirm` rides separately on `data-confirm` (overlaid onto
 * the element props by the schema-fallback layer) since it is a button-level gate,
 * not part of the action.
 */
export function buildFetchDataAttributes(action: FetchAction): Record<string, string> {
  return {
    'data-action-type': 'fetch',
    'data-action-config': JSON.stringify(action),
  }
}
