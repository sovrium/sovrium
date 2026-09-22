/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The one table literal, since `static-table` folded into it.
 *
 * A `table` draws EITHER the rows written in the config or the records its
 * `dataSource` binds — the presence of the binding is what chooses, which is
 * the distinction the second type name used to stand in for. The two mechanisms
 * are still two renderers; only the name the author writes is one.
 */
export const TableTypeLiteral = Schema.Literal('table')

/**
 * `tableFields` used to be declared HERE, as a second list of a
 * table's config keys alongside `DataTableSchema` in `./schema`. Nothing
 * linked the two, so they drifted in both directions — `defaultSort` typed but
 * rejected at `sovrium validate`, `autoSave` decoded but missing from
 * `keyof DataTable`, `dataSource.view` typed AND documented AND cross-validated
 * yet rejected — and every drift was invisible until it cost a RED cycle.
 *
 * There is now one list, in `./schema`, and `DataTableSchema` is built from it.
 * This module keeps re-exporting the whole surface, so every import path that
 * pointed at this directory still resolves to the same names.
 */
