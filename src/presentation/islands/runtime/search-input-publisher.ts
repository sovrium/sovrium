/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The PUBLISHER half of a shared filter for a `search-input` that declares
 * `publishes: { bindTo, param }`.
 *
 * The box is server-rendered and mounts no island, so — like an island-less
 * native select (`native-select-publisher.ts`) — its value is sent from the
 * global vanilla runtime, on the SAME `island:system-query` event every
 * subscriber already listens to. The box carries the declaration as
 * `data-publishes-bind-to` / `data-publishes-param` on its `<input>`, which is
 * also what lets a subscriber mounting after the reader typed read the held
 * value back (`shared-filter-channel.ts`).
 *
 * `data-search-debounce` delays the send until the reader pauses — by
 * {@link DEFAULT_SEARCH_DEBOUNCE_MS} when the box declares none, so a typed word
 * costs its subscribers one read rather than one per keystroke. A paste, a drop
 * and `Enter` are finished terms and send at once, cancelling the pause, so no
 * second send follows for the same term. While a pause runs the box carries
 * `data-search-pending`, which tells a subscriber that the term it holds is
 * about to change ({@link hasPendingSearch}).
 *
 * `data-search-min-length` withdraws the param (publishes `''`) while the query
 * is shorter than that. Clearing the box publishes `''` too, which takes the
 * param out of every subscriber's request.
 *
 * A box declaring `url: true` (`data-publishes-url`) mirrors its term in the
 * page address as `?<bindTo>.<param>=`; a page opened on such an address starts
 * with the term in the box and published, restored by the same pass that
 * restores a mirrored select (`native-select-publisher.ts`) — so a link can
 * open a list already narrowed.
 */

import { withAddress } from './native-select-publisher'
import { DEFAULT_SEARCH_DEBOUNCE_MS } from './search-input-defaults'

const SHARED_FILTER_EVENT = 'island:system-query'

/** The declaring search box an `input` event must come from in order to publish. */
const PUBLISHER_SELECTOR = 'input[type="search"][data-publishes-bind-to][data-publishes-param]'

/** A non-negative integer read off an attribute; `0` when absent or malformed. */
const readCount = (input: HTMLInputElement, name: string): number => {
  const parsed = Number(input.getAttribute(name))
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

/** The box's pause: its declared `debounceMs`, else the default. */
const readDelay = (input: HTMLInputElement): number =>
  input.hasAttribute('data-search-debounce')
    ? readCount(input, 'data-search-debounce')
    : DEFAULT_SEARCH_DEBOUNCE_MS

/** The attribute a box carries while its term waits out the pause. */
const PENDING = 'data-search-pending'

/** Whether a box publishing on `bindTo` holds a term still waiting for its pause. */
export function hasPendingSearch(bindTo: string): boolean {
  return Array.from(document.querySelectorAll(`input[${PENDING}]`)).some(
    (input) => input.getAttribute('data-publishes-bind-to') === bindTo
  )
}

/** The value the box publishes: its query, or `''` while it is below the minimum length. */
export function publishedSearchValue(value: string, minLength: number): string {
  const query = value.trim()
  return query.length < Math.max(minLength, 1) ? '' : query
}

/** Send the box's current value on its channel, and mirror it in the address when it asks. */
function publish(input: HTMLInputElement): void {
  const bindTo = input.getAttribute('data-publishes-bind-to')
  const param = input.getAttribute('data-publishes-param')
  if (bindTo === null || param === null) return
  const value = publishedSearchValue(input.value, readCount(input, 'data-search-min-length'))
  document.dispatchEvent(
    new CustomEvent(SHARED_FILTER_EVENT, {
      detail: { sourceId: bindTo, params: { [param]: value } },
    })
  )
  if (input.hasAttribute('data-publishes-url'))
    withAddress((address) => address.mirrorInAddress(bindTo, param, value))
}

/**
 * Publish on every `input` from a declaring search box, debounced per box, and
 * at once on a paste, a drop or `Enter` while a term is waiting.
 *
 * One delegated listener per event, for the reason the native-select publisher
 * uses one: a box arriving with a refreshed server-rendered region carries its
 * attributes but no listener of its own.
 */
export function setupSearchInputPublishers(): void {
  const pending = new WeakMap<HTMLInputElement, ReturnType<typeof setTimeout>>()
  const send = (input: HTMLInputElement): void => {
    clearTimeout(pending.get(input))
    pending.delete(input)
    input.removeAttribute(PENDING)
    publish(input)
  }
  const onEvent = (event: Event): void => {
    const { target } = event
    if (!(target instanceof HTMLInputElement) || !target.matches(PUBLISHER_SELECTOR)) return
    // Only a term still waiting is sent on Enter: one already published is not sent twice.
    if (event instanceof KeyboardEvent) {
      if (event.key === 'Enter' && pending.has(target)) send(target)
      return
    }
    const delay = readDelay(target)
    // A paste, a drop or an emptied box is a finished term: nothing to wait for.
    if (
      delay === 0 ||
      target.value === '' ||
      (event instanceof InputEvent && event.inputType.startsWith('insertFrom'))
    ) {
      send(target)
      return
    }
    clearTimeout(pending.get(target))
    target.setAttribute(PENDING, '')
    pending.set(
      target,
      setTimeout(() => send(target), delay)
    )
  }
  document.addEventListener('input', onEvent)
  document.addEventListener('keydown', onEvent)
}

/** Empty the search boxes publishing on `bindTo`, which takes their term out at once. */
export function clearSearchOn(bindTo: string): void {
  document.querySelectorAll<HTMLInputElement>(PUBLISHER_SELECTOR).forEach((input) => {
    if (input.getAttribute('data-publishes-bind-to') !== bindTo) return
    input.setRangeText('', 0, input.value.length)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
