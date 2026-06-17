/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



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

function parseToastResponse(raw: string | null): FetchToastResponse | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      return parsed as FetchToastResponse
    }
    return undefined
  } catch {
    return undefined
  }
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

function setupFetchButtonHandlers(): void {
  bindActionButtons('fetch', async (button) => {
    const url = button.getAttribute('data-action-url')
    if (!url) return
    const method = button.getAttribute('data-action-method') ?? 'GET'
    const headersRaw = button.getAttribute('data-action-headers')
    const bodyRaw = button.getAttribute('data-action-body')
    const onSuccess = parseToastResponse(button.getAttribute('data-on-success'))
    const onError = parseToastResponse(button.getAttribute('data-on-error'))

    const headers: Record<string, string> = headersRaw
      ? (JSON.parse(headersRaw) as Record<string, string>)
      : {}
    const init: RequestInit = { method, headers }
    if (bodyRaw) {
      init.body = bodyRaw
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
    }

    try {
      const response = await fetch(url, init)
      if (response.ok) {
        dispatchToastResponse(onSuccess)
      } else {
        dispatchToastResponse(onError)
      }
    } catch {
      dispatchToastResponse(onError)
    }
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClientRuntime)
} else {
  initClientRuntime()
}
