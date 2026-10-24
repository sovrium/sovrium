/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An endpoint form that sends as the reader changes it
 * (`form.endpoint.submitOn: 'change'`, drawn `data-submit-on="change"` with no
 * submit button).
 *
 * - A switch or a Select sends the moment it changes, with no timer between:
 *   a Select changes when the reader takes an option, never when the list
 *   opens, the highlight moves, or it closes with nothing taken.
 * - A control the reader TYPES into sends once typing pauses, or at once when
 *   the reader leaves it or presses Enter in a single-line field — which drops
 *   the pending pause, so the value leaves once.
 * - Only the reader's own gesture is a change: a value the page sets itself
 *   (a `$session.*` default filled in the browser) fires no event, and sends
 *   nothing.
 * - One request at a time. A change made while one is on its way marks the
 *   form for exactly one more, sent once the first is answered with the values
 *   the form holds THEN; the intermediate states never leave. The form carries
 *   `aria-busy="true"` meanwhile, and its controls stay usable.
 * - A refusal puts every switch and Select back to the value the server last
 *   accepted — the one the page opened with until a send succeeds — so a
 *   setting never shows what was not kept. A typed control keeps its text, for
 *   the reader to correct rather than retype.
 * - Values the server already accepted are not sent again (leaving a field
 *   whose pause already sent it sends nothing).
 *
 * The send itself — the field rules, the request, the toast and the success
 * effects — is the endpoint runtime's own (`endpoint-form-runtime.ts`), the one
 * a submit button runs.
 */

/** How long typing must pause before a typed control sends. */
const TYPING_PAUSE_MS = 600

/** What one send came to: `undefined` when the form's own rules sent nothing. */
type SendOutcome = { readonly ok: boolean; readonly leaves: boolean } | undefined

type AutosaveState = {
  busy?: boolean
  again?: boolean
  timer?: ReturnType<typeof setTimeout>
  /** The body the server last accepted, as sent. */
  accepted?: string
}

const states = new WeakMap<HTMLFormElement, AutosaveState>()

const stateOf = (form: HTMLFormElement): AutosaveState => {
  const known = states.get(form)
  if (known) return known
  const created: AutosaveState = {}
  states.set(form, created)
  return created
}

/** The form a control sends with, when that form sends on change. */
const autosaveFormOf = (target: EventTarget | null): HTMLFormElement | null =>
  target instanceof Element
    ? target.closest<HTMLFormElement>('form[data-submit-on="change"]')
    : null

/** A control the reader types into, as opposed to one they pick a value from. */
const isTyped = (target: EventTarget | null): boolean =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && !/^(checkbox|radio|hidden)$/.test(target.type))

const SWITCH = 'input[data-control="switch"]'

/**
 * Remember the sent values as the ones to fall back on: every switch's, and
 * every Select's that has changed — a Select marks its named control with the
 * value it held before the reader's first change (`form-field-island.tsx`).
 */
function keepAccepted(form: HTMLFormElement, sent: Record<string, unknown>): void {
  for (const control of form.querySelectorAll<HTMLInputElement>(`${SWITCH},[data-saved]`)) {
    const value = sent[control.name]
    control.setAttribute('data-saved', String(control.type === 'checkbox' ? value === true : value))
  }
}

/**
 * Put every switch and Select back to the value last accepted. A Select's
 * named control is rewritten, then the form says so (`sovrium:values-reset`),
 * which the island reads back onto its trigger.
 */
function restoreAccepted(form: HTMLFormElement): void {
  for (const control of form.querySelectorAll<HTMLInputElement>('[data-saved]')) {
    const saved = control.getAttribute('data-saved') ?? ''
    if (control.type !== 'checkbox') control.value = saved
    else {
      control.checked = saved === 'true'
      control.setAttribute('aria-checked', saved)
    }
  }
  form.dispatchEvent(new Event('sovrium:values-reset'))
}

/** What sends a form: the endpoint runtime's submit with no button, and the body it sends. */
type Sender = {
  readonly send: (form: HTMLFormElement) => Promise<SendOutcome>
  readonly bodyOf: (form: HTMLFormElement) => Record<string, unknown>
}

/**
 * Send `form` now, or — while a send is on its way — once that one is
 * answered. A body the server already accepted is not sent again.
 */
async function run(form: HTMLFormElement, sender: Sender): Promise<void> {
  const state = stateOf(form)
  clearTimeout(state.timer)
  if (state.busy) {
    state.again = true
    return
  }
  const sent = sender.bodyOf(form)
  const body = JSON.stringify(sent)
  if (body === state.accepted) return
  state.busy = true
  form.setAttribute('aria-busy', 'true')
  const outcome = await sender.send(form)
  state.busy = false
  if (outcome?.ok) {
    state.accepted = body
    keepAccepted(form, sent)
    if (outcome.leaves) return
  } else if (outcome) restoreAccepted(form)
  form.removeAttribute('aria-busy')
  if (state.again) {
    state.again = false
    void run(form, sender)
  }
}

/** Bind every form that sends on change, by delegation. */
export function bindEndpointFormAutosave(sender: Sender): void {
  document.addEventListener('input', ({ target }) => {
    const form = autosaveFormOf(target)
    if (!form || !isTyped(target)) return
    const state = stateOf(form)
    clearTimeout(state.timer)
    state.timer = setTimeout(() => void run(form, sender), TYPING_PAUSE_MS)
  })
  document.addEventListener('change', ({ target }) => {
    const form = autosaveFormOf(target)
    if (!form) return
    // A switch's state before this change is the one a refusal returns to,
    // until a send succeeds — read now, since the page may have filled it.
    if (target instanceof HTMLInputElement && target.matches(`${SWITCH}:not([data-saved])`)) {
      target.setAttribute('data-saved', String(!target.checked))
    }
    void run(form, sender)
  })
  document.addEventListener('keydown', (event) => {
    const { target } = event
    const form = autosaveFormOf(target)
    if (!form || event.key !== 'Enter' || !isTyped(target)) return
    if (target instanceof HTMLTextAreaElement) return
    event.preventDefault()
    void run(form, sender)
  })
}
