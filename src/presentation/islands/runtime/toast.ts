/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one toast renderer every island shares.
 *
 * Previously this existed three times over — once under `data-table/island/`,
 * once under `components/crud-form/`, and once as an injected option on
 * `action-executor` — with byte-identical container and element construction in
 * the first two. It lives in `shared/` because a toast belongs to no single
 * feature: the data-table row/bulk actions, the CRUD form, the auth form, the
 * kanban drop, the file upload, and the record button all raise one. The two
 * former homes now re-export from here, so existing import sites are unchanged.
 *
 * The DOM contract is fixed and asserted by specs on every surface:
 * `<div data-sonner-toaster role=status aria-live=polite><div data-toast
 * data-variant><span data-toast-message>message</span></div></div>`, plus a
 * `<button data-toast-dismiss>` on a toast that never expires and `role=alert`
 * on one that has to interrupt. Two selector families depend on it —
 * `[data-sonner-toaster]` with an inner `[data-toast][data-variant]`, and the
 * looser `[data-toast-container], [role="status"], [aria-live="polite"]` — so
 * the container's role, live-region attributes, and `display:flex` stacking are
 * all load-bearing, not decoration.
 *
 * The message has a node of its own because a control inside `[data-toast]`
 * joins that element's `textContent`: without it, appending a dismiss button
 * makes the toast read `Could not save the task.×` and every exact-text
 * assertion in the product starts failing on correct output. Read
 * `runtime/toast-accessibility.ts` before changing the element's children.
 *
 * A page whose config declares `page.toasts` already renders this container
 * server-side (`DynamicPage`'s `PageToastContainer`, which additionally carries
 * `data-position`). `ensureToasterContainer` therefore looks before it builds:
 * the SSR container is adopted when present, so a configured position is never
 * clobbered by a client-side duplicate.
 *
 * Dismissal is NOT decided here. Both this renderer and `client.ts#showToast`
 * resolve it through `runtime/toast-duration.ts`, which owns the one policy:
 * an explicit `duration` wins, an `error`/`destructive` toast persists, a toast
 * with an action button persists, everything else expires on the documented
 * 5000 ms default. Read that module before changing timing here — a second
 * policy is exactly what it exists to prevent.
 *
 * NOT unified here, deliberately:
 *  - `client.ts#showToast` — a RICHER toast (wraps the message in a `<span>`
 *    and renders an `actionLabel`/`actionUrl` button). It is the reason
 *    `action-executor`'s renderer is injected rather than imported; see the
 *    note there. It shares this renderer's dismissal policy but not its DOM.
 *  - `form-runtime.tsx`'s `renderToast` — a self-contained string-literal IIFE
 *    with its own `data-form-toast` shape and a documented byte-budget rationale.
 *  - `data-table/island/conflict-toast.tsx` — a React `role="alert"` banner
 *    rendered inline in the table, not an imperative DOM toast at all.
 */

import {
  appendToastDismissControl,
  appendToastMessage,
  markToastPoliteness,
  resolveToastDismissLabel,
} from '@/presentation/islands/runtime/toast-accessibility'
import { resolveToastDuration } from '@/presentation/islands/runtime/toast-duration'

/**
 * Find the shared toaster container, creating it only if the page did not
 * render one server-side.
 */
function ensureToasterContainer(): Element {
  const existing = document.querySelector('[data-sonner-toaster]')
  if (existing) return existing
  const container = document.createElement('div')
  container.setAttribute('data-sonner-toaster', '')
  container.setAttribute('role', 'status')
  container.setAttribute('aria-live', 'polite')
  /* eslint-disable functional/immutable-data -- DOM style mutation required for runtime toast injection */
  const el = container as HTMLElement
  el.style.position = 'fixed'
  el.style.bottom = '16px'
  el.style.right = '16px'
  el.style.zIndex = '9999'
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.gap = '8px'
  /* eslint-enable functional/immutable-data */
  document.body.appendChild(container)
  return container
}

/**
 * Append a toast to the shared toaster container.
 *
 * A no-op outside a browser (SSR / tests without a `document`), so callers can
 * invoke it unconditionally from a mutation success handler.
 *
 * The toast leaves the DOM on its own once {@link resolveToastDuration} says
 * so — which for an `error`/`destructive` variant is never, so a failure still
 * waits to be read. A toast that never expires therefore gets the control that
 * removes it, and ONLY that toast: one already on a timer has a way out, and
 * giving it a button would change its text for every reader of it. The
 * container stacks survivors vertically and is left in place when the last
 * toast goes: empty, it is zero-sized and intercepts nothing, and a page that
 * rendered it server-side keeps its configured position.
 *
 * The toast is assembled completely and inserted ONCE. Inserting it first and
 * filling it afterwards would announce it empty and then announce it again on
 * every child — the sort of double announcement a live region makes worse, not
 * better.
 */
export function renderToast(message: string, variant?: string, duration?: number): void {
  if (typeof document === 'undefined') return
  const container = ensureToasterContainer()
  const toast = document.createElement('div')
  toast.setAttribute('data-toast', '')
  if (variant) toast.setAttribute('data-variant', variant)
  markToastPoliteness(toast, variant)
  appendToastMessage(toast, message)

  const dismissAfter = resolveToastDuration({ duration, variant })
  if (dismissAfter === undefined) {
    appendToastDismissControl(toast, resolveToastDismissLabel(container))
    container.appendChild(toast)
    return
  }
  container.appendChild(toast)
  setTimeout(() => {
    toast.remove()
  }, dismissAfter)
}

/**
 * Toast configuration emitted by a form/kanban action on success or failure.
 *
 * The object-shaped counterpart to `renderToast`'s positional arguments, kept
 * because it mirrors the config schema's `onSuccess.toast` slot and is carried
 * as a prop type through the crud-form island.
 */
export interface SuccessToast {
  readonly message: string
  readonly variant?: string
  /**
   * Auto-dismiss delay in milliseconds, per the schema's `toast.duration`.
   *
   * Honoured: it is forwarded to {@link renderToast}, which resolves it against
   * the shared policy in `runtime/toast-duration.ts`. An omitted value is not a
   * missing feature — it selects the documented 5000 ms default, or persistence
   * for an `error`/`destructive` variant.
   */
  readonly duration?: number
}

/** Render a configured toast object through the shared renderer. */
export function showSuccessToast(toast: SuccessToast): void {
  renderToast(toast.message, toast.variant, toast.duration)
}
