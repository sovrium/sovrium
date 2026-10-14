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
import { runErrorOutcome } from '@/presentation/islands/runtime/action-outcome'
import { checkEndpointFormRules } from '@/presentation/islands/runtime/endpoint-form-validation'
import { fetchSuccessLeaves } from '@/presentation/islands/runtime/fetch-action-effects'
import { withPending } from '@/presentation/islands/runtime/pending-control'
import type { FetchAction } from '@/domain/models/app/pages/components/action'
import type { ExecuteFetchActionOptions } from '@/presentation/islands/runtime/fetch-action-effects'

/** A toast response as the endpoint config carries it. */
export type EndpointToastResponse = {
  readonly type: 'toast'
  readonly message: string
  readonly variant?: string
  readonly duration?: number
  readonly actionLabel?: string
  readonly actionUrl?: string
}

/** The endpoint form's success slot: the toast, `reset` (a form's own), and the two exits. */
type EndpointSuccessResponse = EndpointToastResponse & {
  readonly close?: boolean
  readonly reset?: boolean
  readonly navigate?: string
}

/** The `data-endpoint-config` blob serialized by `renderEndpointForm`. */
type EndpointFormConfig = {
  readonly url: string
  readonly method?: string
  readonly responseEnvelope?: string
  readonly onSuccess?: EndpointSuccessResponse
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

/**
 * The form's own success effect, run once the request has succeeded (never
 * before: what was typed is what was sent). `reset` puts every field back to
 * its authored default — the switches' `aria-checked` with them, since a native
 * reset fires no `change`. The close and the navigation that follow it are the
 * shared exits (`action-outcome.ts`).
 */
function resetOnSuccess(form: HTMLFormElement, onSuccess: EndpointSuccessResponse | undefined) {
  if (onSuccess?.reset !== true) return
  form.reset()
  form.querySelectorAll<HTMLInputElement>(SWITCH_SELECTOR).forEach((control) => {
    control.setAttribute('aria-checked', control.checked ? 'true' : 'false')
  })
}

/** The fetch action one endpoint form sends: its config, with what was typed as the body. */
function endpointAction(form: HTMLFormElement, config: EndpointFormConfig): FetchAction {
  const body = {
    ...(Object.fromEntries(new FormData(form)) as Record<string, unknown>),
    ...readSwitchValues(form),
  }
  return {
    type: 'fetch',
    url: config.url,
    method: config.method ?? 'POST',
    body,
    ...(config.responseEnvelope && { responseEnvelope: config.responseEnvelope }),
    ...(config.onSuccess && { onSuccess: config.onSuccess }),
    ...(config.onError && { onError: config.onError }),
  } as FetchAction
}

/** Send `action`, holding `submit` pending meanwhile (the built-in word unless stamped). */
function sendHolding(
  submit: HTMLElement | null,
  action: FetchAction,
  options: ExecuteFetchActionOptions
) {
  const send = () => executeFetchAction(action, options)
  if (!submit) return send()
  const label = submit.getAttribute('data-action-pending-label') ?? 'Sending…'
  const keepPending = (result: Awaited<ReturnType<typeof send>>) =>
    fetchSuccessLeaves(result, action.onSuccess)
  return withPending(submit, { label, keepPending }, send)
}

/**
 * Submit one endpoint form through the shared fetch runtime.
 *
 * The submit is pending while the request is open (`withPending`), so a
 * second press or Enter sends nothing; a refusal gives it back with the focus
 * on it before `onError`.
 */
async function submitEndpointForm(
  form: HTMLFormElement,
  submit: HTMLElement | null,
  dispatchToast: (response: EndpointToastResponse | undefined) => void
): Promise<void> {
  if (submit?.getAttribute('data-pending') === 'true') return
  const config = parseEndpointFormConfig(form.getAttribute('data-endpoint-config'))
  if (!config || !checkEndpointFormRules(form)) return
  const { onSuccess } = config
  // The success runs inside the executor, in the shared order: the toast, the
  // status and refetch, the reset, the close, then the navigation.
  const result = await sendHolding(submit, endpointAction(form, config), {
    origin: form,
    successToast: () => dispatchToast(onSuccess),
    successEffects: () => resetOnSuccess(form, onSuccess),
  })
  if (result?.ok === false) runErrorOutcome(submit, () => dispatchToast(config.onError))
}

/**
 * Bind every endpoint-bound form on the document (`form[data-action-type=
 * "endpoint"]`) and every switch inside one, by delegation. The submits the
 * server drew disabled until this ran are enabled by the runtime's shared
 * `setupAwaitingScriptControls` pass, once every handler is bound.
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
    const { submitter } = event as SubmitEvent
    const submit =
      submitter instanceof HTMLElement
        ? submitter
        : form.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]')
    void submitEndpointForm(form, submit, dispatchToast)
  })
}
