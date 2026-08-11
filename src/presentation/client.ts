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
 * - Standalone `type: 'fetch'` button dispatch (incl. CAP-3 dispatch modes +
 *   the inline confirm gate) via the shared `executeFetchAction` runtime
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

// ─── Toast rendering ────────────────────────────────────────────────────────

// NOTE: this `showToast` (the `[data-sonner-toaster]` container variant) is
// intentionally NOT shared with `form-runtime.tsx`'s `renderToast`. That toast
// lives inside the `FORM_RUNTIME_SCRIPT` string-literal IIFE shipped verbatim
// as SSR source (no module system at its runtime), emits a different DOM shape
// (`data-form-toast`/`form-toast`), and its self-contained ~1.5 KB design is a
// documented FCP/byte-budget choice (see form-runtime.tsx header). Sharing
// would break that self-containment, so the two stay separate by design.

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

// ─── Action button binding (shared) ──────────────────────────────────────────

/**
 * Bind a click handler to every `button[data-action-type="<type>"]`. Shared by
 * the automation / auth / fetch button setups, which differ only in their
 * per-button click body — the querySelectorAll → forEach → addEventListener
 * boilerplate was triplicated.
 */
function bindActionButtons(actionType: string, onClick: (button: HTMLButtonElement) => void): void {
  document
    .querySelectorAll<HTMLButtonElement>(`button[data-action-type="${actionType}"]`)
    .forEach((button) => {
      button.addEventListener('click', () => {
        onClick(button)
      })
    })
}

// ─── Automation button handling ──────────────────────────────────────────────

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
      if (navigate && navigate.startsWith('/')) {
        window.location.assign(navigate)
      }
    }
  })
}

// ─── Fetch button handling ──────────────────────────────────────────────────

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

/**
 * Parse the `data-action-config` blob into a `FetchAction`. The standalone
 * button serializes the WHOLE action object (mode / confirm / filename / …) as a
 * single JSON attribute, so the client hands it verbatim to the shared executor
 * instead of reconstructing the request from flat attributes.
 */
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

/** Build a styled gate button (the confirm / cancel affordance) for the inline alertdialog. */
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

/**
 * The inline destructive-confirm `alertdialog` shown when a standalone fetch
 * button carries a top-level `confirm`. Mirrors the data-table per-row gate
 * (`islands/data-table/action-cell.tsx`): a non-modal `role="alertdialog"`
 * (plain `<div>`, never inerts the page) whose accessible name IS the prompt and
 * whose confirm affordance re-uses the button's label; confirming dispatches,
 * cancelling dismisses the gate WITHOUT firing the action. The trigger button
 * stays in the DOM so the gate can be re-opened after a cancel.
 */
function openFetchConfirmGate(
  trigger: HTMLButtonElement,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
): void {
  // Guard against stacking a second gate when the trigger is clicked twice.
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

    // Dispatch through the SHARED action runtime so every CAP-3 mode (the default
    // `fetch`, plus `navigate` / `download` / `oauth`) behaves identically to the
    // data-table action path. No `renderToast` is injected: the executor reports
    // success via its returned `{ ok }`, and the rich `onSuccess` / `onError`
    // toast (incl. `duration` / `actionLabel` / `actionUrl`) is rendered here so
    // those fields — which the executor's bare `renderToast(message, variant)`
    // would drop — are preserved. The executor itself applies the additive
    // `onSuccess.status` / `onSuccess.refetch` client-state effects on success.
    const dispatch = async (): Promise<void> => {
      const result = await executeFetchAction(config)
      if (result) dispatchToastResponse(result.ok ? config.onSuccess : config.onError)
    }

    // A top-level button `confirm` rides on `data-confirm` (string form) or
    // `data-confirm-config` (object form). It is a button-level gate distinct from
    // the action's own `confirm` flag, so it opens the inline gate before dispatch.
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

// ─── Custom-endpoint form handling (form.endpoint) ───────────────────────────

/** The `data-endpoint-config` blob serialized by `renderEndpointForm`. */
type EndpointFormConfig = {
  url: string
  method?: string
  responseEnvelope?: string
  onSuccess?: FetchToastResponse
  onError?: FetchToastResponse
}

/** Parse the `data-endpoint-config` JSON attribute into a config object. */
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

/**
 * Bind the submit of every endpoint-bound form (`form[data-action-type="endpoint"]`,
 * emitted by `renderEndpointForm`). On submit: collect the form's `FormData` into a
 * JSON body, build a `type: 'fetch'` action carrying those values, and dispatch it
 * through the SHARED `executeFetchAction` — so the response-envelope evaluation,
 * the `onSuccess`/`onError` toast, and the additive `onSuccess` `status`/`refetch`
 * client-state effects (a sibling directory grid refreshes) all behave identically
 * to the standalone fetch button. No `renderToast` is injected: the rich toast
 * (incl. `duration`/`actionLabel`/`actionUrl`) is rendered here from the returned
 * `{ ok }`, exactly as the fetch-button path does.
 */
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

// ─── Session-bound text (client-side identity resolution) ─────────────────────

/**
 * Fill every `data-session-template` element with the SIGNED-IN caller's OWN
 * session value. The template's
 * `$session.<field>` tokens are resolved CLIENT-SIDE from the caller's session;
 * an anonymous caller resolves to the EMPTY string (the security invariant — no
 * identity leaks, no static cross-user value). Fetches the session ONCE and
 * applies it to every marked element; a no-op when none exist.
 */
function setupSessionBoundText(): void {
  const elements = document.querySelectorAll<HTMLElement>('[data-session-template]')
  if (elements.length === 0) return
  void fetchSessionUser().then((user) => {
    elements.forEach((el) => {
      const template = el.getAttribute('data-session-template')
      if (template === null) return
      // `replaceChildren` (a method call) sets the text without a property
      // assignment to the forEach element (no-param-reassign clean).
      el.replaceChildren(resolveSessionTemplate(template, user))
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
