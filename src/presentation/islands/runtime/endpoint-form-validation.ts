/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rules an endpoint-bound form's fields state themselves (`required`,
 * `minLength`, `maxLength`), checked before the form sends.
 *
 * The renderer puts each rule on its control as the native attribute and marks
 * the form `novalidate`, so the browser's own bubble never pre-empts this pass.
 * A refused control is marked the way a table-bound form marks one
 * (`render/forms/form-runtime-field-errors.ts`): `aria-invalid`, a `role="alert"`
 * reason naming the field by its label, and an `aria-describedby` pointing at
 * it. The reason is drawn in the field's `data-field-block`, outside the label,
 * so it never becomes part of the control's accessible name.
 *
 * `minLength` is checked here rather than read from `validity.tooShort`, which
 * the browser only raises after a typed edit: a value set any other way would
 * otherwise slip through. Any other refusal the browser itself finds (a
 * malformed email, say) is announced in the browser's own words.
 */

/** The controls of an endpoint form a rule can apply to. */
const CONTROL_SELECTOR = 'input:not([type="hidden"]), select, textarea'

type RuledControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

/** The field as the visitor reads it: the label's own text, the control's name otherwise. */
function labelOf(control: RuledControl): string {
  const text = control.closest('label')?.querySelector('span')?.textContent?.trim()
  return text || control.name
}

/** The reason `control` is refused, or `undefined` when it keeps its rules. */
function endpointFieldError(control: RuledControl): string | undefined {
  const label = labelOf(control)
  const { value } = control
  const min = 'minLength' in control ? control.minLength : 0
  if (control.required && value.trim() === '') return `${label} is required`
  if (value !== '' && value.length < min) return `${label} must be at least ${min} characters`
  return control.validity.valid ? undefined : `${label}: ${control.validationMessage}`
}

/** Remove every reason the last check drew on `form`, and the marks pointing at them. */
function clearFieldErrors(form: HTMLFormElement): void {
  form.querySelectorAll('[data-field-error]').forEach((reason) => reason.remove())
  form.querySelectorAll<RuledControl>('[aria-invalid]').forEach((control) => {
    control.removeAttribute('aria-invalid')
    const rest = control.getAttribute('data-described-by')
    control.removeAttribute('data-described-by')
    if (rest) control.setAttribute('aria-describedby', rest)
    else control.removeAttribute('aria-describedby')
  })
}

/** Draw `message` under `control` and mark the control invalid. */
function showFieldError(form: HTMLFormElement, control: RuledControl, message: string): void {
  const reason = document.createElement('div')
  reason.id = `${control.name}-error-${Math.random().toString(36).slice(2)}`
  reason.setAttribute('data-field-error', control.name)
  reason.setAttribute('role', 'alert')
  reason.className = `field-error ${form.getAttribute('data-error-class') ?? ''}`.trim()
  reason.textContent = message
  const block = control.closest('[data-field-block]')
  if (block) block.append(reason)
  else (control.closest('label') ?? control).after(reason)
  const described = control.getAttribute('aria-describedby')
  if (described) control.setAttribute('data-described-by', described)
  control.setAttribute('aria-invalid', 'true')
  control.setAttribute('aria-describedby', `${described ?? ''} ${reason.id}`.trim())
}

/**
 * Check every control of `form` against its rules. Each refused control is
 * marked with its reason and the first one takes focus; `true` means the form
 * may send.
 */
export function checkEndpointFormRules(form: HTMLFormElement): boolean {
  clearFieldErrors(form)
  const refused = [...form.querySelectorAll<RuledControl>(CONTROL_SELECTOR)].flatMap((control) => {
    const message = control.disabled ? undefined : endpointFieldError(control)
    return message === undefined ? [] : [{ control, message }]
  })
  refused.forEach(({ control, message }) => showFieldError(form, control, message))
  refused[0]?.control.focus()
  return refused.length === 0
}
