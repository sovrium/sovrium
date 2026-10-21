/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Records — the operator's own rows, one grid per declared table.
//
// TWO pages, because the surface answers two different questions:
//
//   `/records`         the bare collection. Nothing useful to show: the sidebar's
//                     auto-expanded Records disclosure IS the table picker, so
//                     this 302s to the first table. It renders only for an app
//                     that declares NO tables, and then it is an empty state.
//   `/records/:table`  one table's Airtable-grade record grid + the record-detail
//                     drawer a row click opens.
//
// ─── WHAT IT TOOK TO WRITE THIS AS CONFIG ──────────────────────────────────
//
// This page was the last Data surface that genuinely could not be authored, and
// the reason was narrow and specific: a config page written once cannot know
// which table it will be asked for, and could therefore neither BIND a grid to
// it nor enumerate its COLUMNS. Two primitives closed exactly that —
// `dataSource.table: $param.table` binds the table the URL names, and
// `columnsFrom: table` derives one column per declared field of whatever that
// turns out to be, honouring field-level read permissions server-side.
//
// A third thing had to move, and it is NOT visible here: `table` resolves
// columns, field meta and permissions from the RENDERING app's `tables`, which
// under a mount is the console preset's — and the preset declares none. The
// operator table the URL names is merged in by the MOUNT
// (`routeBoundOperatorTables`, `application/use-cases/mount/embedded-app-mount.ts`),
// which is the one place allowed to look at the operator's schema. Without it
// every table would 404.
//
// ─── WHY NOT A SYSTEM SOURCE OVER `/api/tables/:table/records` ─────────────
//
// It renders rows and silently drops the whole feature set the surface exists
// for. Inline edit, the typed create modal and the `_canCreate` gate are each
// gated on `!isSystemSource` by construction. The DB
// binding is what keeps them, which is why `columnsFrom` exists at all.

import dashboardDataTablesTable from './dashboard-data-tables-table.page.json'
import dashboardDataTables from './dashboard-data-tables.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default [
  dashboardDataTables as PageConfig,
  dashboardDataTablesTable as PageConfig,
] satisfies readonly PageConfig[]
