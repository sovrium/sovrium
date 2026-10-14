/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import { beginPending } from '@/presentation/design/pending-state'
import { SPINNER_MARK } from '@/presentation/design/spinner-mark-markup'

/**
 * The pending state for the hosted-form runtime's buttons (submit, Next): the
 * SAME `beginPending` the plain-DOM runtimes call, inlined rather than copied,
 * plus the house spinner as data.
 *
 * Bound with `var`, never declared by name: the release binary is minified, so
 * `String(beginPending)` carries a mangled name, and only the binding below
 * gives the IIFE a name it can call. `form-runtime-pending.test.ts` runs the
 * minified build to hold that.
 *
 * The fragment needs nothing from the surrounding IIFE and provides:
 *   - `SPINNER_MARK` (the mark as data)
 *   - `beginPending(control, { label, spinner })` → a restore function, or
 *     `undefined` when the control is already pending
 *   - `submitButtonOf(form, event)` → the control that sent the form: the
 *     event's submitter, else the form's first submit button
 *   - `holdWhile(control, label, run, keep)` → `run()`'s promise, the control
 *     pending until it settles and given back BEFORE the value flows on (so a
 *     refusal can focus it) — unless `keep(value)` says the value leaves the
 *     page; `null`, with `run` never called, when it is already pending
 *   - `leavesPage(address)` → true when `address` names another document (a
 *     different path or query), false for a `#fragment` on this one
 */
export const FORM_RUNTIME_PENDING_SCRIPT = `
  var SPINNER_MARK = ${serializeJsonForScript(SPINNER_MARK)}
  var beginPending = ${String(beginPending)}
  function submitButtonOf(f, event) {
    var by = event && event.submitter
    return by && by.type === 'submit' ? by : f.querySelector('button[type="submit"], input[type="submit"]')
  }
  function holdWhile(control, label, run, keep) {
    var restore = control ? beginPending(control, { label: label, spinner: SPINNER_MARK }) : function () {}
    if (!restore) return null
    return run().then(function (value) {
      if (!(keep && keep(value))) restore()
      return value
    }, function (err) { restore(); throw err })
  }
  function leavesPage(address) {
    if (!address) return false
    var target = new URL(address, window.location.href), here = window.location
    return target.origin + target.pathname + target.search !== here.origin + here.pathname + here.search
  }
`
