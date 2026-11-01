/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SIDEBAR_SHELL_READY_MARK } from '@/presentation/design/runtime-ready-marks'

/** The cookie a folded sidebar is remembered in, read by the server: shadcn/ui's name. */
export const SIDEBAR_STATE_COOKIE = 'sidebar_state'

/**
 * The fold runtime: the trigger, the rail and Control or Command with B flip
 * the sidebar's `data-state` and `data-collapsible`, and a persisting sidebar
 * writes the state cookie the server reads. Bound once per document.
 */
export const SIDEBAR_SHELL_RUNTIME = `(function () {
  var root = document.documentElement
  if (root.getAttribute('${SIDEBAR_SHELL_READY_MARK}') === 'true') return
  root.setAttribute('${SIDEBAR_SHELL_READY_MARK}', 'true')
  function toggle(box) {
    var folds = box.getAttribute('data-sidebar-folds')
    if (!folds) return
    var collapse = box.getAttribute('data-state') !== 'collapsed'
    box.setAttribute('data-state', collapse ? 'collapsed' : 'expanded')
    if (collapse) box.setAttribute('data-collapsible', folds)
    else box.removeAttribute('data-collapsible')
    box.querySelectorAll('[data-sidebar="trigger"]').forEach(function (trigger) {
      trigger.setAttribute('aria-expanded', collapse ? 'false' : 'true')
    })
    if (box.hasAttribute('data-sidebar-persist')) {
      document.cookie = '${SIDEBAR_STATE_COOKIE}=' + (collapse ? 'false' : 'true') + '; path=/; max-age=604800; samesite=lax'
    }
  }
  document.addEventListener('click', function (event) {
    var control = event.target && event.target.closest && event.target.closest('[data-sidebar="trigger"], [data-sidebar="rail"]')
    if (!control) return
    var box = control.closest('[data-sidebar-folds]')
    if (box) toggle(box)
  })
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'b' && event.key !== 'B') return
    if (!(event.metaKey || event.ctrlKey)) return
    var boxes = document.querySelectorAll('[data-sidebar-folds][data-sidebar-shortcut]')
    if (boxes.length === 0) return
    event.preventDefault()
    boxes.forEach(toggle)
  })
})()`
