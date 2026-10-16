/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  appendToastDismissControl,
  appendToastMessage,
  keepToastsClearOfFocus,
  markToastPoliteness,
  resolveToastDismissLabel,
} from '@/presentation/islands/runtime/toast-accessibility'
import {
  markToastTiming,
  resolveToastDuration,
} from '@/presentation/islands/runtime/toast-duration'

/**
 * The client runtime's toast, raised by the non-island controls (filter
 * forms, automation, auth and fetch buttons).
 */

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
  /** A loading toast this one takes the place of: one toast that turns into its outcome. */
  replacing?: Element
}

function ensureToastContainer(): Element {
  let container = document.querySelector('[data-sonner-toaster]')
  if (!container) {
    container = document.createElement('div')
    container.setAttribute('data-sonner-toaster', '')
    container.setAttribute('data-toast-container', '')
    const el = container as HTMLElement
    el.style.position = 'fixed'
    el.style.right = '16px'
    el.style.zIndex = '9999'
    el.style.display = 'flex'
    el.style.flexDirection = 'column'
    el.style.gap = '8px'
    document.body.appendChild(container)
  }
  return container
}

/** The toast's action button: it posts to its URL, then the toast closes. */
function createActionButton(toast: Element, label: string, url: string): HTMLButtonElement {
  const actionBtn = document.createElement('button')
  actionBtn.type = 'button'
  actionBtn.textContent = label
  actionBtn.addEventListener('click', () => {
    void fetch(url, { method: 'POST' }).finally(() => {
      toast.remove()
    })
  })
  return actionBtn
}

export function showToast(message: string, options: ToastOptions = {}): Element {
  const container = ensureToastContainer()
  const toast = document.createElement('div')
  toast.setAttribute('data-toast', '')
  markToastTiming(toast, options)

  // A failure interrupts; everything else waits its turn. Set BEFORE insertion,
  // so assistive technology sees an alert at the moment the toast arrives.
  markToastPoliteness(toast, options.variant)

  // This renderer already wrapped its message in a span. Marking that span is
  // the whole of the message-node contract here — the three other renderers had
  // to grow one, because a dismiss control inside `[data-toast]` joins the
  // element's `textContent` and merges with a bare text node.
  appendToastMessage(toast, message)

  if (options.actionLabel && options.actionUrl) {
    toast.appendChild(createActionButton(toast, options.actionLabel, options.actionUrl))
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
  // A loading toast waits for the answer that replaces it: no timer, no close.
  const place = (): Element => {
    const { replacing } = options
    if (replacing?.parentNode === container) container.replaceChild(toast, replacing)
    else container.appendChild(toast)
    keepToastsClearOfFocus(container)
    return toast
  }
  if (options.variant === 'loading') return place()
  if (dismissAfter === undefined) {
    appendToastDismissControl(toast, resolveToastDismissLabel(container))
    return place()
  }
  window.setTimeout(() => {
    toast.remove()
  }, dismissAfter)
  return place()
}
