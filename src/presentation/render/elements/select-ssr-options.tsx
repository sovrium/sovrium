/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

/** One resolved choice as the select renderers consume it. */
type SsrSelectOption = { readonly value: string; readonly label: string }

/**
 * Server-render a select's real choices as `<option>` elements.
 *
 * The option list is resolved on the SERVER — statically in `options`, or from a
 * bound table by `resolveSelectOptionSources` — so it belongs in the FIRST
 * response. A dropdown whose choices appear only
 * after the island bundle loads is invisible to crawlers and flashes empty on
 * arrival.
 *
 * Falls back to the single inert placeholder row only when there is genuinely
 * nothing to show, so the disabled pre-hydration control still has a visible
 * line of text instead of collapsing to an empty box.
 *
 * Lives beside `nav-menu-parts` rather than in the renderer file so the SSR
 * placeholder and the island can never drift on what a choice looks like.
 */
export function renderSsrSelectOptions(
  options: unknown,
  placeholder: string | undefined
): ReactElement[] {
  const items = Array.isArray(options) ? (options as readonly SsrSelectOption[]) : []
  if (items.length === 0) {
    return [<option key="placeholder">{placeholder ?? 'Loading...'}</option>]
  }
  return items.map((option) => (
    <option
      key={option.value}
      value={option.value}
    >
      {option.label}
    </option>
  ))
}
