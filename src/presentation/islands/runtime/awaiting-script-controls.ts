/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Controls the server drew disabled because only this runtime can act on them.
 *
 * Two kinds carry the marker today: the submit of a form that can only send
 * through the runtime (`renderEndpointForm` — a native submit would put its
 * values in the address), and a button whose `action` the runtime dispatches
 * (`renderActionButton` — fetch, automation, auth and toast). Until the runtime has
 * run, a press on either would be lost or worse, and the runtime is a lazily
 * imported chunk that can land well after the page is on screen. So the server
 * draws them disabled and marked, and this enables them.
 *
 * The handlers behind them are delegated, so they already cover a control that
 * arrives later — a refreshed region, a console page swapped in by the SPA
 * navigation, a panel an island fills with server markup. Only the drawn
 * disabled state needs a pass, hence the observer. The query is cheap and, once
 * every control is enabled, matches nothing.
 */

/** The marker on a control drawn disabled until the client runtime runs. */
const AWAITING_SCRIPT = 'data-awaits-script'

function enableAwaitingControls(): void {
  document.querySelectorAll(`[${AWAITING_SCRIPT}]`).forEach((control) => {
    control.removeAttribute('disabled')
    control.removeAttribute(AWAITING_SCRIPT)
  })
}

/**
 * Enable every awaiting control now and whenever later markup inserts one.
 * Call it LAST in the runtime's boot, once every handler it enables is bound.
 */
export function setupAwaitingScriptControls(): void {
  enableAwaitingControls()
  new MutationObserver(enableAwaitingControls).observe(document, { childList: true, subtree: true })
}
