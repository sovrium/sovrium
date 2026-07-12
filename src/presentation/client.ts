/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { executeFetchAction } from '@/presentation/islands/shared/action-executor'
import {
  openFetchConfirmObjectGate,
  parseConfirmObjectConfig,
} from '@/presentation/islands/shared/confirm-gate-runtime'
import {
  fetchSessionUser,
  resolveSessionTemplate,
} from '@/presentation/islands/shared/session-resolver'
import type { FetchAction } from '@/domain/models/app/pages/components/action'


function openModal(modalId: string): void {
  const modal = document.getElementById(modalId)
  if (!modal) return
  const dialog = modal.querySelector('[role="dialog"]') || modal
  dialog.removeAttribute('hidden')
  dialog.setAttribute('aria-hidden', 'false')
  const focusable = dialog.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  focusable?.focus()
}

function closeModal(dialog: HTMLElement): void {
  dialog.setAttribute('hidden', '')
  dialog.setAttribute('aria-hidden', 'true')
}

function setupModalHandlers(): void {
  document.querySelectorAll('[data-modal-trigger]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const modalId = trigger.getAttribute('data-modal-trigger')
      if (modalId) openModal(modalId)
    })
  })

  document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
    const backdrop = dialog.parentElement?.querySelector('[data-backdrop]')
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        closeModal(dialog as HTMLElement)
      })
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const openDialog = document.querySelector('[role="dialog"]:not([hidden])')
      if (openDialog) closeModal(openDialog as HTMLElement)
    }
  })
}


function applySearchFilter(url: URL, data: Record<string, FormDataEntryValue>): void {
  const query = String(data.q || data.query || '')
  if (query) {
    url.searchParams.set('q', query)
  } else {
    url.searchParams.delete('q')
  }
  url.searchParams.set('page', '1')
}

function applySortFilter(url: URL, data: Record<string, FormDataEntryValue>): void {
  const sortBy = String(data.sortBy || '')
  const sortOrder = String(data.sortOrder || 'asc')
  if (sortBy) {
    url.searchParams.set('sortBy', sortBy)
    url.searchParams.set('sortOrder', sortOrder)
  }
}

function handleFilterAction(method: string, data: Record<string, FormDataEntryValue>): void {
  const url = new URL(window.location.href)

  switch (method) {
    case 'search':
      applySearchFilter(url, data)
      break
    case 'sort':
      applySortFilter(url, data)
      break
    case 'paginate':
      url.searchParams.set('page', String(data.page || '1'))
      break
    default:
      console.warn(`[sovrium] Unknown filter method: ${method}`)
      return
  }

  window.location.href = url.toString()
}


function setupFilterFormHandlers(): void {
  document.querySelectorAll('form[data-action-type="filter"]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const formEl = event.currentTarget as HTMLFormElement
      const actionMethod = formEl.getAttribute('data-action-method') || 'search'
      const formData = new FormData(formEl)
      handleFilterAction(actionMethod, Object.fromEntries(formData))
    })
  })
}



type ToastOptions = {
  variant?: string
  duration?: number
  actionLabel?: string
  actionUrl?: string
}

function ensureToastContainer(): Element {
  let container = document.querySelector('[data-sonner-toaster]')
  if (!container) {
    container = document.createElement('div')
    container.setAttribute('data-sonner-toaster', '')
    container.setAttribute('role', 'status')
    container.setAttribute('aria-live', 'polite')
    const el = container as HTMLElement
    el.style.position = 'fixed'
    el.style.bottom = '16px'
    el.style.right = '16px'
    el.style.zIndex = '9999'
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.gap = '8px'
    document.body.appendChild(container)
  }
  return container
}

function showToast(message: string, options: ToastOptions = {}): void {
  const container = ensureToastContainer()
  const toast = document.createElement('div')
  toast.setAttribute('data-toast', '')
  if (options.variant) toast.setAttribute('data-variant', options.variant)

  const messageSpan = document.createElement('span')
  messageSpan.textContent = message
  toast.appendChild(messageSpan)

  if (options.actionLabel && options.actionUrl) {
    const actionBtn = document.createElement('button')
    actionBtn.type = 'button'
    actionBtn.textContent = options.actionLabel
    const { actionUrl } = options
    actionBtn.addEventListener('click', () => {
      void fetch(actionUrl, { method: 'POST' }).finally(() => {
        toast.remove()
      })
    })
    toast.appendChild(actionBtn)
  }

  container.appendChild(toast)

  if (options.duration && options.duration > 0) {
    window.setTimeout(() => {
      toast.remove()
    }, options.duration)
  }
}


function bindActionButtons(actionType: string, onClick: (button: HTMLButtonElement) => void): void {
  document
    .querySelectorAll<HTMLButtonElement>(`button[data-action-type="${actionType}"]`)
    .forEach((button) => {
      button.addEventListener('click', () => {
        onClick(button)
      })
    })
}


function parseActionInput(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}

