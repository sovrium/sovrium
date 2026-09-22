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
 * (`auth-form-renderer.tsx`). It emitted no class string at all until 2026-09-16,
 * so a form's primary action rendered as bare text on every endpoint-bound form
 * in the admin console (the profile forms, "Send invitation" on the Users
 * console, the link create and re-point forms) while the `button` components
 * beside them were fully dressed. Reaching for the shared recipe rather than
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
  computeButtonDefaultClasses,
  type ButtonVariant,
} from '@/presentation/design/button-default-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeFormClasses,
  computeFormControlClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '../../../design/forms-default-classes'
import type { ElementProps } from '../html-element-renderer'
import type { Component } from '@/domain/models/app/pages/components'
import type { FormFieldConfig } from '@/domain/models/app/pages/components/component-types/data/form'

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

/**
 * The submit's class string, in the platform button recipe's own vocabulary.
 *
 * Two channels, because a `button` component of the same variant wears both and
 * the whole point of `submitVariant` is that a submit and a button asking for
 * the same word cannot look different. The recipe
 * ({@link computeButtonDefaultClasses}) paints it; the legacy `.btn-{variant}`
 * modifier is the token an app's own CSS and the component layer address it by,
 * and is emitted for a `button` by `buildButtonModifierClasses`
 * (`render/styling/style-processor.ts`) — which only ever sees a component of
 * `type: 'button'`, so a submit nested inside a `form` never passes through it.
 * `default` emits no modifier there and emits none here, for the same reason:
 * it is the absence of a modifier rather than one of its own.
 *
 * With no variant named this is `computeButtonDefaultClasses()` with no
 * argument, so every form that does not use the key keeps its submit's class
 * string to the byte.
 */
function computeSubmitClasses(variant: ButtonVariant | undefined): string {
  if (variant === undefined) return computeButtonDefaultClasses()
  const recipe = computeButtonDefaultClasses({ variant })
  return variant === 'default' ? recipe : `${recipe} btn-${variant}`
}

/** A `select` option as read off an endpoint-bound field (`{ value, label? }`). */
type EndpointFieldOption = { readonly value: string; readonly label?: string }

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

/** Render the inner control element for one endpoint field, keyed off its `control`. */
function renderEndpointControl(field: FormFieldConfig): ReactElement {
  const name = field.field
  const prefill = prefillProps(field)
  if (field.control === 'select') {
    const options = (field.options ?? []) as readonly EndpointFieldOption[]
    return (
      <select
        name={name}
        className={CONTROL_CLASS}
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
        className={CONTROL_CLASS}
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
      className={CONTROL_CLASS}
      {...prefill}
    />
  )
}

/** Render one endpoint field as a label-wrapped control (accessible name = label). */
function renderEndpointField(field: FormFieldConfig): ReactElement {
  return (
    <label
      key={field.field}
      className={computeFormFieldClasses()}
    >
      <span className={computeFormFieldLabelClasses()}>{field.label ?? field.field}</span>
      {renderEndpointControl(field)}
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
 */
export function renderEndpointForm(
  props: ElementProps,
  component: Component | undefined
): ReactElement | undefined {
  const componentRecord = (component ?? {}) as Record<string, unknown>
  const endpoint = componentRecord['endpoint'] as EndpointConfig | undefined
  if (!endpoint || typeof endpoint.url !== 'string') return undefined

  const fields = (componentRecord['fields'] ?? []) as readonly FormFieldConfig[]
  const authorClassName = props.className as string | undefined
  const mergedClassName = resolveClasses(computeFormClasses(), authorClassName)
  const endpointConfigJson = JSON.stringify(buildEndpointConfig(endpoint))

  return (
    <form
      {...props}
      className={mergedClassName}
      data-action-type="endpoint"
      data-endpoint-config={endpointConfigJson}
    >
      {fields.map((field) => renderEndpointField(field))}
      <button
        type="submit"
        className={computeSubmitClasses(endpoint.submitVariant)}
      >
        {endpoint.submitLabel ?? 'Envoyer'}
      </button>
    </form>
  )
}
