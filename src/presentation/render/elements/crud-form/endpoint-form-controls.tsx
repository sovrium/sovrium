/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The controls of an endpoint-bound `form` (`form.endpoint`), one per
 * `control` literal, and the prefill rule they all share.
 *
 * The form itself — its `<form>`, the label and help-text chrome around each
 * control, the submit — is `endpoint-form-renderer.tsx`; this module draws what
 * sits INSIDE the label: the typed input, the textarea, the native select, the
 * switch, and the hidden input a `hidden` field becomes.
 *
 * Two field flags change how a control is drawn without changing what it sends:
 *
 *  - `hidden`: no control and no label, an `<input type="hidden">` carrying the
 *    prefill. The value still travels; nothing is drawn for the visitor to type
 *    in. The `$session.*` prefill rule applies to it unchanged, so the served
 *    bytes never print a caller's identity even for a field nobody sees.
 *  - `readOnly`: shown, not editable, still submitted. A text control carries
 *    the browser's own `readonly`, never `disabled` — a disabled control drops
 *    out of the form data set and the tab order, a read-only one stays in both.
 *    A native `<select>` and a checkbox have no `readonly` of their own, so a
 *    read-only one is drawn `disabled` and says why with `aria-readonly="true"`.
 *    A disabled select contributes nothing to `FormData`, so it is given a
 *    hidden twin under the same `name` carrying the same prefill (the twin is
 *    the one the browser sends, and the session resolver fills both). A select
 *    with no `defaultValue` SHOWS its first option — the browser selects it on
 *    any select with nothing marked — so its twin carries that first option
 *    too: what is shown is what is posted, never an empty string. A switch
 *    needs no twin: the submit runtime reads every switch's `checked` directly,
 *    disabled ones included (`islands/runtime/endpoint-form-runtime.ts`).
 */

import { type ReactElement } from 'react'
import { autofillHintOverlay } from '@/domain/models/app/forms/form-autofill-hint-service'
import { fieldDescriptionId } from '@/presentation/design/field-display'
import {
  computeInputDefaultClasses,
  computeTextareaDefaultClasses,
} from '@/presentation/design/input-default-classes'
import {
  computeFormFieldLabelClasses,
  computeFormSwitchClasses,
  computeFormSwitchFieldClasses,
} from '../../../design/forms-default-classes'
import { passwordRuleId, type PasswordAid } from './endpoint-form-password'
import { ruleProps } from './endpoint-form-rules'
import type { FormPart } from './endpoint-form-parts'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'

/**
 * shadcn/ui's `Input` for an input or a native select and its `Textarea` for a
 * textarea — the recipes the table-bound form draws, so both forms are one size.
 */
const CONTROL_CLASS = computeInputDefaultClasses()
const TEXTAREA_CLASS = computeTextareaDefaultClasses()

/** A `select` option as read off an endpoint-bound field (`{ value, label? }`). */
type EndpointFieldOption = { readonly value: string; readonly label?: string }

/**
 * The `aria-describedby` for one field's control, or nothing when the field
 * carries no `description` and states no password rule. The ids are the ones
 * the renderer's help text stamps on each sentence — the author's first, then
 * the rule — so the control is DESCRIBED by them, the association a screen
 * reader announces with the field, rather than merely sitting near them.
 *
 * A password field a Better Auth refusal can be about also carries the reason
 * the browser draws on it then (`data-refused-message`).
 */
function describedByProps(field: FormFieldConfig, aid: PasswordAid = {}): Record<string, string> {
  const ids = [
    ...(field.description === undefined ? [] : [fieldDescriptionId(field.field)]),
    ...(aid.rule === undefined ? [] : [passwordRuleId(field)]),
  ]
  return {
    ...(ids.length > 0 && { 'aria-describedby': ids.join(' ') }),
    ...(aid.refused !== undefined && { 'data-refused-message': aid.refused }),
  }
}