function setupAutomationButtonHandlers(): void {
  bindActionButtons('automation', async (button) => {
    const name = button.getAttribute('data-action-name')
    if (!name) return
    const awaitValue = button.getAttribute('data-action-await') === 'true'
    const successMessage = button.getAttribute('data-on-success-message')
    const successVariant = button.getAttribute('data-on-success-variant') ?? undefined
    const inputData = parseActionInput(button.getAttribute('data-action-input'))

    if (!awaitValue && successMessage) {
      showToast(successMessage, { variant: successVariant })
    }

    try {
      const response = await fetch(`/api/automations/${encodeURIComponent(name)}/form-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputData }),
      })
      if (response.ok && awaitValue && successMessage) {
        showToast(successMessage, { variant: successVariant })
      }
    } catch {
    }
  })
}


function setupAuthButtonHandlers(): void {
  bindActionButtons('auth', async (button) => {
    const method = button.getAttribute('data-auth-method')
    if (method !== 'logout') return
    const navigate = button.getAttribute('data-auth-navigate')
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    } finally {
      if (navigate && navigate.startsWith('/')) {
        window.location.assign(navigate)
      }
    }
  })
}


type FetchToastResponse = {
  type: 'toast'
  message: string
  variant?: string
  duration?: number
  actionLabel?: string
  actionUrl?: string
}

function dispatchToastResponse(response: FetchToastResponse | undefined): void {
  if (!response) return
  showToast(response.message, {
    variant: response.variant,
    duration: response.duration,
    actionLabel: response.actionLabel,
    actionUrl: response.actionUrl,
  })
}

function parseFetchActionConfig(raw: string | null): FetchAction | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && (parsed as { type?: unknown }).type === 'fetch') {
      return parsed as FetchAction
    }
    return undefined
  } catch {
    return undefined
  }
}

function createGateButton(opts: {
  label: string
  className: string
  ariaLabel?: string
  onClick: () => void
}): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = opts.className
  if (opts.ariaLabel) btn.setAttribute('aria-label', opts.ariaLabel)
  btn.textContent = opts.label
  btn.addEventListener('click', opts.onClick)
  return btn
}

function openFetchConfirmGate(
  trigger: HTMLButtonElement,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
): void {
  if (trigger.nextElementSibling?.hasAttribute('data-confirm-dialog')) return

  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'alertdialog')
  dialog.setAttribute('aria-modal', 'false')
  dialog.setAttribute('aria-label', message)
  dialog.setAttribute('data-confirm-dialog', '')
  dialog.className =
    'border-border bg-background-raised mt-2 flex items-center gap-2 rounded-md border p-2'

  const messageSpan = document.createElement('span')
  messageSpan.className = 'text-foreground-subtle text-xs'
  messageSpan.textContent = message
  dialog.appendChild(messageSpan)

  dialog.appendChild(
    createGateButton({
      label: confirmLabel,
      className:
        'bg-error-bg text-error-fg rounded-md px-2 py-1 text-xs font-medium transition-opacity hover:opacity-90',
      onClick: () => {
        dialog.remove()
        onConfirm()
      },
    })
  )
  dialog.appendChild(
    createGateButton({
      label: 'Annuler',
      ariaLabel: 'Annuler',
      className:
        'border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-2 py-1 text-xs transition-colors',
      onClick: () => dialog.remove(),
    })
  )

  trigger.insertAdjacentElement('afterend', dialog)
}

function setupFetchButtonHandlers(): void {
  bindActionButtons('fetch', (button) => {
    const config = parseFetchActionConfig(button.getAttribute('data-action-config'))
    if (!config) return

    const dispatch = async (): Promise<void> => {
      const result = await executeFetchAction(config)
      if (result) dispatchToastResponse(result.ok ? config.onSuccess : config.onError)
    }

    const confirmObject = parseConfirmObjectConfig(button.getAttribute('data-confirm-config'))
    if (confirmObject) {
      openFetchConfirmObjectGate(button, confirmObject, () => void dispatch())
      return
    }
    const confirmMessage = button.getAttribute('data-confirm')
    if (confirmMessage) {
      const confirmLabel =
        button.getAttribute('data-confirm-label') ?? button.textContent?.trim() ?? 'Confirmer'
      openFetchConfirmGate(button, confirmMessage, confirmLabel, () => void dispatch())
      return
    }

    void dispatch()
  })
}


type EndpointFormConfig = {
  url: string
  method?: string
  responseEnvelope?: string
  onSuccess?: FetchToastResponse
  onError?: FetchToastResponse
}

function parseEndpointFormConfig(raw: string | null): EndpointFormConfig | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as EndpointFormConfig).url === 'string'
    ) {
      return parsed as EndpointFormConfig
    }
    return undefined
  } catch {
    return undefined
  }
}

function setupEndpointFormHandlers(): void {
  document
    .querySelectorAll<HTMLFormElement>('form[data-action-type="endpoint"]')
    .forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault()
        const config = parseEndpointFormConfig(form.getAttribute('data-endpoint-config'))
        if (!config) return
        const body = Object.fromEntries(new FormData(form)) as Record<string, unknown>
        const action = {
          type: 'fetch',
          url: config.url,
          method: config.method ?? 'POST',
          body,
          ...(config.responseEnvelope && { responseEnvelope: config.responseEnvelope }),
          ...(config.onSuccess && { onSuccess: config.onSuccess }),
          ...(config.onError && { onError: config.onError }),
        } as FetchAction
        void executeFetchAction(action).then((result) => {
          if (result) dispatchToastResponse(result.ok ? config.onSuccess : config.onError)
        })
      })
    })
}


function setupSessionBoundText(): void {
  const elements = document.querySelectorAll<HTMLElement>('[data-session-template]')
  if (elements.length === 0) return
  void fetchSessionUser().then((user) => {
    elements.forEach((el) => {
      const template = el.getAttribute('data-session-template')
      if (template === null) return
      el.replaceChildren(resolveSessionTemplate(template, user))
    })
  })
}


function setupIslandFormGuards(): void {
  document
    .querySelectorAll<HTMLFormElement>('[data-island] form[data-action-type]')
    .forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault()
      })
    })
}


function initClientRuntime(): void {
  setupFilterFormHandlers()
  setupModalHandlers()
  setupIslandFormGuards()
  setupAutomationButtonHandlers()
  setupAuthButtonHandlers()
  setupFetchButtonHandlers()
  setupEndpointFormHandlers()
  setupSessionBoundText()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClientRuntime)
} else {
  initClientRuntime()
}
