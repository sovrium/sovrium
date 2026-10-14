/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PLACED_TOAST_READY_MARK } from '@/presentation/design/runtime-ready-marks'
import * as Renderers from '../elements'
import type { ComponentRenderer } from './component-dispatch-config'

/**
 * The placed toast's behaviour, as an inline script: a declared `duration`
 * removes the toast once it has passed, and the action button posts once to
 * its URL and closes the toast. A string rather than a client chunk, so a page
 * with one toast ships no island for it.
 */
const PLACED_TOAST_RUNTIME = `(function () {
  document.querySelectorAll('[data-placed-toast]').forEach(function (toast) {
    if (toast.getAttribute('${PLACED_TOAST_READY_MARK}') === 'true') return
    toast.setAttribute('${PLACED_TOAST_READY_MARK}', 'true')
    var duration = parseInt(toast.getAttribute('data-duration'), 10)
    if (duration > 0) setTimeout(function () { toast.remove() }, duration)
    var action = toast.querySelector('[data-toast-action]')
    if (!action) return
    action.addEventListener('click', function () {
      action.disabled = true
      fetch(action.getAttribute('data-action-url'), { method: 'POST' }).finally(function () {
        toast.remove()
      })
    }, { once: true })
  })
})()`

interface PlacedToastFields {
  readonly toastVariant?: string
  readonly duration?: number
  readonly actionLabel?: string
  readonly actionUrl?: string
}

/**
 * `toast` placed in the page tree: shadcn/ui's Sonner toast drawn where it is
 * written, in its `toastVariant`, with an optional action button and an
 * optional `duration` after which it leaves.
 */
export const toastComponent: ComponentRenderer = ({
  elementProps,
  content,
  renderedChildren,
  interactions,
  component,
}) => {
  const { toastVariant, duration, actionLabel, actionUrl } = (component ?? {}) as PlacedToastFields
  const action =
    actionLabel !== undefined && actionUrl !== undefined ? (
      <button
        key="toast-action"
        type="button"
        data-toast-action=""
        data-action-url={actionUrl}
      >
        {actionLabel}
      </button>
    ) : undefined
  const behaves = action !== undefined || duration !== undefined
  const toast = Renderers.renderHTMLElement({
    type: 'div',
    props: {
      ...elementProps,
      'data-toast': '',
      'data-placed-toast': '',
      'data-variant': toastVariant ?? 'default',
      ...(duration === undefined ? {} : { 'data-duration': String(duration) }),
    },
    // With an action, the message gets a node of its own beside the button.
    content: action === undefined ? content : undefined,
    children:
      action === undefined
        ? renderedChildren
        : [
            <span
              key="toast-message"
              data-toast-message=""
            >
              {content}
            </span>,
            ...renderedChildren,
            action,
          ],
    interactions: interactions,
  })
  if (!behaves) return toast
  return (
    <>
      {toast}
      {/* eslint-disable-next-line sovrium/require-sanitized-html -- engine-authored runtime script constant; no config or record value is interpolated into it */}
      <script dangerouslySetInnerHTML={{ __html: PLACED_TOAST_RUNTIME }} />
    </>
  )
}
