/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `stickyActions` bar's behaviour (`form-save-bar.tsx`): it counts the
 * fields changed since the page drew the form, puts them back on Discard, and
 * asks before the page is left with changes unsaved — except by the form's own
 * submit. Runs once where it is spliced in; assumes the surrounding IIFE
 * provides `form` and `INPUT_SELECTOR`.
 */
export const FORM_RUNTIME_SAVE_BAR_SCRIPT = `
  ;(function bindSaveBar() {
    var status = form.querySelector('[data-form-changes]')
    if (!status) return
    var discard = form.querySelector('[data-form-discard]')
    var watched = Array.prototype.filter.call(form.querySelectorAll(INPUT_SELECTOR), function (el) {
      return el.type !== 'hidden' && el.type !== 'file'
    })
    function valueOf(el) {
      return el.type === 'checkbox' || el.type === 'radio' ? String(el.checked) : el.value
    }
    var initial = watched.map(valueOf)
    var changes = 0, submitting = false
    function recount() {
      var names = {}
      watched.forEach(function (el, i) { if (valueOf(el) !== initial[i]) names[el.name] = true })
      changes = Object.keys(names).length
      status.textContent = changes === 0 ? 'No unsaved changes' : changes + ' unsaved change' + (changes === 1 ? '' : 's')
      if (discard) discard.disabled = changes === 0
    }
    form.addEventListener('input', recount)
    form.addEventListener('change', recount)
    form.addEventListener('submit', function () { submitting = true })
    if (discard) discard.addEventListener('click', function () { form.reset(); recount() })
    window.addEventListener('beforeunload', function (event) {
      if (changes > 0 && !submitting) event.preventDefault()
    })
  })()
`
