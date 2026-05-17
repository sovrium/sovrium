/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Client-Side Runtime Entry Point
 *
 * Bundled via Bun.build() and served at /assets/client.js.
 * Provides modal lifecycle, toast notifications, and filter form handling.
 *
 * Auth and CRUD form handling has been migrated to React islands:
 * - AuthFormIsland (src/presentation/islands/auth-form-island.tsx)
 * - CrudFormIsland (src/presentation/islands/crud-form-island.tsx)
 *
 * This script handles remaining non-island interactivity:
 * - Modal open/close lifecycle (data-modal-trigger, Escape key, backdrop click)
 * - Toast notifications
 * - Filter/search/sort form submission (URL param updates)
 */

// ─── Modal lifecycle ────────────────────────────────────────────────────────

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

// ─── Filter/search/sort form handling ───────────────────────────────────────

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

// ─── Form dispatch (filter only) ────────────────────────────────────────────

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

// ─── Automation button handling ──────────────────────────────────────────────

function showToast(message: string, variant?: string): void {
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
  const toast = document.createElement('div')
  toast.setAttribute('data-toast', '')
  if (variant) toast.setAttribute('data-variant', variant)
  toast.textContent = message
  container.appendChild(toast)
}

function setupAutomationButtonHandlers(): void {
  document
    .querySelectorAll<HTMLButtonElement>('button[data-action-type="automation"]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const awaitValue = button.getAttribute('data-action-await') === 'true'
        const successMessage = button.getAttribute('data-on-success-message')
        const successVariant = button.getAttribute('data-on-success-variant') ?? undefined
        if (!awaitValue && successMessage) {
          showToast(successMessage, successVariant)
        }
      })
    })
}

// ─── Island form guard (prevent native submission before island hydration) ──

function setupIslandFormGuards(): void {
  document
    .querySelectorAll<HTMLFormElement>('[data-island] form[data-action-type]')
    .forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault()
      })
    })
}

// ─── Initialization ─────────────────────────────────────────────────────────

function initClientRuntime(): void {
  setupFilterFormHandlers()
  setupModalHandlers()
  setupIslandFormGuards()
  setupAutomationButtonHandlers()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClientRuntime)
} else {
  initClientRuntime()
}
