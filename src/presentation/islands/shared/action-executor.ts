/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { dispatch as dispatchIslandEvent } from '../_shared/event-bus'
import type {
  FetchAction,
  FetchResponseEnvelope,
} from '@/domain/models/app/pages/components/action'

export interface FetchActionResult {
  readonly ok: boolean
  readonly status: number
  readonly body: unknown
}

export interface ExecuteFetchActionOptions {
  readonly confirm?: (message: string) => boolean
  readonly renderToast?: (message: string, variant?: string) => void
  readonly record?: Record<string, unknown>
}

const DEFAULT_CONFIRM_MESSAGE = 'Confirmer cette action ?'

const ALWAYS_CONFIRM = (): boolean => true

type ToastSlot = FetchAction['onSuccess']

function bodyHasError(body: unknown): boolean {
  if (typeof body !== 'object' || !body) return false
  return Boolean((body as { readonly error?: unknown }).error)
}

export function evaluateFetchEnvelope(
  envelope: FetchResponseEnvelope,
  status: number,
  body: unknown
): boolean {
  const is2xx = status >= 200 && status < 300
  if (envelope === 'better-auth') return is2xx && !bodyHasError(body)
  return is2xx
}

function resolveConfirm(options: ExecuteFetchActionOptions): (message: string) => boolean {
  if (options.confirm) return options.confirm
  if (typeof window !== 'undefined') return window.confirm.bind(window)
  return ALWAYS_CONFIRM
}

function passesConfirmGate(action: FetchAction, options: ExecuteFetchActionOptions): boolean {
  if (!action.confirm) return true
  return resolveConfirm(options)(action.confirmMessage ?? DEFAULT_CONFIRM_MESSAGE)
}

function renderActionToast(slot: ToastSlot, options: ExecuteFetchActionOptions): void {
  if (slot && options.renderToast) options.renderToast(slot.message, slot.variant)
}

export function applyFetchSuccessEffects(onSuccess: FetchAction['onSuccess']): void {
  if (!onSuccess) return
  const { status } = onSuccess
  if (status && typeof document !== 'undefined') {
    const target = document.getElementById(status.target)
    if (target) {
      target.setAttribute('role', 'status')
      target.setAttribute('aria-label', status.message)
      target.replaceChildren(status.message)
    }
  }
  const { refetch } = onSuccess
  if (refetch) {
    const ids = typeof refetch === 'string' ? [refetch] : refetch
    ids.forEach((id) => dispatchIslandEvent('sovrium:refetch', { id }))
  }
}

function buildRequestInit(
  action: FetchAction,
  record: Record<string, unknown> | undefined
): RequestInit {
  const method = action.method ?? 'GET'
  const body = substituteRecordInBody(action.body, record)
  const hasBody = body !== undefined
  const headers = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(action.headers ?? {}),
  }
  return {
    method,
    credentials: 'include',
    headers,
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  }
}

function emptyBody(): undefined {
  return undefined
}

async function performFetchAction(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): Promise<FetchActionResult> {
  const envelope = action.responseEnvelope ?? 'sovrium'
  const url = substituteRecord(action.url, options.record)
  try {
    const res = await fetch(url, buildRequestInit(action, options.record))
    const body = await res.json().catch(emptyBody)
    const ok = evaluateFetchEnvelope(envelope, res.status, body)
    renderActionToast(ok ? action.onSuccess : action.onError, options)
    if (ok) applyFetchSuccessEffects(action.onSuccess)
    return { ok, status: res.status, body }
  } catch {
    renderActionToast(action.onError, options)
    return { ok: false, status: 0, body: undefined }
  }
}

const RECORD_FIELD_PATTERN = /\$record\.(\w+)/g

function substituteRecord(template: string, record: Record<string, unknown> | undefined): string {
  if (record === undefined || !template.includes('$record.')) return template
  return template.replaceAll(RECORD_FIELD_PATTERN, (_full, field: string) => {
    const cell = record[field]
    return cell === undefined ? '' : String(cell)
  })
}

function substituteRecordInBody(
  body: FetchAction['body'],
  record: Record<string, unknown> | undefined
): FetchAction['body'] {
  if (body === undefined || record === undefined) return body
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => [
      key,
      typeof value === 'string' ? substituteRecord(value, record) : value,
    ])
  )
}

const DISPATCHED: FetchActionResult = { ok: true, status: 0, body: undefined }

function performNavigate(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): FetchActionResult {
  const url = substituteRecord(action.url, options.record)
  if (typeof window !== 'undefined') window.location.assign(url)
  return DISPATCHED
}

function saveBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.setAttribute('href', objectUrl)
  anchor.setAttribute('download', filename)
  anchor.setAttribute('style', 'display:none')
  document.body.append(anchor)
  anchor.click()
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
    anchor.remove()
  }, 0)
}

async function performDownload(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): Promise<FetchActionResult> {
  const url = substituteRecord(action.url, options.record)
  const filename = action.filename ? substituteRecord(action.filename, options.record) : ''
  try {
    const res = await fetch(url, { method: 'GET', credentials: 'include' })
    if (!res.ok) return { ok: false, status: res.status, body: undefined }
    saveBlob(await res.blob(), filename)
    applyFetchSuccessEffects(action.onSuccess)
    return { ok: true, status: res.status, body: undefined }
  } catch {
    return { ok: false, status: 0, body: undefined }
  }
}

const DEFAULT_REDIRECT_KEY = 'url'

function readRedirectDestination(
  body: unknown,
  redirectKey: string | undefined
): string | undefined {
  if (typeof body !== 'object' || !body) return undefined
  const value = (body as Record<string, unknown>)[redirectKey ?? DEFAULT_REDIRECT_KEY]
  return typeof value === 'string' ? value : undefined
}

async function performOauth(
  action: FetchAction,
  options: ExecuteFetchActionOptions
): Promise<FetchActionResult> {
  const url = substituteRecord(action.url, options.record)
  try {
    const res = await fetch(url, buildRequestInit(action, options.record))
    const body = await res.json().catch(emptyBody)
    if (!res.ok) return { ok: false, status: res.status, body }
    const destination = readRedirectDestination(body, action.redirectKey)
    if (destination !== undefined && typeof window !== 'undefined') {
      window.location.assign(destination)
    }
    return { ok: destination !== undefined, status: res.status, body }
  } catch {
    return { ok: false, status: 0, body: undefined }
  }
}

export async function executeFetchAction(
  action: FetchAction,
  options: ExecuteFetchActionOptions = {}
): Promise<FetchActionResult | undefined> {
  if (!passesConfirmGate(action, options)) return undefined
  const mode = action.mode ?? 'fetch'
  if (mode === 'fetch') return performFetchAction(action, options)
  if (mode === 'navigate') return performNavigate(action, options)
  if (mode === 'download') return performDownload(action, options)
  if (mode === 'oauth') return performOauth(action, options)
  return undefined
}