/** The marker the client session resolver fills a prefilled control from. */
const SESSION_VALUE_ATTRIBUTE = 'data-session-value'

/** The token that makes a `defaultValue` the CALLER's own rather than everyone's. */
const SESSION_TOKEN_MARKER = '$session.'

/**
 * The prefill props for one field's control — the whole of the identity rule,
 * in one place, so no control type can be given the safe half and miss the
 * dangerous one.
 *
 * A STATIC default is the same for every reader, so it costs the page nothing
 * and is rendered into the bytes as an ordinary `defaultValue`.
 *
 * A default naming `$session.*` is the caller's OWN value, and resolving it
 * during SSR would write whoever requested the page first into every cached
 * copy of it. So the server emits NO value and a marker carrying the TEMPLATE,
 * which the browser resolves against the caller's own session
 * (`islands/runtime/session-resolver.ts`). An anonymous caller resolves it to
 * the empty string, which is why the marker is an absence and never a literal:
 * a visitor reading `$session.name` in a form box is the visible failure.
 *
 * React needs `defaultValue` rather than `value` here — these are uncontrolled
 * controls with no `onChange`, and `value` would freeze them read-only. On a
 * `<select>` the same prop is what marks the matching `<option selected>`,
 * which is the only way a dropdown can carry a default at all.
 */
function prefillProps(field: FormFieldConfig): Record<string, string> {
  const declared = field.defaultValue
  if (declared === undefined) return {}
  const asText = String(declared)
  if (asText.includes(SESSION_TOKEN_MARKER)) return { [SESSION_VALUE_ATTRIBUTE]: asText }
  return { defaultValue: asText }
}

/**
 * The prefill props for a `switch`. The same identity rule as
 * {@link prefillProps}, in its on/off form: a boolean (or the string `'true'`)
 * is the same for every reader and is rendered as `checked`; a `$session.*`
 * default is the caller's own and is emitted as the TEMPLATE, the switch drawn
 * OFF, for the browser to set once it has read the caller's session. So the
 * served bytes never say `aria-checked="true"` for somebody's saved preference.
 *
 * `aria-checked` is written explicitly even though a native checkbox already
 * exposes its state: the attribute is what a switch's contract names, and the
 * client runtime keeps it in step with `checked` on every change.
 */
function switchPrefillProps(field: FormFieldConfig): Record<string, string | boolean> {
  const declared = field.defaultValue
  if (typeof declared === 'string' && declared.includes(SESSION_TOKEN_MARKER)) {
    return { [SESSION_VALUE_ATTRIBUTE]: declared, 'aria-checked': 'false' }
  }
  const on = declared === true || declared === 'true'
  return { defaultChecked: on, 'aria-checked': on ? 'true' : 'false' }
}

/**
 * The props that make a control with no `readonly` of its own inert: `disabled`
 * so it cannot be moved, and `aria-readonly="true"` so assistive technology
 * hears WHY — the value is fixed, not unavailable. Nothing for an editable field.
 */
function inertWhenReadOnly(field: FormFieldConfig): Record<string, string | boolean> {
  return field.readOnly === true ? { disabled: true, 'aria-readonly': 'true' } : {}
}

/** The browser's own `readonly` for a text control, and nothing for an editable one. */
function readOnlyProps(field: FormFieldConfig): Record<string, boolean> {
  return field.readOnly === true ? { readOnly: true } : {}
}

/**
 * A `hidden` field: the value travels, nothing is drawn. The same prefill rule
 * as every other control, so a `$session.*` default is filled in the browser
 * and the served bytes name nobody. No label, no help text, no rule marks: a
 * browser never checks `required` on a hidden input, which is why the schema
 * refuses a hidden required field that has nothing to carry.
 */
export function renderEndpointHiddenField(field: FormFieldConfig): ReactElement {
  return (
    <input
      key={field.field}
      type="hidden"
      name={field.field}
      {...prefillProps(field)}
    />
  )
}

