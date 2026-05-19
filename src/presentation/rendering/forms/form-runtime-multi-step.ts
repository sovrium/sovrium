/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const FORM_RUNTIME_MULTI_STEP_SCRIPT = `
  // ---- Multi-step navigation -------------------------------------------------
  //
  // Server-mediated multi-step flow:
  //   - Initial GET renders only the active step's fields plus a progress
  //     indicator.
  //   - Next click posts to /api/forms/NAME/steps/STEPID/advance; server
  //     validates the current step and returns { nextStepId } JSON. The
  //     runtime then GETs the next step's HTML fragment and replaces the
  //     active form-step container with the response.
  //   - Previous click GETs /api/forms/NAME/steps/PREVIOUSSTEPID; server
  //     returns the previous step's HTML with prefilled values.
  function getActiveStepEl() {
    return form.querySelector('.form-step[data-step-active="true"]')
  }
  function getActiveStepId() {
    var el = getActiveStepEl()
    return el ? el.getAttribute('data-step') : null
  }
  function getProgressEl() {
    return form.parentNode && form.parentNode.querySelector('[data-form-progress]')
  }
  function setProgressLabel(currentIndex) {
    var el = getProgressEl()
    if (el) el.textContent = 'Step ' + (currentIndex + 1) + ' of ' + stepIds.length
  }
  function replaceActiveStep(html, newStepId) {
    var oldEl = getActiveStepEl()
    if (!oldEl || !oldEl.parentNode) return
    var wrapper = document.createElement('div')
    wrapper.innerHTML = html
    var newEl = wrapper.firstElementChild
    if (!newEl) return
    oldEl.parentNode.replaceChild(newEl, oldEl)
    form.setAttribute('data-active-step', newStepId)
    var idx = stepIds.indexOf(newStepId)
    if (idx >= 0) setProgressLabel(idx)
    var submitBtn = form.querySelector('button[type="submit"]')
    if (submitBtn) {
      var lastIndex = stepIds.length - 1
      if (idx === lastIndex) submitBtn.removeAttribute('hidden')
      else submitBtn.setAttribute('hidden', '')
    }
    bindStepNav()
  }
  function collectStepValues() {
    var inputs = namedInputs()
    var payload = {}
    inputs.forEach(function (input) {
      if (input.type === 'checkbox') {
        payload[input.name] = input.checked
        return
      }
      payload[input.name] = input.value
    })
    return payload
  }
  function handleNext() {
    var stepId = getActiveStepId()
    if (!stepId) return
    fetch('/api/forms/' + formName + '/steps/' + stepId + '/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(collectStepValues()),
    })
      .then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, status: response.status, body: body || {} }
        })
      })
      .then(function (result) {
        if (!result.ok) {
          renderOnError(result.body && result.body.message)
          return
        }
        var nextStepId = result.body && result.body.nextStepId
        if (!nextStepId) return
        fetch('/api/forms/' + formName + '/steps/' + nextStepId, {
          method: 'GET',
          headers: { Accept: 'text/html' },
        })
          .then(function (r) {
            return r.text()
          })
          .then(function (html) {
            replaceActiveStep(html, nextStepId)
          })
      })
  }
  function handlePrevious() {
    var stepId = getActiveStepId()
    if (!stepId) return
    var idx = stepIds.indexOf(stepId)
    if (idx <= 0) return
    var previousId = stepIds[idx - 1]
    fetch('/api/forms/' + formName + '/steps/' + previousId, {
      method: 'GET',
      headers: { Accept: 'text/html' },
    })
      .then(function (r) {
        return r.text()
      })
      .then(function (html) {
        replaceActiveStep(html, previousId)
      })
  }
  function bindStepNav() {
    var nextBtns = form.querySelectorAll('.step-next')
    nextBtns.forEach(function (btn) {
      btn.addEventListener('click', handleNext)
    })
    var prevBtns = form.querySelectorAll('.step-previous')
    prevBtns.forEach(function (btn) {
      btn.addEventListener('click', handlePrevious)
    })
  }
  function showStep(_index) {
    // No-op for server-mediated flow: SSR already renders the active
    // step. Kept as a stub so the existing applyReset call site compiles
    // without further changes.
    return
  }
  if (isMultiStep) bindStepNav()
`
