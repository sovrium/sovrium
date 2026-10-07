/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  appendToastDismissControl,
  appendToastMessage,
  markToastPoliteness,
  resolveToastDismissLabel,
} from '@/presentation/islands/runtime/toast-accessibility'
import { resolveToastDuration } from '@/presentation/islands/runtime/toast-duration'

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

export function showToast(message: string, options: ToastOptions = {}): void {
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
