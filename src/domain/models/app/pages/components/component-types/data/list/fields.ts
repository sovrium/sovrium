/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { RowClickActionSchema } from '../../../action'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { ListDisplaySchema } from './list-display'

export const ListTypeLiteral = Schema.Literal('list')

export const listFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  listDisplay: Schema.optional(ListDisplaySchema),
  /**
   * What clicking an item does — the same two verbs a grid row takes
   * (`navigate` / `openDrawer`), so a list of records can open the one a reader
   * picks. `openDrawer` also writes `?record=<id>` into the address, as the grid
   * does, so the opened record is a link.
   */
  onRowClick: Schema.optional(RowClickActionSchema),
} as const

// Re-export all sub-schemas
