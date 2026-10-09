/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Component } from '@/domain/models/app/pages/components'

/**
 * Does a node read ONE record of its own, other than the page's?
 *
 * A `mode: single` binding to another table — or to a system detail — does. The
 * page-record pass must then leave that node's own `props`, `content` and typed
 * fields alone: the node's own pass (`data-source-modes.ts`) fills them with its
 * own record, typed by its own table, and a first pass by the page record would
 * win — printing the page's value for a field both tables share, and nothing for
 * one only the node's table has. Its `dataSource` is still filled by the page
 * record: that is how a nested binding follows the page.
 *
 * A node bound to the page's own table reads the same record either way, so it
 * keeps the page pass; a list binding reads no single record its own text could
 * quote, so it keeps it too.
 */
export const readsAnotherRecord = (
  component: Component,
  pageTable: string | undefined
): boolean => {
  const binding = component.dataSource as
    { readonly mode?: string; readonly table?: string } | undefined
  return binding?.mode === 'single' && binding.table !== pageTable
}
