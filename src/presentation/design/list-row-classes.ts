/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** `listDisplay.itemLayout`: one line per row, or the title over its details. */
export type ListItemLayout = 'inline' | 'stacked'

/** The class list of every part of one item-template row. */
export interface ListRowClasses {
  readonly item: string
  readonly textColumn: string
  readonly title: string
  readonly subtitle: string
  readonly meta: string
  /** The list's own `<ul>`, merged with the `list` part — present only when declared. */
  readonly list?: string
}
