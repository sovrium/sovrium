/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { combineReadStates, readGateHolds } from '@/domain/models/app/pages/read-state-gate-service'
import type { ReadState, ReadStateGate } from '@/domain/models/app/pages/components/read-state-gate'

/**
 * What the data components of the page last read, and the buttons that follow
 * it (`hiddenWhenRead`, `disabledWhenRead`).
 *
 * A data island announces the state of its latest read here, under the
 * `props.id` a sibling's `onSuccess.refetch` names and the shared-filter
 * channel its `dataSource.bindTo` subscribes to. Each announcement redraws
 * every gated button on the page. The server drew each one as it stands
 * before any read (`loading`), so a page whose islands have not mounted yet
 * already shows the right thing.
 *
 * The gates ride on the button as JSON attributes (`button-read-gate.ts`):
 * a holding `hiddenWhenRead` sets `hidden`; a holding `disabledWhenRead` sets
 * `aria-disabled` and `data-read-disabled`, keeping the button focusable, and
 * the capture listener below swallows a press on it before any runtime
 * dispatches the action. Not a permission: the button is still in the page.
 *
 * Only data islands import this module, so a page without one never loads it.
 */

/** One announcer's latest state, under the names a gate can follow. */
interface Announced {
  readonly id: string | undefined
  readonly channel: string | undefined
  readonly state: ReadState
}

const HIDDEN_GATE = 'data-read-hidden'
const DISABLED_GATE = 'data-read-disabled-when'
const READ_DISABLED = 'data-read-disabled'

const announced = new Map<object, Announced>()

/** The state a gate follows: its component's, or its channel's subscribers' combined. */
const sourceState = (gate: { readonly component?: string; readonly channel?: string }): ReadState =>
  combineReadStates(
    [...announced.values()]
      .filter((entry) =>
        gate.component === undefined ? entry.channel === gate.channel : entry.id === gate.component
      )
      .map((entry) => entry.state)
  )

/** Whether the gate a button carries in `attribute` holds now; false when unreadable. */
const holds = (element: Element, attribute: string): boolean => {
  try {
    // Written by the server's own renderer from a decoded gate (`button-read-gate.ts`).
    const gate = JSON.parse(element.getAttribute(attribute) ?? '') as ReadStateGate & {
      readonly component?: string
      readonly channel?: string
    }
    return readGateHolds(gate, sourceState(gate))
  } catch {
    return false
  }
}

/** Redraw every gated button on the page from the states announced so far. */
function applyReadGates(): void {
  document.querySelectorAll(`[${HIDDEN_GATE}]`).forEach((element) => {
    element.toggleAttribute('hidden', holds(element, HIDDEN_GATE))
  })
  document.querySelectorAll(`[${DISABLED_GATE}]`).forEach((element) => {
    const disabled = holds(element, DISABLED_GATE)
    element.toggleAttribute(READ_DISABLED, disabled)
    if (disabled) element.setAttribute('aria-disabled', 'true')
    else element.removeAttribute('aria-disabled')
  })
}

/**
 * Record what `key`'s component last read and redraw the gates. A `state`
 * of `undefined` is a read still in flight: the announcer keeps the state it
 * had, `loading` until its first read settles.
 */
export function announceReadState(
  key: object,
  id: string | undefined,
  channel: string | undefined,
  state: ReadState | undefined
): void {
  announced.set(key, { id, channel, state: state ?? announced.get(key)?.state ?? 'loading' })
  applyReadGates()
}

/** Forget an announcer that left the page, and redraw the gates without it. */
export function forgetReadState(key: object): void {
  announced.delete(key)
  applyReadGates()
}

// A press on a button its read disables does nothing: swallowed in the capture
// phase, before the delegated action runtimes on `document` see it.
document.addEventListener(
  'click',
  (event) => {
    if (event.target instanceof Element && event.target.closest(`[${READ_DISABLED}]`)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  },
  true
)
