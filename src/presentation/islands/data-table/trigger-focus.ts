/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Hands keyboard focus back to a row action's trigger once the inline editor it
 * opened is saved or dismissed.
 *
 * The trigger is not there to hold a ref to: the editor REPLACES it, so the
 * button that was pressed is unmounted while the editor is open. And a save
 * re-reads the grid, which rebuilds every action cell (see `armed-confirm.ts`
 * for why that is structural), so even the trigger drawn back on close is
 * replaced a moment later. Focus left on a removed node falls to `<body>`, and
 * a keyboard operator is thrown back to the top of the page.
 *
 * So the request is held by the action's stable key, and each trigger asks, as
 * it mounts, whether it is the one focus should return to. It takes focus only
 * while nothing else holds it: once the operator has moved on to another
 * control, the request is dropped rather than snatching focus back on the next
 * re-read.
 */

let pendingKey: string | undefined

/** Ask that the trigger keyed `key` take focus when it next mounts. */
export function requestTriggerFocus(key: string): void {
  pendingKey = key
}

/** A trigger's ref callback: take focus if it was requested and is unclaimed. */
export function claimTriggerFocus(key: string, node: HTMLElement | null): void {
  if (node === null || pendingKey !== key) return
  const active = document.activeElement
  if (active !== null && active !== document.body && active !== node) {
    pendingKey = undefined
    return
  }
  node.focus()
}
