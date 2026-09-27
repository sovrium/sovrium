/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The browser half of an endpoint-bound form (`form.endpoint`), rendered by
 * `render/elements/crud-form/endpoint-form-renderer.tsx` as a PLAIN `<form>`
 * with no React on the client.
 *
 * On submit it collects the form's values into a JSON body, builds a
 * `type: 'fetch'` action carrying them, and dispatches it through the SHARED
 * `executeFetchAction` — so the response-envelope evaluation, the
 * `onSuccess`/`onError` toast, and the additive `onSuccess` `status`/`refetch`
 * client-state effects (a sibling directory grid refreshes) all behave
 * identically to the standalone fetch button. No `renderToast` is injected: the
 * rich toast (incl. `duration`/`actionLabel`/`actionUrl`) is rendered by the
 * caller's `dispatchToast` from the returned `{ ok }`, exactly as the
 * fetch-button path does.
 *
 * It also owns the one control a native form cannot post as JSON on its own:
 * `control: switch`, a checkbox carrying `role="switch"` and
 * `data-control="switch"`.
 */

import { executeFetchAction } from '@/presentation/islands/runtime/action-executor'
import type { FetchAction } from '@/domain/models/app/pages/components/action'

/** A toast response as the endpoint config carries it. */
export type EndpointToastResponse = {
  readonly type: 'toast'
  readonly message: string
  readonly variant?: string
  readonly duration?: number
  readonly actionLabel?: string
  readonly actionUrl?: string
}

/** The `data-endpoint-config` blob serialized by `renderEndpointForm`. */
type EndpointFormConfig = {
  readonly url: string
  readonly method?: string
  readonly responseEnvelope?: string
  readonly onSuccess?: EndpointToastResponse
  readonly onError?: EndpointToastResponse
}

/** The marker every switch control carries. */
const SWITCH_SELECTOR = 'input[data-control="switch"]'

/** Parse the `data-endpoint-config` JSON attribute into a config object. */
function parseEndpointFormConfig(raw: string | null): EndpointFormConfig | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as EndpointFormConfig).url === 'string'
    ) {
      return parsed as EndpointFormConfig
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Every switch of `form` as a JSON boolean, keyed by field name.
 *
 * A checkbox contributes to `FormData` only when checked, and then as the
 * string `"on"`. Both halves are wrong for a switch: an endpoint that stores a
 * boolean is handed a string, and a switch turned OFF sends no key at all —
 * which a partial update such as `/api/auth/update-user` reads as "leave it
 * alone", so switching a preference off would change nothing. So these are
 * laid over whatever `FormData` said.
 */
function readSwitchValues(form: HTMLFormElement): Record<string, boolean> {
  const switches = [...form.querySelectorAll<HTMLInputElement>(SWITCH_SELECTOR)]
  return Object.fromEntries(switches.map((control) => [control.name, control.checked]))
}

/**
 * Keep every switch's `aria-checked` in step with its native `checked` state.
 * The checkbox already exposes its state to assistive technology; the attribute
 * is what the switch contract names, and what the server drew it with. A switch
 * never submits on change: the form's own button saves it.
 */
function syncSwitchState(event: Event): void {
  const { target } = event
  if (!(target instanceof HTMLInputElement) || !target.matches(SWITCH_SELECTOR)) return
  target.setAttribute('aria-checked', target.checked ? 'true' : 'false')
}

/** Submit one endpoint form through the shared fetch runtime. */
function submitEndpointForm(
  form: HTMLFormElement,
  dispatchToast: (response: EndpointToastResponse | undefined) => void
): void {
  const config = parseEndpointFormConfig(form.getAttribute('data-endpoint-config'))
  if (!config) return
  const body = {
    ...(Object.fromEntries(new FormData(form)) as Record<string, unknown>),
    ...readSwitchValues(form),
  }
  const action = {
    type: 'fetch',
    url: config.url,
    method: config.method ?? 'POST',
    body,
    ...(config.responseEnvelope && { responseEnvelope: config.responseEnvelope }),
    ...(config.onSuccess && { onSuccess: config.onSuccess }),
    ...(config.onError && { onError: config.onError }),
  } as FetchAction
  void executeFetchAction(action).then((result) => {
    if (result) dispatchToast(result.ok ? config.onSuccess : config.onError)
  })
}

/**
 * Bind every endpoint-bound form on the document (`form[data-action-type=
 * "endpoint"]`) and every switch inside one, by delegation.
 */
export function setupEndpointFormHandlers(
  dispatchToast: (response: EndpointToastResponse | undefined) => void
): void {
  document.addEventListener('change', syncSwitchState)
  document.addEventListener('submit', (event) => {
    const { target } = event
    if (!(target instanceof Element)) return
    const form = target.closest<HTMLFormElement>('form[data-action-type="endpoint"]')
    if (!form) return
    event.preventDefault()
    submitEndpointForm(form, dispatchToast)
  })
}
