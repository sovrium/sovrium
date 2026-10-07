/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Inline JS source for the field errors of the standalone form runtime,
 * concatenated into the IIFE, whose `form`, `formName` and `removeIfPresent`
 * locals it reuses.
 *
 * A reason is drawn under the field it concerns — from the browser's own
 * validity check or from the server's `fieldErrors` — and the field itself is
 * marked: `aria-invalid`, and an `aria-describedby` pointing at the reason, so
 * a screen reader landing on the field announces why. Both marks are undone
 * when the reason is cleared. A reason names the field by its LABEL, the name
 * the visitor reads, never by its column.
 *
 * Regular expressions in this template are written with doubled backslashes:
 * the source is a template literal, which would otherwise swallow them.
 */
export const FORM_RUNTIME_FIELD_ERRORS_SCRIPT = `
  // ---- Inline validation -----------------------------------------------------
  // A refused field is marked on its control: aria-invalid, and an
  // aria-describedby pointing at the reason, so a screen reader landing on the
  // field announces why. Both are undone when the reason is cleared.
  function errorIdOf(input) {
    return 'field-error-' + formName + '-' + (input.name || '')
  }
  function unmarkInvalid(input) {
    input.removeAttribute('aria-invalid')
    var errId = errorIdOf(input)
    var rest = (input.getAttribute('aria-describedby') || '').split(/\\s+/).filter(function (t) {
      return t && t !== errId
    })
    if (rest.length > 0) input.setAttribute('aria-describedby', rest.join(' '))
    else input.removeAttribute('aria-describedby')
  }
  function clearFieldErrors() {
    var errs = form.querySelectorAll('[data-field-error]')
    errs.forEach(function (err) {
      var name = err.getAttribute('data-field-error')
      var input = name ? form.querySelector('[name="' + name + '"]') : null
      if (input) unmarkInvalid(input)
      removeIfPresent(err)
    })
    removeIfPresent(form.parentNode && form.parentNode.querySelector('[data-form-error-message]'))
    removeIfPresent(document.querySelector('[data-form-toast="' + formName + '"]'))
  }
  // The field as the visitor reads it: its label, less the aria-hidden
  // required mark; the column name only when the field has no label.
  function labelOf(input) {
    var label = input.id ? form.querySelector('label[for="' + input.id + '"]') : null
    if (!label) label = input.closest('label')
    if (!label) return input.name || 'Field'
    var copy = label.cloneNode(true)
    copy.querySelectorAll('[aria-hidden="true"]').forEach(removeIfPresent)
    return (copy.textContent || '').trim() || input.name || 'Field'
  }
  function showFieldError(input, message) {
    var wrapper = input.closest('.form-field')
    if (!wrapper) return
    removeIfPresent(wrapper.querySelector('[data-field-error]'))
    var err = document.createElement('div')
    var errId = errorIdOf(input)
    err.id = errId
    err.setAttribute('data-field-error', input.name || '')
    err.setAttribute('role', 'alert')
    // The page node's 'error' part, carried on the form since this element is made here.
    var errorPart = form.getAttribute('data-error-class')
    err.className = errorPart ? 'field-error ' + errorPart : 'field-error'
    // A server reason leads with the column name; the visitor reads the label.
    err.textContent =
      input.name && message.indexOf(input.name + ' ') === 0
        ? labelOf(input) + message.slice(input.name.length)
        : message
    wrapper.appendChild(err)
    input.setAttribute('aria-invalid', 'true')
    var described = (input.getAttribute('aria-describedby') || '').split(/\\s+/).filter(function (t) {
      return t && t !== errId
    })
    input.setAttribute('aria-describedby', described.concat([errId]).join(' '))
  }
  // A missing field's reason, in the page language when the server sent one.
  function requiredMessage(label) {
    var t = S['form.requiredNamed']
    return t ? t.split('{label}').join(label) : label + ' is required'
  }
  function fieldErrorMessage(input) {
    var v = input.validity
    var label = labelOf(input)
    if (v.valueMissing) return requiredMessage(label)
    if (v.typeMismatch) {
      if (input.type === 'email') return 'Please enter a valid email'
      if (input.type === 'url') return 'Please enter a valid URL'
      return label + ' is invalid'
    }
    if (v.patternMismatch) return label + ' does not match the required pattern'
    return label + ' is invalid'
  }
`
