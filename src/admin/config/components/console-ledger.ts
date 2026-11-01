/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/data-table@0.37.0#9cec907aa829

// A read-only ledger table: its source, columns and empty message are passed per site.

// ── From dataTableCopy ─────────────────────────────────────────────────────────
/**
 * The design-system pages' read-only ledgers, INSTALLED from the library's
 * `data-table` block: shadcn's table anatomy with labelled columns that sort
 * from their header. Re-install with `sovrium library add block/data-table --update`.
 *
 * What the copy keeps is the grid itself and nothing the block layers on top
 * of it. A ledger here reads a design-system endpoint the operator's config
 * bounds, so it holds every row (no pager), it is read-only (no selection, no
 * bulk delete: the section has no write verb), and it is a handful of rows (no
 * search box: a textbox in this section is the edit affordance it refuses).
 * Each ledger binds its read, its columns and their labels, and its empty line.
 */

import type { TemplateEncoded } from '@/domain/models/app/components'

export const consoleLedger: TemplateEncoded = {
  name: 'console-ledger',
  type: 'table',
  render: 'transparent',
  inputs: {
    ariaLabel: {
      kind: 'text',
      required: true,
    },
    className: {
      kind: 'text',
    },
    dataSource: {
      kind: 'json',
      required: true,
    },
    columns: {
      kind: 'json',
      required: true,
    },
    emptyMessage: {
      kind: 'text',
      required: true,
    },
  },
  props: {
    'aria-label': '$ariaLabel',
    className: '$className',
  },
  dataSource: '$dataSource',
  columns: '$columns',
  emptyMessage: '$emptyMessage',
}
