/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ListRowClickActionSchema } from '../../../action'
import { AuthSourceSchema } from '../../../auth-source'
import { DataSourceSchema } from '../../../data-source'
import { SystemSourceSchema } from '../../../system-source'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { ListDisplaySchema } from './list-display'

export const ListTypeLiteral = Schema.Literal('list')

/**
 * A list's data source: the shared data-bound union, plus the account lists.
 *
 * A list is the one data-bound component a settings page draws rows with
 * (sessions, passkeys, members), so the `auth` arm is added here rather than
 * to the shared `dataBoundFields`, which a kanban, a calendar and a chart also
 * spread and for which an account list means nothing.
 */
export const ListDataSourceSchema = Schema.Union([
  DataSourceSchema,
  Schema.Struct({
    /** System read-endpoint binding (mutually exclusive with the DB-table form) */
    system: SystemSourceSchema,
  }).annotate({
    title: 'List System Data Source',
    description: 'System read-endpoint binding for a list',
  }),
  AuthSourceSchema,
]).annotate({
  identifier: 'ListComponentDataSource',
  title: 'List Data Source',
  description:
    'DB-table binding (DataSource), a system read-endpoint binding, OR an account list the server scopes to the reader (auth)',
})

export const listFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  dataSource: Schema.optional(ListDataSourceSchema),
  listDisplay: Schema.optional(ListDisplaySchema),
  /**
   * What clicking an item does — the two verbs a grid row takes
   * (`navigate` / `openDrawer`), so a list of records can open the one a reader
   * picks, plus `fill`, which writes a value from the item into a form control
   * on the same page (a composer's reusable scripts). `openDrawer` also writes
   * `?record=<id>` into the address, as the grid does, so the opened record is a
   * link.
   */
  onRowClick: Schema.optional(ListRowClickActionSchema),
} as const

// Re-export all sub-schemas