/**
 * A `switch` field: a native checkbox carrying `role="switch"`, labelled by the
 * `<label>` that wraps it. It submits through the same endpoint runtime as every
 * other control, which reads it as a JSON boolean — `false` included, never
 * omitted (`islands/client.ts`), because an unchecked checkbox contributes
 * nothing to `FormData` and a partial update reads "absent" as "leave it alone".
 * It sends when it changes only on a form declaring `submitOn: 'change'`;
 * otherwise the form's own submit button saves it.
 */
export function renderEndpointSwitchField(field: FormFieldConfig): ReactElement {
  return (
    <label
      key={field.field}
      className={computeFormSwitchFieldClasses()}
    >
      <input
        type="checkbox"
        role="switch"
        name={field.field}
        data-control="switch"
        className={computeFormSwitchClasses()}
        {...describedByProps(field)}
        {...switchPrefillProps(field)}
        {...inertWhenReadOnly(field)}
      />
      <span className={computeFormFieldLabelClasses()}>{field.label ?? field.field}</span>
    </label>
  )
}

/**
 * The field a read-only select's hidden twin is prefilled from. A declared
 * `defaultValue` — a `$session.*` one included, which {@link prefillProps}
 * still turns into the client-filled marker — is kept as is; with none, the
 * twin takes the FIRST option, the one the browser shows on a select with
 * nothing marked, so the body says what the visitor read and never `''`.
 */
function selectTwinField(
  field: FormFieldConfig,
  options: readonly EndpointFieldOption[]
): FormFieldConfig {
  if (field.defaultValue !== undefined) return field
  const shown = options[0]?.value
  return shown === undefined ? field : { ...field, defaultValue: shown }
}

/**
 * A `select` field's dropdown. A read-only one is inert and keeps its `name`
 * (a disabled control is not in the form data set, so no key is sent twice)
 * beside a hidden twin carrying the same prefill — the control the browser DOES
 * send, filled from the same session marker when the default is the caller's,
 * and from the first option when the field names no default at all.
 */
function renderEndpointSelect(
  field: FormFieldConfig,
  controlClass: string,
  prefill: Record<string, string>
): ReactElement {
  const options = (field.options ?? []) as readonly EndpointFieldOption[]
  const select = (
    <select
      name={field.field}
      className={controlClass}
      {...prefill}
      {...inertWhenReadOnly(field)}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label ?? option.value}
        </option>
      ))}
    </select>
  )
  if (field.readOnly !== true) return select
  return (
    <>
      {select}
      {renderEndpointHiddenField(selectTwinField(field, options))}
    </>
  )
}

/** Render the inner control element for one endpoint field, keyed off its `control`. */
export function renderEndpointControl(
  field: FormFieldConfig,
  part: FormPart,
  aid: PasswordAid = {}
): ReactElement {
  const name = field.field
  const controlClass = part('input', field.control === 'textarea' ? TEXTAREA_CLASS : CONTROL_CLASS)
  const { autocomplete } = autofillHintOverlay(field.control ?? 'text', field.autocomplete)
  const prefill = {
    ...describedByProps(field, aid),
    ...prefillProps(field),
    ...ruleProps(field),
    ...(autocomplete === undefined ? {} : { autoComplete: autocomplete }),
  }
  if (field.control === 'select') return renderEndpointSelect(field, controlClass, prefill)
  if (field.control === 'textarea') {
    return (
      <textarea
        name={name}
        className={controlClass}
        {...prefill}
        {...readOnlyProps(field)}
      />
    )
  }
  // text / email / password / number / tel / url → a native typed input. The
  // `control` literal IS the HTML input type for every remaining variant.
  return (
    <input
      type={field.control ?? 'text'}
      name={name}
      className={controlClass}
      data-default-value={
        field.defaultValue === undefined ? '' : prefillProps(field)['defaultValue']
      }
      {...prefill}
      {...readOnlyProps(field)}
    />
  )
}
