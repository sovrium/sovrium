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
 *
 * Everything here binds through {@link delegate} — one listener on `document`,
 * matched per event — rather than by sweeping the document for elements at load
 * and attaching to each. Read that function before adding a handler: the
 * distinction is what decides whether a control keeps working after the markup
 * around it is replaced.
 */

import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { executeFetchAction } from '@/presentation/islands/runtime/action-executor'
import {
  openFetchConfirmObjectGate,
  parseConfirmObjectConfig,
  resolveGateLabels,
} from '@/presentation/islands/runtime/confirm-gate-runtime'
import { setupNativeSelectPublishers } from '@/presentation/islands/runtime/native-select-publisher'
import { hydrateSessionBindings } from '@/presentation/islands/runtime/session-resolver'
import {
  appendToastDismissControl,
  appendToastMessage,
  markToastPoliteness,
  resolveToastDismissLabel,
} from '@/presentation/islands/runtime/toast-accessibility'
import { resolveToastDuration } from '@/presentation/islands/runtime/toast-duration'
import type { FetchAction } from '@/domain/models/app/pages/components/action'

// ─── Event delegation (the one binding strategy) ─────────────────────────────

/**
 * Run `handler` for every element matching `selector` — one already in the
 * document, or one that arrives later.
 *
 * ONE listener is registered on `document`, once, and the match is made per
 * event by walking up from the event target. Nothing is ever bound to an
 * element, so nothing is lost when an element is REPLACED.
 *
 * That last sentence is the whole reason this exists. A page region bound to a
 * data source is re-read by swapping its markup when an action names it
 * (`refetch-server-rendered-region.ts`), and every handler this runtime used to
 * attach by sweeping the document once at `DOMContentLoaded` died with the
 * nodes it was attached to. A confirm-gated button came back from a refresh
 * carrying its configuration and no listener, so clicking it did nothing at all
 * — no dialog, and no action either. Every other sweep on that seam had the
 * same hole, silently: the action buttons, the custom-endpoint form, the filter
 * form, the native-select publisher.
 *
 * Delegation is already how the rest of the page behaves. The inline click,
 * theme-toggle, copy-code and marquee runtimes in `page-body-scripts.tsx` are
 * each one document listener plus a `closest()`, which is exactly why they kept
 * working across a refresh while this module did not.
 *
 * Re-binding the swapped subtree was the alternative, and it is the worse one:
 * a second pass over a node that is already bound fires its action twice, so it
 * stays correct only as long as every binder remembers to mark what it has
 * already bound. Here there is no second pass and nothing to mark — the
 * idempotence is structural rather than maintained.
 *
 * One consequence worth knowing before adding a selector: a delegated handler
 * also matches nodes an ISLAND rendered, which a load-time sweep never saw.
 * Every handler below is therefore keyed on a configuration attribute only the
 * server's own element renderers emit (`data-action-config`, `data-action-name`,
 * `data-auth-method`, `data-endpoint-config`) and bails without it, so an
 * island's own React `onClick` can never be doubled by one of these.
 *
 * BUBBLE, not capture — deliberately, and the other way round from the outbound
 * click delegate in `[internal ref]`. That one captures so a
 * `stopPropagation()` cannot drop a link from its report; it is a passive
 * observer and owes nothing to ordering. These handlers own their control's
 * behaviour, so they must keep running exactly where the per-element listeners
 * they replace ran — after anything nearer the target. Every `stopPropagation`
 * in this codebase is inside an island, on React-rendered nodes that carry none
 * of the attributes above, so capture would buy immunity to a collision that
 * cannot occur and pay for it by reordering the handlers that can.
 */
