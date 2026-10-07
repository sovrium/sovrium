/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  substituteRecordVars,
  withDisplayLabels,
} from '@/domain/models/app/pages/substitute-record-vars'
import type { DrawerContentProps } from './record-drawer-content'
import type { RawRecord } from './record-drawer-record-read'
import type { ReactElement } from 'react'

/**
 * Two values the record drawer derives for its body: the optional props it
 * spreads only when set, and its title with the record's tokens resolved.
 */

/**
 * The body props that must be ABSENT rather than `undefined`.
 * `exactOptionalPropertyTypes` distinguishes the two, so each is spread in only
 * when it has a value.
 */
export function optionalBodyProps(
  error: string | undefined,
  table: string | undefined,
  childrenHtml: string | undefined,
  related: ReactElement | undefined
): Partial<Pick<DrawerContentProps, 'error' | 'table' | 'childrenHtml' | 'related'>> {
  return {
    ...(error === undefined ? {} : { error }),
    ...(table === undefined ? {} : { table }),
    ...(childrenHtml === undefined ? {} : { childrenHtml }),
    ...(related === undefined ? {} : { related }),
  }
}

/**
 * The drawer's name for the record it holds: a title may name that record
 * (`$record.name`, `Role of $record.name`), and follows it when the drawer
 * opens on another one. A title with no token is returned as written.
 */
export function recordTitle(title: string, record: RawRecord): string {
  return substituteRecordVars(title, withDisplayLabels(record))
}
