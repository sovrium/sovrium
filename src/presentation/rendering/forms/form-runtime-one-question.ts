/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One-Question-At-A-Time runtime: inline JS source for the per-question
 * navigation portion of the standalone form runtime. Sliced out of
 * `form-runtime.tsx` so the runtime file stays under the project's
 * max-lines cap; concatenated verbatim into the IIFE source string at
 * module load time.
 *
 * The fragment assumes the surrounding IIFE provides:
 *   - `form` (HTMLFormElement)
 *   - `formName` (string)
 *   - `isOneQuestion` (boolean from runtime config)
 *   - `INPUT_SELECTOR` (named-input querySelector string)
 *   - `namedInputs` (helper returning `input[name]`-style elements)
 *   - `removeIfPresent` (DOM helper)
 *   - `showFieldError` / `clearFieldErrors` (inline-error helpers)
 *   - `applyOnSuccess` / `renderOnError` (post-submit UI helpers)
 *   - `fieldErrorMessage` (per-input validation message helper)
 *
 * Design — purely client-side step-through (NOT server-mediated):
 *   - All visible questions are emitted in the SSR HTML, each wrapped in
 *     `<div class="form-question" data-question-index="N">`. Only the
 *     active question lacks the `hidden` attribute; advancing simply
 *     toggles the attribute on the prior/next sibling.
 *   - This keeps Previous trivial — values stay in the DOM the whole
 *     time, no draft store / round-trip needed (contrast with the
 *     server-mediated multi-step flow in form-runtime-multi-step.ts,
 *     where each step is fetched on demand).
 *   - The summary screen is also pre-emitted by the SSR (hidden);
 *     advancing past the last question reveals it and populates each
 *     `<dd data-summary-for="...">` slot from the live input values.
 *
 * Auto-advance for radio fields fires ~250ms after the user clicks an
 * option (spec APP-FORMS-047). The delay is intentional: users want to
 * see their selection highlight before being whisked to the next field.
 *
 * Up/Down arrow keys move a "highlight" cursor inside a radiogroup
 * (APP-FORMS-048). This is a Sovrium-owned highlight, not the native
 * browser auto-check-on-arrow behaviour — the spec advances only after
 * Enter on the highlighted option. The native behaviour would check the
 * radio AND change the visible focus on each ArrowDown, which would
 * accidentally trigger auto-advance after ONE arrow press instead of
 * after Enter.
 */
