/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Submit interception: inline JS source for the standalone form runtime's
 * submit path, sliced out of `form-runtime.tsx` so that file stays under its
 * size ceiling; concatenated verbatim at the end of the IIFE.
 *
 * The native submit is replaced by a JSON (or multipart) POST whose answer
 * drives the configured feedback. While the POST is in flight the button that
 * sent it is pending (`holdWhile`, the pending fragment): disabled, busy, the
 * spinner and the in-flight word — `display.pendingLabel` or the built-in
 * `form.sending` — and a second press or Enter is ignored. A refusal shows the
 * field errors, puts the focus on the first refused field (else on the submit,
 * given back by then), and only then shows `onError`.
 *
 * Assumes the surrounding IIFE provides `form`, `config`, `S`, `FAILED`,
 * `onError`, `clearFieldErrors`, `validateForm`, `showFieldError`,
 * `renderOnError`, `announceRecordWritten`, `applyOnSuccess`, `snapshotValues`,
 * `renderEditLink`, `hasFileInputs`, `buildMultipartBody`, `interpolate`,
 * `isMultiStep`, `advanceFromEnter`, `submitButtonOf`, `holdWhile` and
 * `leavesPage`.
 *
 * A success that redirects to another document keeps the submit pending until
 * the page leaves (the redirect may wait a few seconds); a success that stays
 * gives it back with the focus on it.
 *
 * The idempotency key (`_idempotency`, `form-idempotency-key.tsx`) rides with
 * every submission, in the body and as the `Idempotency-Key` header. A form
 * drawn on a page carries none, so it is minted here as the page loads; a
 * success mints the next one, so a further submission is a new one.
 */
export const FORM_RUNTIME_SUBMIT_SCRIPT = `
  var idempotencyInput = form.querySelector('input[name="_idempotency"]')
  function mintIdempotencyKey() {
    if (!idempotencyInput) return
    var bytes = crypto.getRandomValues(new Uint8Array(16))
    var key = Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2) }).join('')
    idempotencyInput.value = key
    idempotencyInput.setAttribute('value', key)
  }
  if (idempotencyInput && !idempotencyInput.value) mintIdempotencyKey()
  function idempotencyHeaders(headers) {
    if (idempotencyInput && idempotencyInput.value) headers['Idempotency-Key'] = idempotencyInput.value
    return headers
  }
  // A refusal: the field errors, the focus (the first refused field, else the
  // submit, given back by now), then the notice.
  function handleSubmissionResult(result, submitBtn) {
    if (!result.ok) {
      var refused = (result.body && Array.isArray(result.body.fieldErrors) ? result.body.fieldErrors : [])
        .map(function (entry) {
          var input = form.querySelector('[name="' + entry.name + '"]')
          if (input) showFieldError(input, entry.message)
          return input
        })
        .filter(Boolean)
      var target = refused[0] || submitBtn
      if (target) target.focus()
      renderOnError(result.body && result.body.message)
      return
    }
    var response = responseOf(result.body)
    mintIdempotencyKey()
    announceRecordWritten(result.body, response)
    applyOnSuccess(response)
    renderEditLink(result.body.editUrl)
    // A success that stays: the focus is back on the submit, never on the page.
    if (submitBtn && !successLeaves(result)) submitBtn.focus()
  }
  function responseOf(body) {
    return {
      submissionId: body.submissionId || '',
      linkedRecordId: body.linkedRecordId || '',
      // Bound-table columns for $record.<column> (absent on table-less forms).
      record: body.record || {},
      form: snapshotValues(),
    }
  }
  // A success redirecting to another document keeps the submit busy until it goes.
  function successLeaves(result) {
    if (!result.ok || onSuccess.type !== 'redirect') return false
    return leavesPage(interpolate(onSuccess.url || '/', responseOf(result.body || {}), true))
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault()
    // Enter on a step that is not the last moves on, as Next does.
    if (isMultiStep && advanceFromEnter()) return
    var submitBtn = submitButtonOf(form, event)
    if (submitBtn && submitBtn.getAttribute('data-pending') === 'true') return
    clearFieldErrors()
    var validation = validateForm()
    if (!validation.ok) {
      renderOnError(onError.message || FAILED)
      return
    }
    var fetchInit
    if (hasFileInputs) {
      fetchInit = {
        method: 'POST',
        headers: idempotencyHeaders({ Accept: 'application/json' }),
        body: buildMultipartBody(),
      }
    } else {
      fetchInit = {
        method: 'POST',
        headers: idempotencyHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(snapshotValues()),
      }
    }
    var held = holdWhile(submitBtn, config.pendingLabel || S['form.sending'] || 'Sending…', function () {
      return fetch(form.action, fetchInit).then(function (response) {
        return response
          .json()
          .catch(function () {
            return {}
          })
          .then(function (body) {
            return { ok: response.ok, status: response.status, body: body || {} }
          })
      })
    }, successLeaves)
    if (!held) return
    held
      .then(function (result) {
        handleSubmissionResult(result, submitBtn)
      })
      .catch(function (_err) {
        if (submitBtn) submitBtn.focus()
        renderOnError(null)
      })
  })
`
