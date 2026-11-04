/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'

/**
 * A `fetch` action's `bindTo` only where it can be honoured.
 *
 * `bindTo` merges a filter channel's current params into the action's `url`
 * query when the control is pressed. Only `mode: download` and
 * `mode: navigate` send a GET to that address; a background `fetch` (the
 * default mode) and an `oauth` round trip build their request otherwise, so
 * the key would be accepted and do nothing. It is refused at load, naming the
 * control by what the reader sees on it.
 *
 * Called from `collectPageBindingViolations`, and shares its contract: pure, no
 * I/O, human-readable messages, empty when the page is well-formed. `nodes` is
 * every object the page's component tree holds, so a button, a row action or a
 * menu item at any depth is reached.
 *
 * @see ./page-binding-validation.ts — the caller
 */

/** The modes whose request is a GET to the action's address. */
const CHANNEL_MODES: ReadonlySet<string> = new Set(['download', 'navigate'])

/** What the reader sees on a control: its text, its label, else its kind. */
function controlName(node: Readonly<Record<string, unknown>>): string {
  const props = isRecord(node['props']) ? node['props'] : {}
  const named = [node['content'], node['label'], props['label'], props['aria-label']].find(
    (value): value is string => typeof value === 'string' && value.trim() !== ''
  )
  return named === undefined ? 'a control' : `'${named}'`
}

/** Every control of the page whose `fetch` action reads a channel its mode cannot carry. */
export function fetchChannelViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes.flatMap((node) => {
    const { action } = node
    if (!isRecord(action) || action['type'] !== 'fetch' || action['bindTo'] === undefined) {
      return []
    }
    const mode = typeof action['mode'] === 'string' ? action['mode'] : 'fetch'
    if (CHANNEL_MODES.has(mode)) return []
    return [
      `${label}: ${controlName(node)} declares bindTo '${String(action['bindTo'])}' on a fetch action whose mode is ${mode}, but only mode: download and mode: navigate carry a channel's filters, since only they request the url. Set mode: download or mode: navigate, or remove bindTo.`,
    ]
  })
}
