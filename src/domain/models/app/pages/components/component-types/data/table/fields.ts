/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The one table literal.
 *
 * A `table` draws EITHER the rows written in the config or the records its
 * `dataSource` binds — the presence of the binding is what chooses, so no
 * second type name is needed. The two mechanisms are two renderers; only the
 * name the author writes is one.
 */
export const TableTypeLiteral = Schema.Literal('table')

/**
 * `tableFields` is NOT declared here. A second list of a table's config keys
 * beside `DataTableSchema` would drift from it in both directions — a key typed
 * but rejected at `sovrium validate`, or decoded but missing from
 * `keyof DataTable` — invisibly.
 *
 * There is one list, in `./schema`, and `DataTableSchema` is built from it.
 * This module re-exports the whole surface, so every import path that points
 * at this directory resolves to the same names.
 */
