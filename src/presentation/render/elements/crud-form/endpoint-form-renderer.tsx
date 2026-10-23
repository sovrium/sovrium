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
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import {
  computeSubmitButtonClasses,
  type ButtonVariant,
} from '@/presentation/design/button-default-classes'
import { fieldDescriptionId } from '@/presentation/design/field-display'
import { computeFormHelpTextClasses } from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import {
  computeFormClasses,
  computeFormFieldClasses,
  computeFormFieldLabelClasses,
} from '../../../design/forms-default-classes'
import { omitInternalMarkers } from '../../props/internal-marker-props'
import { PENDING_LABEL_ATTR } from '../button-pending-label'
import { withServedAllowOrigins } from '../served-allow-origins'
import {
  renderEndpointControl,
  renderEndpointHiddenField,
  renderEndpointSwitchField,
} from './endpoint-form-controls'
import { formPartOf, type FormPart } from './endpoint-form-parts'
import { passwordAidOf, passwordRuleId, type PasswordAid } from './endpoint-form-password'
import { renderEndpointRatingField } from './endpoint-form-rating'
import { formRuleProps, hasRules } from './endpoint-form-rules'
import type { ElementProps } from '../html-element-renderer'
import type { Languages } from '@/domain/models/app/languages'
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
  readonly submitOn?: 'submit' | 'change'
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

/**
 * A field's `description`, drawn as the help text under its control, then the
 * password rule a field that sets a password states. Both sit OUTSIDE the
 * `<label>`, so each sentence describes the control without also becoming part
 * of its accessible name. The author's sentence never replaces the rule: the
 * rule is what the server enforces, and a hand-written one can go stale.
 */
function renderHelpText(field: FormFieldConfig, aid: PasswordAid): ReactElement | undefined {
  if (field.description === undefined && aid.rule === undefined) return undefined
  const className = `help-text ${computeFormHelpTextClasses()}`
  return (
    <>
      {field.description !== undefined && (
        <small
          id={fieldDescriptionId(field.field)}
          className={className}
        >
          {field.description}
        </small>
      )}
      {aid.rule !== undefined && (
        <small
          id={passwordRuleId(field)}
          className={className}
        >
          {aid.rule}
        </small>
      )}
    </>
  )
}

/**
 * Wrap a field's `<label>` in a column with its help text and, for a field
 * with a rule, the room the runtime draws a refusal's reason in
 * (`data-field-block`), outside the label so the reason never joins the
 * control's accessible name. A field with neither is returned exactly as
 * before, so its markup keeps its bytes.
 */
function withHelpText(
  field: FormFieldConfig,
  labelled: ReactElement,
  aid: PasswordAid = {}
): ReactElement {
  const help = renderHelpText(field, aid)
  // A field a refusal can be about draws its reason the way a broken rule does.
  const ruled = hasRules(field) || aid.refused !== undefined
  if (help === undefined && !ruled) return labelled
  return (
    <div
      key={field.field}
      className={computeFormFieldClasses()}
      {...(ruled && { 'data-field-block': '' })}
    >
      {labelled}
      {help}
    </div>
  )
}

/**
 * Render one endpoint field as a label-wrapped control (accessible name = label).
 * A `hidden` field is the exception: it travels with the request and is drawn
 * for nobody, so it gets no label, no help text and no rule room — only the
 * hidden input itself.
 */
function renderEndpointField(
  field: FormFieldConfig,
  part: FormPart,
  aid: PasswordAid,
  lang: string | undefined
): ReactElement {
  if (field.hidden === true) return renderEndpointHiddenField(field)
  if (field.control === 'switch') return withHelpText(field, renderEndpointSwitchField(field))
  if (field.control === 'rating') return withHelpText(field, renderEndpointRatingField(field))
  return withHelpText(
    field,
    <label
      key={field.field}
      className={computeFormFieldClasses()}
    >
      <span className={part('label', computeFormFieldLabelClasses())}>
        {field.label ?? field.field}
      </span>
      {renderEndpointControl(field, part, aid, lang)}
    </label>,
    aid
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
    ...(endpoint.onSuccess !== undefined && {
      onSuccess: withServedAllowOrigins(endpoint.onSuccess),
    }),
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
 *
 * The default submit word (`form.submit`) and the in-flight word the runtime
 * reads (`form.sending`) are resolved here in the page language.
 */
export function renderEndpointForm(
  props: ElementProps,
  component: Component | undefined,
  designStyles?: ComponentDesignResolution,
  page: { readonly lang?: string; readonly languages?: Languages } = {}
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
  const aidContext = { component, responseEnvelope: endpoint.responseEnvelope, ...page }
  const aids = fields.map((field) => passwordAidOf(field, aidContext))
  const refusable = aids.some((aid) => aid.refused !== undefined)

  return (
    <form
      {...omitInternalMarkers(props)}
      method="post"
      className={mergedClassName}
      data-action-type="endpoint"
      data-endpoint-config={endpointConfigJson}
      {...(endpoint.submitOn === 'change' && { 'data-submit-on': 'change' })}
      {...formRuleProps(fields, designStyles?.parts['error'], refusable)}
    >
      {fields.map((field, index) => renderEndpointField(field, part, aids[index] ?? {}, page.lang))}
      {endpoint.submitOn === 'change' ? renderNoSubmit() : renderSubmit(endpoint, part, page)}
    </form>
  )
}

/**
 * A form that sends on change draws no button. It carries a submit that can
 * never be pressed instead: a form's default button being disabled is what
 * stops the browser's implicit submission, so Enter in a field sends nothing
 * before the page script has run — and after it, the runtime sends on Enter
 * itself. Hidden, it is in neither the page nor the accessibility tree.
 */
function renderNoSubmit(): ReactElement {
  return (
    <input
      type="submit"
      hidden
      disabled
    />
  )
}

/** The form's submit, drawn disabled until the runtime that sends it has run. */
function renderSubmit(
  endpoint: EndpointConfig,
  part: FormPart,
  page: { readonly lang?: string; readonly languages?: Languages }
): ReactElement {
  return (
    <button
      type="submit"
      disabled
      data-awaits-script=""
      {...{
        [PENDING_LABEL_ATTR]: resolveInterpreterString('form.sending', page.lang, page.languages),
      }}
      className={part('submit', computeSubmitButtonClasses(endpoint.submitVariant))}
    >
      {endpoint.submitLabel ?? resolveInterpreterString('form.submit', page.lang, page.languages)}
    </button>
  )
}
