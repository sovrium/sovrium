/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Multi-step navigation: inline JS source for the per-step nav portion of
 * the standalone form runtime. Sliced out of `form-runtime.tsx` so the
 * runtime file stays under the project's max-lines cap; concatenated
 * verbatim into the IIFE source string at module load time.
 *
 * The fragment assumes the surrounding IIFE provides:
 *   - `form` (HTMLFormElement)
 *   - `formName` (string)
 *   - `stepIds` (array of step ids in declaration order)
 *   - `isMultiStep` (boolean)
 *   - `namedInputs` (helper returning `input[name]`-style elements)
 *   - `renderOnError` (inline error rendering helper)
 *   - `applyConditions` / `accumulatedValues` (live conditions fragment)
 *   - `S` (page-language strings) and `holdWhile` (pending fragment)
 *
 * Defines a no-arg `bindStepNav` function the surrounding code calls
 * once on mount and again after a step replacement, and a
 * `showStep(index, preserveFields)` the `applyReset` call site uses to
 * rewind the flow to its first step.
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
  // A step is fetched in the language its page was served in.
  function stepUrl(id) {
    var lang = document.documentElement.getAttribute('lang')
    var url = '/api/forms/' + formName + '/steps/' + id
    return lang ? url + '?lang=' + encodeURIComponent(lang) : url
  }
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
  // The progress line carries its own words, in the page language.
  function setProgressLabel(currentIndex) {
    var el = getProgressEl()
    if (!el) return
    var template = el.getAttribute('data-step-of') || 'Step {current} of {total}'
    el.textContent = template
      .split('{current}').join(String(currentIndex + 1))
      .split('{total}').join(String(stepIds.length))
  }
  // On the last step the submit joins the step's actions row, after the way
  // back; on any other step it waits, hidden, at the end of the form.
  function placeSubmit(stepEl, isLast) {
    var submitBtn = form.querySelector('button[type="submit"]')
    if (!submitBtn) return
    var nav = stepEl && stepEl.querySelector('.form-step-nav')
    if (isLast && nav) {
      nav.appendChild(submitBtn)
      submitBtn.removeAttribute('hidden')
    } else {
      form.appendChild(submitBtn)
      if (!isLast) submitBtn.setAttribute('hidden', '')
    }
  }
  function replaceActiveStep(html, newStepId) {
    var oldEl = getActiveStepEl()
    if (!oldEl || !oldEl.parentNode) return
    var wrapper = document.createElement('div')
    wrapper.innerHTML = html
    var newEl = wrapper.firstElementChild
    if (!newEl) return
    // Take the submit out of the leaving step first, or it leaves with it.
    placeSubmit(null, false)
    oldEl.parentNode.replaceChild(newEl, oldEl)
    form.setAttribute('data-active-step', newStepId)
    var idx = stepIds.indexOf(newStepId)
    if (idx >= 0) setProgressLabel(idx)
    placeSubmit(newEl, idx === stepIds.length - 1)
    bindStepNav()
    applyConditions()
  }
  // A control disabled by a false visibleWhen is skipped: the field is off
  // screen, so its answer is neither sent nor kept.
  function collectStepValues() {
    var inputs = namedInputs()
    var payload = {}
    inputs.forEach(function (input) {
      if (input.disabled) return
      if (input.type === 'checkbox') {
        payload[input.name] = input.checked
        return
      }
      payload[input.name] = input.value
    })
    return payload
  }
  // Next stays pending — disabled, busy, the spinner and the built-in word —
  // until the step is checked AND the next one has arrived, so a second press
  // checks nothing twice.
  function handleNext(event) {
    var stepId = getActiveStepId()
    if (!stepId) return
    var stepValues = collectStepValues()
    Object.keys(stepValues).forEach(function (k) {
      accumulatedValues[k] = stepValues[k]
    })
    holdWhile(event && event.currentTarget, S['form.sending'] || 'Sending…', function () {
      return fetch('/api/forms/' + formName + '/steps/' + stepId + '/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(stepValues),
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
          return fetch(stepUrl(nextStepId), {
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
    })
  }
  // Enter in a field of a step that is not the last: advance as Next does
  // (and, while Next is pending, send nothing), never submit the form.
  function advanceFromEnter() {
    var idx = stepIds.indexOf(getActiveStepId())
    if (idx < 0 || idx >= stepIds.length - 1) return false
    var next = form.querySelector('.step-next')
    if (next) handleNext({ currentTarget: next })
    return true
  }
  function handlePrevious() {
    var stepId = getActiveStepId()
    if (!stepId) return
    var idx = stepIds.indexOf(stepId)
    if (idx <= 0) return
    var previousId = stepIds[idx - 1]
    fetch(stepUrl(previousId), {
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
  // Rewind the flow to \`stepIds[index]\` — the client half of
  // \`onSuccess: { type: 'reset' }\` on a multi-step form.
  //
  // Two things have to happen, and neither is sufficient alone. The DOM only
  // ever holds the ACTIVE step, so returning to step 1 means fetching its
  // fragment and swapping it in; and every later step prefills from the
  // server-side draft, so unless the draft is replaced too the submitter
  // restarts at step 1 only to be handed back the answers they just
  // submitted. \`preserveFields\` is what makes it a replacement rather than a
  // clear: those values are read off the DOM as it stands NOW — before the
  // swap discards it — and posted as the draft's entire new contents.
  function showStep(index, preserveFields) {
    var targetId = stepIds[index]
    if (!targetId) return
    var preserve = preserveFields || []
    var seed = {}
    namedInputs().forEach(function (input) {
      if (preserve.indexOf(input.name) < 0) return
      seed[input.name] = input.type === 'checkbox' ? input.checked : input.value
    })
    accumulatedValues = {}
    Object.keys(seed).forEach(function (k) {
      accumulatedValues[k] = seed[k]
    })
    fetch('/api/forms/' + formName + '/draft/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(seed),
    })
      .then(function () {
        return fetch(stepUrl(targetId), {
          method: 'GET',
          headers: { Accept: 'text/html' },
        })
      })
      .then(function (r) {
        return r.text()
      })
      .then(function (html) {
        replaceActiveStep(html, targetId)
      })
  }
  if (isMultiStep) {
    placeSubmit(getActiveStepEl(), stepIds.indexOf(getActiveStepId()) === stepIds.length - 1)
    bindStepNav()
  }
`