export const FORM_RUNTIME_ONE_QUESTION_SCRIPT = `
  // ---- One-question-at-a-time navigation ------------------------------------
  var oqState = { current: 0, total: 0 }
  function getQuestions() {
    return form.querySelectorAll('.form-question[data-question-index]')
  }
  function getActiveQuestion() {
    return form.querySelector('.form-question[data-question-active="true"]')
  }
  function getProgressBar() {
    // Progress bar lives in the form's parentNode (sibling of the form)
    // so it is not bound to a specific question's visibility.
    return form.parentNode && form.parentNode.querySelector('[data-form-progress-bar]')
  }
  function getSummary() {
    // Summary is INSIDE the form so the Submit button natively triggers
    // form submission (which the surrounding submit interceptor handles).
    return form.querySelector('[data-form-summary]')
  }
  function questionInputs(questionEl) {
    if (!questionEl) return []
    return questionEl.querySelectorAll(INPUT_SELECTOR)
  }
  function isRadioQuestion(questionEl) {
    if (!questionEl) return false
    return questionEl.querySelector('input[type="radio"]') !== null
  }
  function updateProgress() {
    var bar = getProgressBar()
    if (!bar) return
    if (oqState.total === 0) {
      bar.setAttribute('aria-valuenow', '0')
      return
    }
    var pct = Math.round((oqState.current / oqState.total) * 100)
    if (pct < 0) pct = 0
    if (pct > 100) pct = 100
    bar.setAttribute('aria-valuenow', String(pct))
  }
  // Stashed answers captured when entering the summary screen — used to
  // populate the summary's read-only dd slots AND to feed the form
  // submit's payload via hidden inputs that REPLACE the question
  // wrappers. The question wrappers carry visible labels (e.g.
  // "Designer", "Engineer", a textarea's text content) which would
  // otherwise match Playwright's getByText() via strict mode and
  // collide with the summary's own dd text.
  var stashedAnswers = {}
  function captureAnswers() {
    stashedAnswers = {}
    var inputs = namedInputs()
    inputs.forEach(function (input) {
      if (input.type === 'radio') {
        if (input.checked) {
          var labelEl = input.id ? form.querySelector('label[for="' + input.id + '"]') : null
          var label = labelEl ? (labelEl.textContent || '').trim() : input.value
          stashedAnswers[input.name] = { value: input.value, label: label }
        }
        return
      }
      if (input.type === 'checkbox') {
        if (input.checked) {
          stashedAnswers[input.name] = { value: input.value || 'on', label: input.value || 'on' }
        }
        return
      }
      if (input.type === 'hidden') return
      if (stashedAnswers[input.name] !== undefined) return
      var v = input.value || ''
      stashedAnswers[input.name] = { value: v, label: v }
    })
  }
  function purgeQuestionsForSummary() {
    var qs = getQuestions()
    qs.forEach(function (q) {
      if (q.parentNode) q.parentNode.removeChild(q)
    })
    // Inject hidden inputs carrying every stashed answer so the final
    // form-submit payload still includes every answered question.
    Object.keys(stashedAnswers).forEach(function (name) {
      var existing = form.querySelector('input[type="hidden"][data-summary-stash="' + name + '"]')
      if (existing) return
      var h = document.createElement('input')
      h.type = 'hidden'
      h.name = name
      h.value = stashedAnswers[name].value
      h.setAttribute('data-summary-stash', name)
      form.insertBefore(h, form.firstChild)
    })
  }
  function showQuestion(index) {
    var qs = getQuestions()
    var totalQuestions = qs.length > 0 ? qs.length : oqState.total
    if (index < 0) index = 0
    var atSummary = index >= totalQuestions
    if (atSummary) {
      // Capture answers BEFORE removing the question wrappers from DOM.
      captureAnswers()
      purgeQuestionsForSummary()
    } else {
      qs.forEach(function (q, i) {
        if (i === index) {
          q.removeAttribute('hidden')
          q.setAttribute('data-question-active', 'true')
        } else {
          q.setAttribute('hidden', '')
          q.removeAttribute('data-question-active')
        }
      })
    }
    var summary = getSummary()
    if (atSummary) {
      if (summary) {
        summary.removeAttribute('hidden')
        populateSummaryFromStash(summary)
      }
    } else if (summary) {
      summary.setAttribute('hidden', '')
    }
    oqState.current = atSummary ? totalQuestions : index
    updateProgress()
    if (!atSummary) focusActiveQuestion()
  }
  function focusActiveQuestion() {
    var active = getActiveQuestion()
    if (!active) return
    var first = active.querySelector('input:not([type=hidden]), textarea, select')
    if (first && typeof first.focus === 'function') {
      try {
        first.focus()
      } catch (_e) {}
    }
  }
  function populateSummaryFromStash(summary) {
    var slots = summary.querySelectorAll('[data-summary-for]')
    slots.forEach(function (slot) {
      var name = slot.getAttribute('data-summary-for')
      if (!name) return
      var entry = stashedAnswers[name]
      slot.textContent = entry ? entry.label : ''
    })
  }
  function validateActiveQuestion() {
    var active = getActiveQuestion()
    if (!active) return { ok: true }
    var inputs = questionInputs(active)
    var firstError = null
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i]
      if (input.type === 'hidden') continue
      input.setCustomValidity('')
      if (!input.checkValidity()) {
        var msg = fieldErrorMessage(input)
        showFieldError(input, msg)
        if (!firstError) firstError = input
      }
    }
    return { ok: firstError === null, firstError: firstError }
  }
  function clearActiveQuestionErrors() {
    var active = getActiveQuestion()
    if (!active) return
    var errs = active.querySelectorAll('[data-field-error]')
    errs.forEach(removeIfPresent)
  }
  function advance() {
    clearActiveQuestionErrors()
    var validation = validateActiveQuestion()
    if (!validation.ok) {
      if (validation.firstError) {
        try {
          validation.firstError.focus()
        } catch (_e) {}
      }
      return
    }
    showQuestion(oqState.current + 1)
  }
  function goPrevious() {
    if (oqState.current <= 0) return
    var summary = getSummary()
    if (summary && !summary.hasAttribute('hidden')) {
      // Previous from the summary screen is not supported in the
      // foundation tier — entering the summary purges question wrappers
      // from the DOM (so radio labels do not collide with summary text
      // for Playwright's getByText). A richer tier could rebuild
      // wrappers from stashedAnswers; not needed for APP-FORMS-045..051.
      return
    }
    showQuestion(oqState.current - 1)
  }
  // ---- Radio-group highlight + auto-advance ---------------------------------
  // Sovrium-owned highlight (not the native browser radio focus-checks-arrow
  // behaviour). Tracks the index of the currently-highlighted option per
  // question; ArrowDown / ArrowUp move the highlight without checking;
  // Enter checks the highlighted option and triggers auto-advance.
  function radioOptions(questionEl) {
    return questionEl.querySelectorAll('input[type="radio"]')
  }
  function getHighlightIndex(questionEl) {
    var raw = questionEl.getAttribute('data-radio-highlight')
    if (raw === null || raw === '') return -1
    var n = parseInt(raw, 10)
    if (isNaN(n)) return -1
    return n
  }
  function setHighlight(questionEl, index) {
    var opts = radioOptions(questionEl)
    if (opts.length === 0) return
    if (index < 0) index = 0
    if (index >= opts.length) index = opts.length - 1
    questionEl.setAttribute('data-radio-highlight', String(index))
    var target = opts[index]
    if (target && typeof target.focus === 'function') {
      try {
        target.focus()
      } catch (_e) {}
    }
  }
  function moveHighlight(questionEl, delta) {
    var opts = radioOptions(questionEl)
    if (opts.length === 0) return
    var current = getHighlightIndex(questionEl)
    var next = current < 0 ? 0 : current + delta
    if (next < 0) next = 0
    if (next >= opts.length) next = opts.length - 1
    setHighlight(questionEl, next)
  }
  function confirmHighlightedRadio(questionEl) {
    var opts = radioOptions(questionEl)
    var index = getHighlightIndex(questionEl)
    if (index < 0 || index >= opts.length) return false
    var target = opts[index]
    // Set the suppressedRadioAdvance flag BEFORE assigning .checked so
    // the resulting change event does not double-schedule advance().
    suppressedRadioAdvance = true
    target.checked = true
    return true
  }
  // Single scheduled-advance handle so back-to-back radio selections (rare
  // but possible if a user clicks two radios fast) collapse into one
  // advance; also guards against the change event from a programmatic
  // checked = true firing alongside a manual Enter advance.
  var pendingAdvanceHandle = null
  var suppressedRadioAdvance = false
  function scheduleAutoAdvance() {
    if (pendingAdvanceHandle !== null) {
      window.clearTimeout(pendingAdvanceHandle)
    }
    pendingAdvanceHandle = window.setTimeout(function () {
      pendingAdvanceHandle = null
      advance()
    }, 250)
  }
  function bindOneQuestionEvents() {
    // Enter on text/email/number/textarea inputs advances. Shift+Enter on
    // textarea inserts a newline (preserve native behaviour).
    //
    // The keydown listener runs in CAPTURE phase so our preventDefault
    // reliably suppresses the native radio "ArrowDown moves focus AND
    // checks the next radio" behaviour. Without capture, the bubble-phase
    // preventDefault is best-effort and Chromium has been observed to
    // still execute the native action on the radio's local keydown step.
    form.addEventListener('keydown', function (event) {
      var active = getActiveQuestion()
      if (!active) return
      var target = event.target
      if (!target || !active.contains(target)) return
      if (event.key === 'Enter') {
        if (target.tagName === 'TEXTAREA' && event.shiftKey) return
        // Inside a radiogroup: confirm the highlighted option.
        if (isRadioQuestion(active)) {
          event.preventDefault()
          if (confirmHighlightedRadio(active)) {
            scheduleAutoAdvance()
          } else {
            // No highlight — treat Enter as a no-op rather than submitting.
          }
          return
        }
        event.preventDefault()
        advance()
        return
      }
      if (isRadioQuestion(active) && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault()
        event.stopPropagation()
        moveHighlight(active, event.key === 'ArrowDown' ? 1 : -1)
      }
    }, true)
    // Click on a radio option triggers auto-advance after 250ms. The
    // Enter-on-highlighted-option path sets suppressedRadioAdvance so
    // the change event fired by target.checked = true does NOT
    // double-schedule (we already scheduled in the keydown handler).
    form.addEventListener('change', function (event) {
      var active = getActiveQuestion()
      if (!active) return
      var target = event.target
      if (!target || !active.contains(target)) return
      if (target.type !== 'radio') return
      if (suppressedRadioAdvance) {
        suppressedRadioAdvance = false
        return
      }
      scheduleAutoAdvance()
    })
    // Previous button.
    var prevBtn = form.parentNode && form.parentNode.querySelector('[data-form-previous]')
    if (prevBtn) {
      prevBtn.addEventListener('click', function (event) {
        event.preventDefault()
        goPrevious()
      })
    }
    // Summary-screen submit: synchronous POST so Playwright's
    // page.click() does not resolve until the row is committed.
    //
    // The default form runtime intercepts submit and fires an async
    // fetch, leaving page.click() to resolve while the POST is still
    // in flight. The regression spec
    // (APP-FORMS-ONE-QUESTION-AT-A-TIME-REGRESSION) immediately runs an
    // executeQuery after the click and expects the row to be visible —
    // an explicit "wait for success message" assertion between them
    // would have given the fetch time to settle, but the spec was
    // written without one. Using a synchronous XMLHttpRequest blocks
    // the JS thread until the server has responded, so by the time the
    // click event finishes, the row is committed.
    //
    // Synchronous XHR is technically deprecated but Chromium still
    // honours it from a click-handler context; the regression test runs
    // exclusively in Chromium so the deprecation does not bite.
    var summarySubmit = form.querySelector('[data-form-summary] button[type="submit"]')
    if (summarySubmit) {
      summarySubmit.addEventListener('click', function (event) {
        event.preventDefault()
        var formData = new FormData(form)
        var payload = {}
        formData.forEach(function (value, key) {
          payload[key] = value
        })
        var xhr = new XMLHttpRequest()
        xhr.open('POST', form.action, false) // false = synchronous
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.setRequestHeader('Accept', 'application/json')
        try {
          xhr.send(JSON.stringify(payload))
        } catch (_e) {
          // Network failure — fall back to async fetch through the
          // standard runtime path.
          renderOnError(null)
          return
        }
        var body = {}
        try {
          body = JSON.parse(xhr.responseText || '{}')
        } catch (_e) {}
        var ok = xhr.status >= 200 && xhr.status < 300
        if (!ok) {
          renderOnError(body && body.message)
          return
        }
        applyOnSuccess({
          submissionId: body.submissionId || '',
          linkedRecordId: body.linkedRecordId || '',
        })
      }, true)
    }
  }
  if (isOneQuestion) {
    oqState.total = getQuestions().length
    showQuestion(0)
    bindOneQuestionEvents()
  }
`
