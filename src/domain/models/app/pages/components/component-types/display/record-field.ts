/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataSourceSchema } from '../../data-source'
import { SystemDetailSourceSchema } from '../../system-detail-source'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

/**
 * `record-field` — a read-only display of a single bound record field
 *.
 *
 * Placed inside a `dataSource: { mode: 'single' }` (or `collection`) container,
 * it resolves the bound record's value for `props.field` and renders it by the
 * field's DECLARED table type:
 *   - `rich-text` → stored HTML sanitized via the canonical `sanitizeRichTextHTML`
 *     (security rule S2) and rendered as real elements.
 *   - attachment family (`attachment` / `single-attachment` / `multiple-attachments`)
 *     → a read-only download link (file name + url).
 *   - otherwise → plain text.
 *
 * `props.field` carries the bound record field NAME (not a `$record.X` token);
 * the renderer + data-source resolver inject the resolved value at render time.
 */
export const RecordFieldTypeLiteral = Schema.Literal('record-field')

export const recordFieldFields = {
  ...coreFields,
  ...visibilityFields,
  /**
   * Optional OWN single-record source.
   *
   * When omitted (the original behavior), a `record-field` inherits the bound
   * record from its host container's `dataSource: { mode: single }` / `collection`
   * `$record` context and resolves `props.field` from it.
   *
   * When present, the `record-field` SELF-binds to a single record, discriminated:
   *  - `DataSourceSchema` (`{ table, mode: single, param }`) — fetch the record from
   *    the DB-table single-record route (`GET …/records/:id`);
   *  - `{ system }` — a system DETAIL-endpoint binding (`SystemDetailSourceSchema`):
   *    resolve the single record from a read endpoint (e.g. an automation run
   *    detail) instead of `/api/tables/:t/records/:id`, then render `props.field`
   *    from it by the field's declared type.
   *
   * This is additive — a `record-field` without a `dataSource` keeps inheriting
   * from its container exactly as before.
   */
  dataSource: Schema.optional(
    Schema.Union([
      DataSourceSchema,
      Schema.Struct({
        /** System detail-endpoint binding (mutually exclusive with the DB-table form) */
        system: SystemDetailSourceSchema,
      }).annotate({
        title: 'Record Field System Detail Source',
        description: 'System detail-endpoint binding for a self-binding record-field',
      }),
    ]).annotate({
      identifier: 'RecordFieldDataSource',
      title: 'Record Field Data Source',
      description:
        'Optional own single-record binding: a DB-table source (DataSource) OR a system detail-endpoint binding',
    })
  ),
} as const
