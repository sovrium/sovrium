/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PLACED_TOAST_READY_MARK } from '@/presentation/design/runtime-ready-marks'

/**
 * The placed toast's behaviour, as an inline script: a declared `duration`
 * removes the toast once it has passed, and the action button posts once to
 * its URL and closes the toast. A string rather than a client chunk, so a page
 * with one toast ships no island for it.
 */
export const PLACED_TOAST_RUNTIME = `(function () {
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
