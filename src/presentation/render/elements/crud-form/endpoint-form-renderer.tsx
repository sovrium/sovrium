/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Custom-endpoint submit form renderer (`form.endpoint`).
 *
 * A `form` normally writes to its bound `app.tables` table (the `crud` island
 * path) or a referenced `app.forms[]`. The `endpoint` block is a THIRD submit
 * mode: the form POSTs its collected field values as a JSON body
 * (`{ [field]: value }`) to an ARBITRARY `url` — a Better-Auth admin endpoint, a
 * custom operate route, anything — NOT the records API. It is the form-counterpart
 * to the standalone `fetch` operate button (arbitrary endpoint).
 *
 * Unlike the table-bound `crud` form (a React island that owns its field state and
 * mutates the records API), the endpoint form is a PLAIN server-rendered `<form>`
 * enhanced by the always-loaded vanilla runtime (`client.ts` — a `form` component
 * already emits `/assets/client.js` because `form` is an INTERACTIVE_COMPONENT_TYPE).
 * On submit the runtime reads the form's `FormData`, builds a `type: 'fetch'`
 * action carrying the collected values as its `body`, and dispatches it through the
 * SHARED `executeFetchAction` — reusing the response-envelope evaluation, the
 * `onSuccess`/`onError` toast, and the `onSuccess` `status`/`refetch` client-state
 * effects (so a sibling `dataSource.system` directory grid refreshes after the
 * create). No island, no React-hydration race: the SSR `<form>` IS the live form.
 *
 * Each field names its own explicit `control` (no table column type to derive
 * from); a `select` field carries `options`. The controls reuse the shared form
 * field-chrome class helpers (`computeFormFieldClasses` / `computeFormFieldLabelClasses`)
 * for label/control consistency, rendering the `<label>` inline — the sanctioned
 * pattern for non-CRUD form renderers (the CRUD field shell is CRUD-only).
 *
 * The submit takes the platform button recipe, which is the SAME call the two
 * neighbouring submits already make — the hydrated CRUD form's
 * (`islands/parts/crud-form/layout.tsx`) and the auth form's
 * (`auth-form-renderer.tsx`). Without a class string, a form's primary action
 * renders as bare text on every endpoint-bound form in the admin console (the
 * profile forms, "Send invitation" on the Users console, the link create and
 * re-point forms) while the `button` components beside them are fully dressed. Reaching for the shared recipe rather than
 * hand-written utilities is what keeps all three submits identical: a second
 * recipe here would drift from the other two on the next design change.
 *
 * `endpoint.submitVariant` names the submit's WEIGHT in that same recipe's
 * vocabulary, for the page that stacks several small forms and would otherwise
 * draw a column of primary buttons none of which is its main action. Omitting it
 * calls the recipe with no argument, so every existing form's submit keeps its
 * class string to the byte.
 */

import { type ReactElement } from 'react'
import {
  computeSubmitButtonClasses,
  type ButtonVariant,
} from '@/presentation/design/button-default-classes'
import { fieldDescriptionId } from '@/presentation/design/field-display'
import { computeFormHelpTextClasses } from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeFormClasses,
  computeFormControlClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
  computeFormSwitchClasses,
  computeFormSwitchFieldClasses,
} from '../../../design/forms-default-classes'
import { omitInternalMarkers } from '../../props/internal-marker-props'
import { formPartOf, type FormPart } from './endpoint-form-parts'
import { formRuleProps, hasRules, ruleProps } from './endpoint-form-rules'
import type { ElementProps } from '../html-element-renderer'
import type { Component } from '@/domain/models/app/pages/components'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'
import type { ComponentDesignResolution } from '@/presentation/design/resolve-component-classes'

/**
 * The custom-endpoint submit target read off the `form` component. Mirrors the
 * domain `FormEndpointSchema` shape (kept local so this presentation renderer does
 * not import a domain type that is only described, not exported, as a type alias).
 * `onSuccess` / `onError` are forwarded verbatim to the client runtime, which hands
 * them to `executeFetchAction` (so their shapes match `FetchAction`'s slots).
 */
interface EndpointConfig {
  readonly url: string
  readonly method?: 'POST' | 'PUT' | 'PATCH'
  readonly responseEnvelope?: string
  readonly submitLabel?: string
  readonly submitVariant?: ButtonVariant
  readonly onSuccess?: unknown
  readonly onError?: unknown
}

/** The serialized `data-endpoint-config` blob the vanilla runtime parses on submit. */
interface SerializedEndpointConfig {
  readonly url: string
  readonly method: string
  readonly responseEnvelope?: string
  readonly onSuccess?: unknown
  readonly onError?: unknown
}

/** The shared input/select/textarea surface, from the form-layout contract. */
const CONTROL_CLASS = computeFormControlClasses()

/** A `select` option as read off an endpoint-bound field (`{ value, label? }`). */
type EndpointFieldOption = { readonly value: string; readonly label?: string }

/**
 * The `aria-describedby` for one field's control, or nothing when the field
 * carries no `description`. The id is the one {@link renderHelpText} stamps on
 * the sentence, so the control is DESCRIBED by it — the association a screen
 * reader announces with the field — rather than merely sitting near it.
 */
function describedByProps(field: FormFieldConfig): Record<string, string> {
  return field.description === undefined
    ? {}
    : { 'aria-describedby': fieldDescriptionId(field.field) }
}

/**
 * A field's `description`, drawn as the help text under its control. It sits
 * OUTSIDE the `<label>`, so the sentence describes the control without also
 * becoming part of its accessible name.
 */
