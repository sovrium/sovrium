/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The client runtime's `core` feature, lazily imported by `islands/client.ts`
 * (`/assets/client.js`) and split into `/assets/client-chunks/`. It initializes
 * on evaluation, once per document. Provides modal lifecycle, toast
 * notifications, and filter form handling.
 *
 * Auth and CRUD form handling has been migrated to React islands:
 * - AuthFormIsland (src/presentation/islands/auth-form-island.tsx)
 * - CrudFormIsland (src/presentation/islands/crud-form-island.tsx)
 *
 * This script handles remaining non-island interactivity:
 * - Modal open/close lifecycle (data-modal-trigger, Escape key, backdrop click)
 * - Toast notifications
 * - Filter/search/sort form submission (URL param updates)
 * - Standalone `type: 'fetch'` button dispatch (incl. its dispatch modes +
 *   the inline confirm gate) via the shared `executeFetchAction` runtime
 * - The `fill` action, from a button or an island's `sovrium:fill` event
 *
 * Everything here binds through {@link delegate} — one listener on `document`,
 * matched per event — rather than by sweeping the document for elements at load
 * and attaching to each. Read that function before adding a handler: the
 * distinction is what decides whether a control keeps working after the markup
 * around it is replaced.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { setupAwaitingScriptControls } from '@/presentation/islands/runtime/awaiting-script-controls'
import { setupEndpointFormHandlers } from '@/presentation/islands/runtime/endpoint-form-runtime'
import { setupNativeSelectPublishers } from '@/presentation/islands/runtime/native-select-publisher'
import { hydrateSessionBindings } from '@/presentation/islands/runtime/session-resolver'
import { delegate, bindActionButtons, parseActionInput } from './client-event-delegate'
import { showToast } from './client-toast'
import { dispatchToastResponse, setupFetchButtonHandlers } from './fetch-button-runtime'
import { setupFillHandlers } from './fill-runtime'

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
  delegate<HTMLElement>('click', '[data-modal-trigger]', (trigger) => {
    const modalId = trigger.getAttribute('data-modal-trigger')
    if (modalId) openModal(modalId)
  })

  // The INVERSE of the lookup this replaces. That one walked dialog → parent →
  // backdrop and bound there, which needs the dialog to already exist. A click
  // hands us the backdrop instead, so the dialog is looked up beside it — the
  // same parent, the same pair, resolved at the moment it is needed.
  delegate<HTMLElement>('click', '[data-backdrop]', (backdrop) => {
    const dialog = backdrop.parentElement?.querySelector<HTMLElement>('[role="dialog"]')
    if (dialog) closeModal(dialog)
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
  // The form comes from the MATCH, not from `event.currentTarget`: under
  // delegation `currentTarget` is the document, and reading the form off it is
  // how a delegated handler silently starts submitting the wrong thing.
  delegate<HTMLFormElement>('submit', 'form[data-action-type="filter"]', (form, event) => {
    event.preventDefault()
    const actionMethod = form.getAttribute('data-action-method') || 'search'
    handleFilterAction(actionMethod, Object.fromEntries(new FormData(form)))
  })
}

function setupAutomationButtonHandlers(): void {
  bindActionButtons('automation', async (button) => {
    const name = button.getAttribute('data-action-name')
    if (!name) return
    const awaitValue = button.getAttribute('data-action-await') === 'true'
    const successMessage = button.getAttribute('data-on-success-message')
    const successVariant = button.getAttribute('data-on-success-variant') ?? undefined
    const inputData = parseActionInput(button.getAttribute('data-action-input'))

    // Fire-and-forget: surface the onSuccess toast immediately, before the
    // automation completes (await: false). The awaited path shows it only
    // after a successful response.
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
      // Network/dispatch failure: the automation did not run. The
      // fire-and-forget toast (if any) was already shown; an awaited
      // success toast is intentionally suppressed on failure.
    }
  })
}

// ─── Auth button handling (logout) ───────────────────────────────────────────

function setupAuthButtonHandlers(): void {
  bindActionButtons('auth', async (button) => {
    const method = button.getAttribute('data-auth-method')
    // Only the logout flow is button-driven; login/signup/reset are form-based
    // and handled by the auth-form island.
    if (method !== 'logout') return
    const navigate = button.getAttribute('data-auth-navigate')
    try {
      // Better Auth sign-out endpoint clears the session cookie. Using the
      // same-origin endpoint directly keeps the always-loaded client bundle
      // free of the better-auth/client dependency.
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    } finally {
      // The target comes off a DOM attribute, so what reaches `location` is a
      // path the URL parser REBUILT — never the attribute itself. A bare
      // leading-slash test would let `//evil.com` through as a
      // protocol-relative URL.
      const target = toSafeRedirectPath(navigate)
      if (target !== undefined) {
        window.location.assign(target)
      }
    }
  })
}

// ─── Session-bound chrome (client-side identity resolution) ───────────────────

/**
 * Fill every session-bound marker on the page with the SIGNED-IN caller's OWN
 * values — `data-session-template` text and `data-session-avatar` discs alike.
 *
 * Resolution stays CLIENT-side, from the caller's own session, and an anonymous
 * caller resolves to the EMPTY string. That is the security invariant rather
 * than an implementation detail: a page carrying a server-resolved identity is
 * cacheable, and a cached identity is one user's name served to the next.
 *
 * The work itself lives in `session-resolver.ts`, beside the fetch, so a
 * surface that mounts AFTER this page-load pass — a lazily-hydrated island
 * injecting its own trigger content — re-runs the same fill instead of growing
 * a second one.
 */
function setupSessionBoundChrome(): void {
  hydrateSessionBindings(document)
}

/**
 * A form's toast the server drew on the page its document POST landed on
 * (`api/runtime/form-flash.ts`), handed to the runtime's own toast so it is
 * timed and dismissible like any other.
 */
function adoptFormFlashToasts(): void {
  document.querySelectorAll<HTMLElement>('[data-toast][data-form-flash]').forEach((flash) => {
    const message = flash.querySelector('[data-toast-message]')?.textContent ?? ''
    const { variant } = flash.dataset
    flash.remove()
    if (message !== '') showToast(message, variant === undefined ? {} : { variant })
  })
}

// ─── Initialization ─────────────────────────────────────────────────────────

function initClientRuntime(): void {
  setupFilterFormHandlers()
  setupModalHandlers()
  setupAutomationButtonHandlers()
  setupAuthButtonHandlers()
  setupFetchButtonHandlers()
  setupFillHandlers()
  setupEndpointFormHandlers(dispatchToastResponse)
  setupSessionBoundChrome()
  setupNativeSelectPublishers()
  adoptFormFlashToasts()
  setupAwaitingScriptControls()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClientRuntime)
} else {
  initClientRuntime()
}