function delegate<E extends Element>(
  type: 'click' | 'submit' | 'change',
  selector: string,
  handler: (element: E, event: Event) => void
): void {
  document.addEventListener(type, (event) => {
    const { target } = event
    if (!(target instanceof Element)) return
    const element = target.closest<E>(selector)
    if (element) handler(element, event)
  })
}

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

  // A failure interrupts; everything else waits its turn. Set BEFORE insertion,
  // so assistive technology sees an alert at the moment the toast arrives.
  markToastPoliteness(toast, options.variant)

  // This renderer already wrapped its message in a span. Marking that span is
  // the whole of the message-node contract here — the three other renderers had
  // to grow one, because a dismiss control inside `[data-toast]` joins the
  // element's `textContent` and merges with a bare text node.
  appendToastMessage(toast, message)

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

  // Dismissal is the shared policy, never a local rule: an explicit `duration`
  // wins, an error/destructive toast persists, a toast that really rendered an
  // action button persists, everything else expires on the documented default.
  // `hasAction` mirrors the condition that built the button above — an
  // `actionLabel` with no `actionUrl` renders nothing, so it must not buy
  // persistence for a toast the reader has no control to act on.
  const dismissAfter = resolveToastDuration({
    duration: options.duration,
    variant: options.variant,
    hasAction: Boolean(options.actionLabel && options.actionUrl),
  })

  // A toast that never expires gets the control that removes it — and the toast
  // is assembled completely before it is inserted, so a live region announces
  // it once rather than once per child.
  if (dismissAfter === undefined) {
    appendToastDismissControl(toast, resolveToastDismissLabel(container))
    container.appendChild(toast)
    return
  }
  container.appendChild(toast)
  window.setTimeout(() => {
    toast.remove()
  }, dismissAfter)
}

// ─── Action button binding (shared) ──────────────────────────────────────────

/**
 * Run `onClick` for every click on a `button[data-action-type="<type>"]`. Shared
 * by the automation / auth / fetch button setups, which differ only in their
 * per-button click body.
 *
 * Delegated, so a button that arrives with a refreshed region works on its first
 * click. Each caller's body opens by reading the button's own configuration
 * attribute and returning without it — see {@link delegate} for why that guard
 * is load-bearing rather than defensive.
 */
function bindActionButtons(actionType: string, onClick: (button: HTMLButtonElement) => void): void {
  delegate<HTMLButtonElement>('click', `button[data-action-type="${actionType}"]`, onClick)
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
 *
 * The two affordance labels arrive together in `labels` because they are one
 * decision — the gate's language — and passing them as separate positional
 * arguments is how a caller ends up supplying one and defaulting the other.
 */
function openFetchConfirmGate(
  trigger: HTMLButtonElement,
  message: string,
  labels: { readonly confirm: string; readonly cancel: string },
  onConfirm: () => void
): void {
  const { confirm: confirmLabel, cancel: cancelLabel } = labels
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
  messageSpan.className = 'text-foreground-subtle text-sm'
  messageSpan.textContent = message
  dialog.appendChild(messageSpan)

  dialog.appendChild(
    createGateButton({
      label: confirmLabel,
      className:
        'bg-error-bg text-error-fg rounded-md px-2 py-1 text-sm font-medium transition-opacity hover:opacity-90',
      onClick: () => {
        dialog.remove()
        onConfirm()
      },
    })
  )
  // The visible text and the accessible name are set from the SAME resolved
  // string. They used to be two separate literals, which is two places for the
  // language to drift independently.
  dialog.appendChild(
    createGateButton({
      label: cancelLabel,
      ariaLabel: cancelLabel,
      className:
        'border-border text-foreground-subtle hover:bg-background-subtle rounded-md border px-2 py-1 text-sm transition-colors',
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
      // Same precedence chain as the OBJECT gate, resolved by the SAME function —
      // this gate's only difference is that its highest-priority override is the
      // renderer's `data-confirm-label` attribute rather than a config field. The
      // chain must not fork: a fork is how the two ends came to disagree and put
      // an "Annuler" beside an author's English affirm label.
      const labels = resolveGateLabels(button, {
        confirmLabel: button.getAttribute('data-confirm-label'),
      })
      openFetchConfirmGate(button, confirmMessage, labels, () => void dispatch())
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
  delegate<HTMLFormElement>('submit', 'form[data-action-type="endpoint"]', (form, event) => {
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

// ─── Island form guard (prevent native submission before island hydration) ──

/**
 * The one binder here that stays a LOAD-TIME SWEEP, deliberately.
 *
 * Its whole subject is the window between the served HTML and the island taking
 * over, so it is a page-load concern by definition: the skeleton form it guards
 * stops existing the moment React replaces it. Delegating it would widen it to
 * every island form for the rest of the page's life — including the HYDRATED
 * one, whose own handler owns the submit — which is a behaviour change, not a
 * hardening.
 *
 * It also has nothing to gain on the refresh seam: a region holding a mounted
 * island is left alone by the refresh rather than swapped (see
 * `refetch-server-rendered-region.ts`), so no guarded form ever arrives that
 * way.
 */
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
  setupSessionBoundChrome()
  setupNativeSelectPublishers()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClientRuntime)
} else {
  initClientRuntime()
}
