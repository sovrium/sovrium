/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { FORM_RUNTIME_FILE_HANDLERS_SCRIPT } from './form-runtime-file-handlers'
import { FORM_RUNTIME_MULTI_STEP_SCRIPT } from './form-runtime-multi-step'
import { FORM_RUNTIME_ONE_QUESTION_SCRIPT } from './form-runtime-one-question'
import type { Form, FormOnError, FormOnSuccess } from '@/domain/models/app/forms'

export interface FormRuntimeConfig {
  readonly formName: string
  readonly onSuccess?: FormOnSuccess
  readonly onError?: FormOnError
  readonly multiStep: boolean
  readonly stepIds: ReadonlyArray<string>
  readonly oneQuestion: boolean
}

export function buildFormRuntimeConfig(form: Readonly<Form>): FormRuntimeConfig {
  const isMultiStep =
    form.layout === 'multi-step' && form.steps !== undefined && form.steps.length > 0
  const isOneQuestion = form.layout === 'one-question'
  return {
    formName: form.name,
    ...(form.onSuccess !== undefined ? { onSuccess: form.onSuccess } : {}),
    ...(form.onError !== undefined ? { onError: form.onError } : {}),
    multiStep: isMultiStep,
    stepIds: isMultiStep ? form.steps!.map((step) => step.id) : [],
    oneQuestion: isOneQuestion,
  }
}

