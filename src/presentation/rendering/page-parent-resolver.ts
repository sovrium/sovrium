/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Page } from '@/domain/models/app/pages'
import type { DataSourceDb } from '@/presentation/rendering/data-source-resolver'

export type PageParentResolution =
  | { readonly kind: 'record'; readonly record: Readonly<Record<string, unknown>> }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'none' }

export async function resolvePageParentRecord(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  db: DataSourceDb
): Promise<PageParentResolution> {
  const { dataSource } = page as {
    readonly dataSource?: {
      readonly table: string
      readonly mode?: string
      readonly param?: string
    }
  }
  if (dataSource === undefined) return { kind: 'none' }
  if (dataSource.mode !== 'single') return { kind: 'none' }
  const paramName = dataSource.param ?? dataSource.table
  const paramValue = routeParams[paramName]
  if (paramValue === undefined) return { kind: 'not-found' }
  const record = await db.fetchSingleRecord(dataSource.table, paramName, paramValue)
  if (record === undefined) return { kind: 'not-found' }
  return { kind: 'record', record }
}
