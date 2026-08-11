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
 */

import { type ReactElement } from 'react'
import {
  computeFormClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '../recipes/forms-default-classes'
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

/** The shared input/select/textarea surface (mirrors the crud-form CONTROL_CLASS). */
const CONTROL_CLASS =
  'border-border bg-background text-foreground focus:border-primary focus:ring-primary rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none'

/** A `select` option as read off an endpoint-bound field (`{ value, label? }`). */
type EndpointFieldOption = { readonly value: string; readonly label?: string }

/** Render the inner control element for one endpoint field, keyed off its `control`. */
function renderEndpointControl(field: FormFieldConfig): ReactElement {
  const name = field.field
  if (field.control === 'select') {
    const options = (field.options ?? []) as readonly EndpointFieldOption[]
    return (
      <select
        name={name}
        className={CONTROL_CLASS}
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
  const mergedClassName = authorClassName
    ? `${computeFormClasses()} ${authorClassName}`
    : computeFormClasses()
  const endpointConfigJson = JSON.stringify(buildEndpointConfig(endpoint))

  return (
    <form
      {...props}
      className={mergedClassName}
      data-action-type="endpoint"
      data-endpoint-config={endpointConfigJson}
    >
      {fields.map((field) => renderEndpointField(field))}
      <button type="submit">{endpoint.submitLabel ?? 'Envoyer'}</button>
    </form>
  )
}