export const FORM_RUNTIME_SCRIPT = `(function () {
  var configEl = document.querySelector('script[data-form-config]')
  if (!configEl) return
  var config
  try {
    config = JSON.parse(configEl.textContent || '{}')
  } catch (_err) {
    return
  }
  var formName = config.formName
  if (!formName) return
  var form = document.querySelector('form[data-form-name="' + formName + '"]')
  if (!form) return
  // The runtime owns validation end-to-end: it inspects each input via
  // checkValidity() and renders inline error markers. Disabling native
  // validation here (rather than in the SSR markup) keeps the no-JS
  // fallback honest — without a runtime, the browser still surfaces its
  // built-in popup tooltips on submit.
  form.setAttribute('novalidate', '')
  var onSuccess = config.onSuccess || { type: 'toast', message: 'Submitted.' }
  var onError = config.onError || { type: 'toast', message: 'Submission failed.' }
  var stepIds = Array.isArray(config.stepIds) ? config.stepIds : []
  var isMultiStep = config.multiStep === true && stepIds.length > 0
  var isOneQuestion = config.oneQuestion === true
  // Single source of truth for the named-inputs selector. Repeated as a
  // bare string literal three times in earlier revisions; centralising it
  // removes duplication and makes future changes (e.g. excluding a new
  // input variant) a one-line edit.
  var INPUT_SELECTOR = 'input[name], textarea[name], select[name]'
  function namedInputs() {
    return form.querySelectorAll(INPUT_SELECTOR)
  }
  // Defensive DOM removal helper — every cleanup site needed the same
  // null-guarded \`parentNode.removeChild\` dance. Centralising it kills
  // 5+ inline duplicates and saves bytes on the wire.
  function removeIfPresent(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el)
  }
  var initialValues = collectInitialValues(form)

${FORM_RUNTIME_MULTI_STEP_SCRIPT}
${FORM_RUNTIME_ONE_QUESTION_SCRIPT}

  // ---- Inline validation -----------------------------------------------------
  function clearFieldErrors() {
    var errs = form.querySelectorAll('[data-field-error]')
    errs.forEach(removeIfPresent)
    removeIfPresent(form.parentNode && form.parentNode.querySelector('[data-form-error-message]'))
    removeIfPresent(document.querySelector('[data-form-toast="' + formName + '"]'))
  }
  function showFieldError(input, message) {
    var wrapper = input.closest('.form-field')
    if (!wrapper) return
    removeIfPresent(wrapper.querySelector('[data-field-error]'))
    var err = document.createElement('div')
    err.setAttribute('data-field-error', input.name || '')
    err.setAttribute('role', 'alert')
    err.className = 'field-error'
    err.textContent = message
    wrapper.appendChild(err)
  }
  function fieldErrorMessage(input) {
    var v = input.validity
    var label = input.name || 'Field'
    if (v.valueMissing) return label + ' is required'
    if (v.typeMismatch) {
      if (input.type === 'email') return 'Please enter a valid email'
      if (input.type === 'url') return 'Please enter a valid URL'
      return label + ' is invalid'
    }
    if (v.patternMismatch) return label + ' does not match the required pattern'
    return label + ' is invalid'
  }
  function validateForm() {
    var inputs = namedInputs()
    var firstError = null
    var errors = []
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i]
      if (input.type === 'hidden') continue
      input.setCustomValidity('')
      if (!input.checkValidity()) {
        var msg = fieldErrorMessage(input)
        showFieldError(input, msg)
        errors.push({ name: input.name, message: msg })
        if (!firstError) firstError = input
      }
    }
    return { ok: errors.length === 0, errors: errors, firstError: firstError }
  }

  // ---- Banner / Toast UI -----------------------------------------------------
  // Three near-identical "remove old, create div, set attrs, insert" blocks
  // collapsed into one helper. Saves ~30 lines, removes a class of bug
  // where one site forgets to remove the previous instance and stacks
  // them on retry.
  function renderBanner(opts) {
    removeIfPresent(form.parentNode && form.parentNode.querySelector(opts.selector))
    var box = document.createElement('div')
    box.setAttribute(opts.attr, formName)
    box.setAttribute('role', opts.role)
    box.className = opts.className
    box.textContent = opts.message
    form.parentNode.insertBefore(box, form)
  }
  function renderOnError(message) {
    var msg = message || onError.message || 'Submission failed.'
    if (onError.type === 'message' || onError.type === 'errorPage') {
      renderBanner({
        selector: '[data-form-error-message]',
        attr: 'data-form-error-message',
        role: 'alert',
        className: 'form-error-banner',
        message: msg,
      })
    } else {
      renderToast(msg, onError.variant || 'error')
    }
  }
  function renderToast(message, variant) {
    removeIfPresent(document.querySelector('[data-form-toast="' + formName + '"]'))
    var toast = document.createElement('div')
    toast.setAttribute('data-form-toast', formName)
    toast.setAttribute('data-variant', variant || 'success')
    toast.setAttribute('role', 'status')
    toast.className = 'form-toast'
    toast.textContent = message
    document.body.appendChild(toast)
  }

  // ---- onSuccess interpolation ----------------------------------------------
  function interpolate(template, response) {
    if (typeof template !== 'string') return ''
    return template
      .replace(/\\$submission\\.id/g, response.submissionId || '')
      .replace(/\\$record\\.id/g, response.linkedRecordId || '')
  }

  // ---- onSuccess UI ----------------------------------------------------------
  function renderSuccessPage(response) {
    var container = form.parentNode
    if (!container) return
    var section = document.createElement('section')
    section.setAttribute('data-form-success', formName)
    section.className = 'form-success-page'
    if (onSuccess.title) {
      var h = document.createElement('h2')
      h.textContent = interpolate(onSuccess.title, response)
      section.appendChild(h)
    }
    if (onSuccess.message) {
      var p = document.createElement('p')
      p.textContent = interpolate(onSuccess.message, response)
      section.appendChild(p)
    }
    if (Array.isArray(onSuccess.actions)) {
      var actionsBar = document.createElement('div')
      actionsBar.className = 'form-success-actions'
      onSuccess.actions.forEach(function (action) {
        var btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = action.label
        btn.setAttribute('data-success-action', action.action)
        btn.addEventListener('click', function () {
          if (action.action === 'reset') {
            section.parentNode.removeChild(section)
            form.removeAttribute('hidden')
            applyReset(response, true)
          } else if (action.action === 'navigate') {
            var target = interpolate(action.url || '/', response)
            window.location.assign(target)
          }
        })
        actionsBar.appendChild(btn)
      })
      section.appendChild(actionsBar)
    }
    form.setAttribute('hidden', '')
    container.appendChild(section)
  }

  function applyReset(response, force) {
    // Use the source array directly with indexOf — earlier revisions built
    // a lookup object via reduce(), but a field literally named
    // "__proto__" or "hasOwnProperty" would have collided with
    // Object.prototype keys. indexOf on a small array is also faster in
    // practice for the typical preserveFields list (1-3 entries).
    var preserve = onSuccess.preserveFields || []
    var inputs = namedInputs()
    inputs.forEach(function (input) {
      if (input.type === 'hidden') return
      if (preserve.indexOf(input.name) >= 0) return
      if (input.type === 'checkbox' || input.type === 'radio') {
        input.checked = false
      } else {
        input.value = initialValues[input.name] || ''
      }
    })
    if (isMultiStep) showStep(0)
    if (!force && onSuccess.message) renderToast(onSuccess.message, 'success')
  }

  function applyOnSuccess(response) {
    var type = onSuccess.type || 'toast'
    if (type === 'successPage') {
      renderSuccessPage(response)
      return
    }
    if (type === 'redirect') {
      var url = interpolate(onSuccess.url || '/', response)
      var delay = typeof onSuccess.delaySeconds === 'number' ? onSuccess.delaySeconds : 2
      if (delay <= 0) {
        window.location.assign(url)
      } else {
        window.setTimeout(function () {
          window.location.assign(url)
        }, delay * 1000)
      }
      return
    }
    if (type === 'reset') {
      applyReset(response, false)
      return
    }
    if (type === 'message') {
      renderBanner({
        selector: '[data-form-success-message]',
        attr: 'data-form-success-message',
        role: 'status',
        className: 'form-success-banner',
        message: interpolate(onSuccess.message || 'Submitted.', response),
      })
      return
    }
    // Default: toast
    renderToast(
      interpolate(onSuccess.message || 'Submitted.', response),
      onSuccess.variant || 'success'
    )
  }

  // ---- File-input handling (sliced into form-runtime-file-handlers.ts) ----
${FORM_RUNTIME_FILE_HANDLERS_SCRIPT}
  // ---- Submit interception ---------------------------------------------------
  function collectInitialValues(formEl) {
    var snapshot = {}
    var inputs = formEl.querySelectorAll(INPUT_SELECTOR)
    inputs.forEach(function (input) {
      if (input.type === 'hidden') return
      if (snapshot[input.name] === undefined) snapshot[input.name] = input.defaultValue || ''
    })
    return snapshot
  }

  function buildJsonPayload() {
    var formData = new FormData(form)
    var payload = {}
    // Repeated keys (multi-select / checkbox groups / array hidden inputs) must
    // collect into an array — a plain overwrite keeps only the last value.
    formData.forEach(function (value, key) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        if (Array.isArray(payload[key])) payload[key].push(value)
        else payload[key] = [payload[key], value]
      } else {
        payload[key] = value
      }
    })
    return payload
  }

  function handleSubmissionResult(result) {
    if (!result.ok) {
      if (result.body && Array.isArray(result.body.fieldErrors)) {
        result.body.fieldErrors.forEach(function (entry) {
          var input = form.querySelector('[name="' + entry.name + '"]')
          if (input) showFieldError(input, entry.message)
        })
      }
      renderOnError(result.body && result.body.message)
      return
    }
    applyOnSuccess({
      submissionId: result.body.submissionId || '',
      linkedRecordId: result.body.linkedRecordId || '',
    })
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault()
    clearFieldErrors()
    var validation = validateForm()
    if (!validation.ok) {
      renderOnError(onError.message || 'Submission failed.')
      return
    }
    var fetchInit
    if (hasFileInputs) {
      fetchInit = {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: buildMultipartBody(),
      }
    } else {
      fetchInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(buildJsonPayload()),
      }
    }
    fetch(form.action, fetchInit)
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {}
          })
          .then(function (body) {
            return { ok: response.ok, status: response.status, body: body || {} }
          })
      })
      .then(handleSubmissionResult)
      .catch(function (_err) {
        renderOnError(null)
      })
  })
})()`

export function FormRuntimeMount({ form }: { readonly form: Form }) {
  const configJson = JSON.stringify(buildFormRuntimeConfig(form))
  return (
    <>
      <script
        type="application/json"
        data-form-config="true"
        dangerouslySetInnerHTML={{ __html: configJson }}
      />
      <script
        dangerouslySetInnerHTML={{ __html: FORM_RUNTIME_SCRIPT }}
      />
    </>
  )
}
