/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/record-sheet@0.37.0#d970a65eef96

// The record drawer a grid row opens: its id, source, fields and edit right are passed per site.

// ── From recordSheetCopy ───────────────────────────────────────────────────────
/**
 * The console's record drawers, INSTALLED from the library's `record-sheet`
 * block: shadcn's Sheet from the right edge (from the bottom on a phone), at
 * its medium width, with Prev/Next through the grid's rows. What the copy
 * holds is that frame; each drawer binds its id, title, read, fields, whether
 * it may edit, and its actions.
 */

import type { TemplateEncoded } from '@/domain/models/app/components'

export const consoleRecordSheet: TemplateEncoded = {
  name: 'console-record-sheet',
  type: 'sheet',
  render: 'transparent',
  inputs: {
    id: {
      kind: 'text',
      required: true,
    },
    dataSource: {
      kind: 'json',
      required: true,
    },
    canEdit: {
      kind: 'boolean',
      required: true,
    },
    props: {
      kind: 'json',
    },
    recordFields: {
      kind: 'json',
    },
    actions: {
      kind: 'json',
    },
  },
  drawerSide: 'right',
  drawerSize: 'md',
  navigation: {
    siblings: true,
  },
  id: '$id',
  dataSource: '$dataSource',
  canEdit: '$canEdit',
  props: '$props',
  recordFields: '$recordFields',
  actions: '$actions',
}
