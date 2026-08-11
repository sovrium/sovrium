/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const DataTableTypeLiteral = Schema.Literal('data-table')

/**
 * `dataTableFields` used to be declared HERE, as a second list of a
 * data-table's config keys alongside `DataTableSchema` in `./schema`. Nothing
 * linked the two, so they drifted in both directions — `defaultSort` typed but
 * rejected at `sovrium validate`, `autoSave` decoded but missing from
 * `keyof DataTable`, `dataSource.view` typed AND documented AND cross-validated
 * yet rejected — and every drift was invisible until it cost a RED cycle.
 *
 * There is now one list, in `./schema`, and `DataTableSchema` is built from it.
 * This module keeps re-exporting the whole surface, so every import path that
 * pointed at this directory still resolves to the same names.
 */
export * from './schema'
