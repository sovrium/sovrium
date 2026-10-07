/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The marks a grid row carries on its `<tr>`: its identity, and — when the
 * grid reads the reader's own sessions (`dataSource: { auth: sessions }`) —
 * whether the row is the session reading the page, as `data-session-current`.
 *
 * The sessions list is recognised by the endpoint the server bound it to
 * (`render/resolve/auth-source-binding.ts` builds the same path), provided once
 * at the island root so no row-level prop threads through the body layers.
 */

import { createContext, useContext } from 'react'
import { rowIdOf } from './row-identity'
import type { DataTableRow } from './island/table-features'

/** The endpoint the reader's sessions list is read from. */
const ACCOUNT_SESSIONS_ENDPOINT = '/api/account/lists/sessions'

/** True inside a grid reading the reader's sessions. */
export const AccountSessionsContext = createContext(false)

/** Whether a grid's system endpoint is the reader's sessions list. */
export const isAccountSessionsEndpoint = (endpoint: string | undefined): boolean =>
  endpoint === ACCOUNT_SESSIONS_ENDPOINT

/** The attributes a row's `<tr>` carries. */
export function useRowMarkers(row: DataTableRow): Readonly<Record<string, string>> {
  const sessions = useContext(AccountSessionsContext)
  const { current } = row.original
  return {
    'data-row-id': rowIdOf(row),
    ...(sessions && typeof current === 'boolean' && { 'data-session-current': String(current) }),
  }
}
