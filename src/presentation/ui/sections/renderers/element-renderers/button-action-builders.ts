/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { substituteRecordVars } from '@/domain/utils/substitute-record-vars'
import { substituteRecordInInputData } from '@/presentation/rendering/record-template-substitution'
import type { CrudFormAction } from './crud-form-renderer'
import type { RouteParams } from '@/domain/utils/matching/route-matcher'

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

export function isAutomationAction(action: unknown): action is AutomationAction {
  return (action as { type?: string })?.type === 'automation'
}

export function buildRecordContext(
  record: Readonly<Record<string, unknown>> | undefined,
  routeParams: RouteParams | undefined
): Readonly<Record<string, unknown>> | undefined {
  const hasRecord = record !== undefined && Object.keys(record).length > 0
  const hasParams = routeParams !== undefined && Object.keys(routeParams).length > 0
  if (!hasRecord && !hasParams) return undefined
  return { ...(routeParams ?? {}), ...(record ?? {}) }
}

export function resolveInputDataRecordVars(
  inputData: Record<string, unknown>,
  record: Readonly<Record<string, unknown>> | undefined
): Record<string, unknown> {
  if (record === undefined) return inputData
  return substituteRecordInInputData(inputData, record, substituteRecordVars)
}

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

export function isAuthAction(action: unknown): action is AuthButtonAction {
  return (action as { type?: string })?.type === 'auth'
}

export function buildAuthDataAttributes(action: AuthButtonAction): Record<string, string> {
  return {
    'data-action-type': 'auth',
    'data-auth-method': action.method,
    ...(action.onSuccess?.navigate && { 'data-auth-navigate': action.onSuccess.navigate }),
  }
}

export function isCrudDeleteAction(action: unknown): action is CrudFormAction {
  return (
    (action as CrudFormAction)?.type === 'crud' &&
    (action as CrudFormAction)?.operation === 'delete'
  )
}

export type FetchToastResponse = {
  type: 'toast'
  message: string
  variant?: string
  duration?: number
  actionLabel?: string
  actionUrl?: string
}

export type FetchAction = {
  type: 'fetch'
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: Record<string, unknown>
  onSuccess?: FetchToastResponse
  onError?: FetchToastResponse
}

export function isFetchAction(action: unknown): action is FetchAction {
  return (action as { type?: string })?.type === 'fetch'
}

export function buildFetchDataAttributes(action: FetchAction): Record<string, string> {
  return {
    'data-action-type': 'fetch',
    'data-action-url': action.url,
    'data-action-method': action.method ?? 'GET',
    ...(action.headers && { 'data-action-headers': JSON.stringify(action.headers) }),
    ...(action.body && { 'data-action-body': JSON.stringify(action.body) }),
    ...(action.onSuccess && { 'data-on-success': JSON.stringify(action.onSuccess) }),
    ...(action.onError && { 'data-on-error': JSON.stringify(action.onError) }),
  }
}
