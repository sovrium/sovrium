/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Inline JS source for the `successPage` answer of the standalone form
 * runtime, concatenated into the IIFE, whose `form`, `formName`, `onSuccess`,
 * `interpolate` and `applyReset` it reuses.
 *
 * The success block takes the form's place as a status message, and focus
 * moves to its title (`tabindex="-1"`: a script can focus it, Tab never stops
 * on it), so a keyboard or screen-reader user hears it and goes on from it:
 * the first action is the next Tab stop. A success page with no title takes
 * the focus on the block itself.
 *
 * Each action is drawn as the app's `button`, with the classes the server
 * resolved into `config.actionClasses`: the first in the default variant, the
 * others in `outline`.
 */
export const FORM_RUNTIME_SUCCESS_PAGE_SCRIPT = `
  function renderSuccessPage(response) {
    var container = form.parentNode
    if (!container) return
    var section = document.createElement('section')
    section.setAttribute('data-form-success', formName)
    section.setAttribute('role', 'status')
    section.className = 'form-success-page'
    var focusTarget = section
    if (onSuccess.title) {
      var h = document.createElement('h2')
      h.textContent = interpolate(onSuccess.title, response)
      h.setAttribute('tabindex', '-1')
      section.appendChild(h)
      focusTarget = h
    } else {
      section.setAttribute('tabindex', '-1')
    }
    if (onSuccess.message) {
      var p = document.createElement('p')
      p.textContent = interpolate(onSuccess.message, response)
      section.appendChild(p)
    }
    if (Array.isArray(onSuccess.actions)) {
      var actionsBar = document.createElement('div')
      actionsBar.className = 'form-success-actions'
      var looks = config.actionClasses || []
      onSuccess.actions.forEach(function (action, i) {
        var btn = document.createElement('button')
        btn.type = 'button'
        btn.className = looks[i ? 1 : 0] || ''
        btn.setAttribute('data-component-type', 'button')
        btn.textContent = action.label
        btn.setAttribute('data-success-action', action.action)
        btn.addEventListener('click', function () {
          if (action.action === 'reset') {
            section.parentNode.removeChild(section)
            form.removeAttribute('hidden')
            applyReset(response, true)
          } else if (action.action === 'navigate') {
            var target = interpolate(action.url || '/', response, true)
            window.location.assign(target)
          }
        })
        actionsBar.appendChild(btn)
      })
      section.appendChild(actionsBar)
    }
    form.setAttribute('hidden', '')
    container.appendChild(section)
    focusTarget.focus()
  }
`
