/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The row a control sits in: the `origin` a dispatched row action closes from
 * (an action's `onSuccess.close` closes the overlay holding the table). A
 * confirm dialog and a menu are portalled out of the row, so they read it off
 * the control that opened them.
 */
export const rowOf = (node: Element | null | undefined): Element | undefined =>
  node?.closest('tr, [role="row"]') ?? undefined
