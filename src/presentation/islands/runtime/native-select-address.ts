/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The address half of an island-less `select.native` declaring
 * `publishes.url`: its choice is written to the page address, and read back
 * from it, under `<bindTo>.<param>` — the spelling the themed select's
 * `publishes.url` writes, so a link built for one opens the other.
 *
 * Split from `native-select-publisher.ts`, which every page loads, because few
 * pages hold a mirrored select.
 */

/** The address key a mirrored choice is written under. */
export const addressKeyOf = (bindTo: string, param: string): string => `${bindTo}.${param}`

/** Write a mirrored choice in place in the address; an empty choice takes its key out. */
export function mirrorInAddress(bindTo: string, param: string, value: string): void {
  const url = new URL(window.location.href)
  const key = addressKeyOf(bindTo, param)
  if (value === '') url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  window.history.replaceState(window.history.state, '', url)
}

/**
 * Open every mirrored `<select>` on the value the address carries for it, and
 * publish that value, so a link carrying the filter lands on a control that
 * says what the list below it shows. A value no option offers is left alone:
 * the control keeps what the server drew.
 *
 * Run at start-up and again after every in-page navigation, since a swap
 * brings its controls in with the server's opening value and the address only
 * names the new page once the swap has announced itself.
 */
export function restoreFromAddress(
  selector: string,
  publish: (bindTo: string, param: string, value: string) => void
): void {
  const search = new URLSearchParams(window.location.search)
  document.querySelectorAll<HTMLSelectElement>(selector).forEach((select) => {
    if (select.multiple) return
    const bindTo = select.getAttribute('data-publishes-bind-to') ?? ''
    const param = select.getAttribute('data-publishes-param') ?? ''
    const value = search.get(addressKeyOf(bindTo, param))
    if (value === null || value === select.value) return
    const option = Array.from(select.options).find((candidate) => candidate.value === value)
    if (!option) return
    option.selected = true
    publish(bindTo, param, value)
  })
}