function renderHelpText(field: FormFieldConfig): ReactElement | undefined {
  if (field.description === undefined) return undefined
  return (
    <small
      id={fieldDescriptionId(field.field)}
      className={`help-text ${computeFormHelpTextClasses()}`}
    >
      {field.description}
    </small>
  )
}

/**
 * Wrap a field's `<label>` in a column with its help text and, for a field
 * with a rule, the room the runtime draws a refusal's reason in
 * (`data-field-block`), outside the label so the reason never joins the
 * control's accessible name. A field with neither is returned exactly as
 * before, so its markup keeps its bytes.
 */
function withHelpText(field: FormFieldConfig, labelled: ReactElement): ReactElement {
  const help = renderHelpText(field)
  if (help === undefined && !hasRules(field)) return labelled
  return (
    <div
      key={field.field}
      className={computeFormFieldClasses()}
      {...(hasRules(field) && { 'data-field-block': '' })}
    >
      {labelled}
      {help}
    </div>
  )
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
 * A `switch` field: a native checkbox carrying `role="switch"`, labelled by the
 * `<label>` that wraps it. It submits through the same endpoint runtime as every
 * other control, which reads it as a JSON boolean — `false` included, never
 * omitted (`islands/client.ts`), because an unchecked checkbox contributes
 * nothing to `FormData` and a partial update reads "absent" as "leave it alone".
 * It does NOT submit on change: the form's own submit button saves it, like
 * every other field.
 */
function renderEndpointSwitchField(field: FormFieldConfig): ReactElement {
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
      />
      <span className={computeFormFieldLabelClasses()}>{field.label ?? field.field}</span>
    </label>
  )
}

/** Render the inner control element for one endpoint field, keyed off its `control`. */
function renderEndpointControl(field: FormFieldConfig, part: FormPart): ReactElement {
  const name = field.field
  const controlClass = part('input', CONTROL_CLASS)
  const prefill = { ...describedByProps(field), ...prefillProps(field), ...ruleProps(field) }
  if (field.control === 'select') {
    const options = (field.options ?? []) as readonly EndpointFieldOption[]
    return (
      <select
        name={name}
        className={controlClass}
        {...prefill}
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
  }
  if (field.control === 'textarea') {
    return (
      <textarea
        name={name}
        className={controlClass}
        {...prefill}
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
      {...prefill}
    />
  )
}

/** Render one endpoint field as a label-wrapped control (accessible name = label). */
function renderEndpointField(field: FormFieldConfig, part: FormPart): ReactElement {
  if (field.control === 'switch') return withHelpText(field, renderEndpointSwitchField(field))
  return withHelpText(
    field,
    <label
      key={field.field}
      className={computeFormFieldClasses()}
    >
      <span className={part('label', computeFormFieldLabelClasses())}>
        {field.label ?? field.field}
      </span>
      {renderEndpointControl(field, part)}
    </label>
  )
}

/** Build the `data-endpoint-config` payload handed to the vanilla submit runtime. */
function buildEndpointConfig(endpoint: EndpointConfig): SerializedEndpointConfig {
  return {
    url: endpoint.url,
    method: endpoint.method ?? 'POST',
    ...(endpoint.responseEnvelope !== undefined && {
      responseEnvelope: endpoint.responseEnvelope,
    }),
    ...(endpoint.onSuccess !== undefined && { onSuccess: endpoint.onSuccess }),
    ...(endpoint.onError !== undefined && { onError: endpoint.onError }),
  }
}

/**
 * Render an endpoint-bound `form` when the component carries a `form.endpoint`
 * block; returns `undefined` otherwise so the caller falls through to its normal
 * form handling. The fields come from the component's `fields[]` (each with an
 * explicit `control`), and the submit POSTs to the custom endpoint via the vanilla
 * runtime bound to `form[data-action-type="endpoint"]`.
 *
 * The form only sends through that runtime, so until it has run the submit is
 * drawn `disabled` and marked `data-awaits-script`: a press, or Enter in a
 * field, would otherwise fall back to the browser default — a GET to the page's
 * own address carrying every field value, a password included, in the URL. The
 * runtime enables every marked submit, including one a later client render
 * inserts. `method="post"` is the second lock: no submit path, however it is
 * reached, writes a value into an address.
 */
export function renderEndpointForm(
  props: ElementProps,
  component: Component | undefined,
  designStyles?: ComponentDesignResolution
): ReactElement | undefined {
  const componentRecord = (component ?? {}) as Record<string, unknown>
  const endpoint = componentRecord['endpoint'] as EndpointConfig | undefined
  if (!endpoint || typeof endpoint.url !== 'string') return undefined

  const fields = (componentRecord['fields'] ?? []) as readonly FormFieldConfig[]
  const authorClassName = props.className as string | undefined
  const mergedClassName = resolveClasses(
    computeFormClasses(),
    designStyles?.parts['body'],
    authorClassName
  )
  const part = formPartOf(designStyles)
  const endpointConfigJson = JSON.stringify(buildEndpointConfig(endpoint))

  return (
    <form
      {...omitInternalMarkers(props)}
      method="post"
      className={mergedClassName}
      data-action-type="endpoint"
      data-endpoint-config={endpointConfigJson}
      {...formRuleProps(fields, designStyles?.parts['error'])}
    >
      {fields.map((field) => renderEndpointField(field, part))}
      <button
        type="submit"
        disabled
        data-awaits-script=""
        className={part('submit', computeSubmitButtonClasses(endpoint.submitVariant))}
      >
        {endpoint.submitLabel ?? 'Envoyer'}
      </button>
    </form>
  )
}
