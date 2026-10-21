/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/row-actions@0.37.0#fe05ef53d438

// The console's row-action grid: the one decision every grid shares (its row menu) lives here,
// and each placement passes its source, columns, layout and messages. An input a site leaves
// out removes its field, so the grid draws its own default there.

// ── From rowActionsTableCopy ───────────────────────────────────────────────────
/** The block's `table` node, as the console installs it. */

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consoleGrid = {
  name: 'console-grid',
  type: 'table',
  render: 'transparent',
  inputs: {
    id: {
      kind: 'text',
    },
    ariaLabel: {
      kind: 'text',
    },
    dataSource: {
      kind: 'json',
      required: true,
    },
    columns: {
      kind: 'json',
    },
    emptyMessage: {
      kind: 'text',
    },
    noMatchMessage: {
      kind: 'text',
    },
    layout: {
      kind: 'text',
    },
    pagination: {
      kind: 'json',
    },
    phoneLayout: {
      kind: 'text',
    },
    onRowClick: {
      kind: 'json',
    },
    columnsFrom: {
      kind: 'json',
    },
    selection: {
      kind: 'json',
    },
  },
  rowActions: {
    display: 'menu',
  },
  props: {
    id: '$id',
    'aria-label': '$ariaLabel',
  },
  dataSource: '$dataSource',
  columns: '$columns',
  emptyMessage: '$emptyMessage',
  noMatchMessage: '$noMatchMessage',
  layout: '$layout',
  pagination: '$pagination',
  phoneLayout: '$phoneLayout',
  onRowClick: '$onRowClick',
  columnsFrom: '$columnsFrom',
  selection: '$selection',
  viewOptions: 'toolbar',
} as unknown as Template
