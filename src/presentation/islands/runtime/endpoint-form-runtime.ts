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
import { bindEndpointFormAutosave } from '@/presentation/islands/runtime/endpoint-form-autosave'
import {
  checkEndpointFormRules,
  markRefusedField,
} from '@/presentation/islands/runtime/endpoint-form-validation'
import { fetchSuccessLeaves } from '@/presentation/islands/runtime/fetch-action-effects'
import { substituteResponse } from '@/presentation/islands/runtime/fetch-action-substitution'
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
  readonly reload?: boolean
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

/** Every endpoint-bound form on the document. */
const ENDPOINT_FORM_SELECTOR = 'form[data-action-type="endpoint"]'

/** Where a reloading form leaves word of its success for the page that replaces it. */
const RELOAD_TOAST_KEY = 'sovrium:reload-toast'

/**
 * A success that RELOADS the page, until now, toasted into the document it was about
 * to throw away, so the reader saw nothing. And the toast cannot simply be
 * carried as text: a reload is how a language change takes effect, and the
 * text was resolved in the language being left. So the form leaves only WHICH
 * form succeeded; the recomposed page reads that form's own success message —
 * now in the page's new language — and shows it there.
 */
function carryAcrossReload(form: HTMLFormElement): void {
  const index = [...document.querySelectorAll(ENDPOINT_FORM_SELECTOR)].indexOf(form)
  try {
    window.sessionStorage.setItem(RELOAD_TOAST_KEY, JSON.stringify({ index, at: Date.now() }))
  } catch {
    // Storage refused: the success goes unannounced, as it did before.
  }
}

/** Show the success a form carried across a reload, from the recomposed page's own config. */
function showToastCarriedAcrossReload(
  dispatchToast: (response: EndpointToastResponse | undefined) => void
): void {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_TOAST_KEY)
    if (raw === null) return
    window.sessionStorage.removeItem(RELOAD_TOAST_KEY)
    const { index, at } = JSON.parse(raw) as { readonly index?: unknown; readonly at?: unknown }
    if (typeof at !== 'number' || Date.now() - at > 60_000 || typeof index !== 'number') return
    const form = document.querySelectorAll(ENDPOINT_FORM_SELECTOR)[index]
    dispatchToast(
      parseEndpointFormConfig(form?.getAttribute('data-endpoint-config') ?? null)?.onSuccess
    )
  } catch {
    // A payload that is not ours: nothing to show.
  }
}

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
 * sends on change only on a form that says so (`endpoint-form-autosave.ts`).
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
  // A value typed before an island in the form mounted was written into the
  // markup (`pre-mount-input.ts`), so `reset` alone would restore IT; the
  // authored default the server drew beside it is what the form goes back to.
  form.querySelectorAll<HTMLInputElement>('input[data-default-value]').forEach((input) => {
    input.setAttribute('value', input.getAttribute('data-default-value') ?? '')
  })
  form.reset()
  form.querySelectorAll<HTMLInputElement>(SWITCH_SELECTOR).forEach((control) => {
    control.setAttribute('aria-checked', control.checked ? 'true' : 'false')
  })
  // A form that resets is ready for the NEXT entry: the caret goes back to its
  // first field rather than being left on a submit nobody is about to press.
  form.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea')?.focus()
}

/** What one endpoint form sends: every field as typed, every switch as a boolean. */
function endpointBody(form: HTMLFormElement): Record<string, unknown> {
  return {
    ...(Object.fromEntries(new FormData(form)) as Record<string, unknown>),
    ...readSwitchValues(form),
  }
}

/** The fetch action one endpoint form sends: its config, with what was typed as the body. */
function endpointAction(form: HTMLFormElement, config: EndpointFormConfig): FetchAction {
  const body = endpointBody(form)
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
 * on it before `onError`, then marks the field the refusal is about, which
 * takes the focus in turn. A form that sends on change has no submit (`null`).
 */
async function submitEndpointForm(
  form: HTMLFormElement,
  submit: HTMLElement | null,
  dispatchToast: (response: EndpointToastResponse | undefined) => void
): Promise<{ readonly ok: boolean; readonly leaves: boolean } | undefined> {
  if (submit?.getAttribute('data-pending') === 'true') return undefined
  const config = parseEndpointFormConfig(form.getAttribute('data-endpoint-config'))
  if (!config || !checkEndpointFormRules(form)) return undefined
  const { onSuccess } = config
  // The success runs inside the executor, in the shared order: the toast, the
  // status and refetch, the reset, the close, then the navigation.
  const action = endpointAction(form, config)
  const result = await sendHolding(submit, action, {
    origin: form,
    // The message may quote what came back (`Invitation sent to
    // $response.user.email`), the way `status.message` and `navigate` can.
    successToast:
      onSuccess?.reload === true
        ? () => carryAcrossReload(form)
        : (body) =>
            dispatchToast(
              onSuccess && { ...onSuccess, message: substituteResponse(onSuccess.message, body) }
            ),
    successEffects: () => resetOnSuccess(form, onSuccess),
  })
  if (result?.ok === false) {
    runErrorOutcome(submit, () => dispatchToast(config.onError))
    markRefusedField(form, result.body)
  }
  return result && { ok: result.ok, leaves: fetchSuccessLeaves(result, action.onSuccess) }
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
  showToastCarriedAcrossReload(dispatchToast)
  document.addEventListener('change', syncSwitchState)
  bindEndpointFormAutosave({
    send: (form) => submitEndpointForm(form, null, dispatchToast),
    bodyOf: endpointBody,
  })
  document.addEventListener('submit', (event) => {
    const { target } = event
    if (!(target instanceof Element)) return
    const form = target.closest<HTMLFormElement>(ENDPOINT_FORM_SELECTOR)
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
