/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The client runtime's one binding seam: a listener on `document`, matched
 * per event, so a control keeps working after the markup around it is
 * replaced; and the action-button binding every button setup shares.
 */

// ─── Event delegation (the one binding strategy) ─────────────────────────────

/**
 * Run `handler` for every element matching `selector` — one already in the
 * document, or one that arrives later.
 *
 * ONE listener is registered on `document`, once, and the match is made per
 * event by walking up from the event target. Nothing is ever bound to an
 * element, so nothing is lost when an element is REPLACED.
 *
 * That last sentence is the whole reason this exists. A page region bound to a
 * data source is re-read by swapping its markup when an action names it
 * (`refetch-server-rendered-region.ts`), and a handler attached by sweeping
 * the document once at `DOMContentLoaded` dies with the nodes it was attached
 * to. A confirm-gated button came back from a refresh
 * carrying its configuration and no listener, so clicking it did nothing at all
 * — no dialog, and no action either. Every other sweep on that seam had the
 * same hole, silently: the action buttons, the custom-endpoint form, the filter
 * form, the native-select publisher.
 *
 * Delegation is already how the rest of the page behaves. The inline click,
 * theme-toggle, copy-code and marquee runtimes in `page-body-scripts.tsx` are
 * each one document listener plus a `closest()`, which is exactly why they kept
 * working across a refresh while this module did not.
 *
 * Re-binding the swapped subtree was the alternative, and it is the worse one:
 * a second pass over a node that is already bound fires its action twice, so it
 * stays correct only as long as every binder remembers to mark what it has
 * already bound. Here there is no second pass and nothing to mark — the
 * idempotence is structural rather than maintained.
 *
 * One consequence worth knowing before adding a selector: a delegated handler
 * also matches nodes an ISLAND rendered, which a load-time sweep never saw.
 * Every handler below is therefore keyed on a configuration attribute only the
 * server's own element renderers emit (`data-action-config`, `data-action-name`,
 * `data-auth-method`, `data-endpoint-config`) and bails without it, so an
 * island's own React `onClick` can never be doubled by one of these.
 *
 * BUBBLE, not capture — deliberately, and the other way round from the outbound
 * click delegate in `[internal ref]`. That one captures so a
 * `stopPropagation()` cannot drop a link from its report; it is a passive
 * observer and owes nothing to ordering. These handlers own their control's
 * behaviour, so they must keep running exactly where the per-element listeners
 * they replace ran — after anything nearer the target. Every `stopPropagation`
 * in this codebase is inside an island, on React-rendered nodes that carry none
 * of the attributes above, so capture would buy immunity to a collision that
 * cannot occur and pay for it by reordering the handlers that can.
 */
export function delegate<E extends Element>(
  type: 'click' | 'submit' | 'change',
  selector: string,
  handler: (element: E, event: Event) => void
): void {
  document.addEventListener(type, (event) => {
    const { target } = event
    if (!(target instanceof Element)) return
    const element = target.closest<E>(selector)
    if (element) handler(element, event)
  })
}

// ─── Action button binding (shared) ──────────────────────────────────────────

/**
 * Run `onClick` for every click on a `button[data-action-type="<type>"]`. Shared
 * by the automation / auth / fetch button setups, which differ only in their
 * per-button click body.
 *
 * Delegated, so a button that arrives with a refreshed region works on its first
 * click. Each caller's body opens by reading the button's own configuration
 * attribute and returning without it — see {@link delegate} for why that guard
 * is load-bearing rather than defensive.
 */
export function bindActionButtons(
  actionType: string,
  onClick: (button: HTMLButtonElement) => void
): void {
  delegate<HTMLButtonElement>('click', `button[data-action-type="${actionType}"]`, onClick)
}

// ─── Automation button handling ──────────────────────────────────────────────

export function parseActionInput(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}
