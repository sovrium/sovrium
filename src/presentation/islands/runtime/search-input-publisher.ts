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
 * `data-search-debounce` delays the send until the reader pauses;
 * `data-search-min-length` withdraws the param (publishes `''`) while the query
 * is shorter than that. Clearing the box publishes `''` too, which takes the
 * param out of every subscriber's request.
 */

const SHARED_FILTER_EVENT = 'island:system-query'

/** The declaring search box an `input` event must come from in order to publish. */
const PUBLISHER_SELECTOR = 'input[type="search"][data-publishes-bind-to][data-publishes-param]'

/** A non-negative integer read off an attribute; `0` when absent or malformed. */
const readCount = (input: HTMLInputElement, name: string): number => {
  const parsed = Number(input.getAttribute(name))
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

/** The value the box publishes: its query, or `''` while it is below the minimum length. */
export function publishedSearchValue(value: string, minLength: number): string {
  const query = value.trim()
  return query.length < Math.max(minLength, 1) ? '' : query
}

/** Send the box's current value on its channel. */
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
}

/**
 * Publish on every `input` from a declaring search box, debounced per box.
 *
 * One delegated listener, for the reason the native-select publisher uses one:
 * a box arriving with a refreshed server-rendered region carries its
 * attributes but no listener of its own.
 */
export function setupSearchInputPublishers(): void {
  const pending = new WeakMap<HTMLInputElement, ReturnType<typeof setTimeout>>()
  document.addEventListener('input', (event) => {
    const { target } = event
    if (!(target instanceof HTMLInputElement) || !target.matches(PUBLISHER_SELECTOR)) return
    const previous = pending.get(target)
    if (previous !== undefined) clearTimeout(previous)
    const delay = readCount(target, 'data-search-debounce')
    if (delay === 0) {
      publish(target)
      return
    }
    pending.set(
      target,
      setTimeout(() => {
        pending.delete(target)
        publish(target)
      }, delay)
    )
  })
}
