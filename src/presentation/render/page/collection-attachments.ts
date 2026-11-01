/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { attachmentAddressing } from '@/presentation/render/resolve/row-attachment-addresses'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

/** A collection record, given its attachment parts. */
type RecordAddress = (
  record: Readonly<Record<string, unknown>>
) => Promise<Readonly<Record<string, unknown>>>

/**
 * A collection page's attachment addressing, as a list row's: the page with
 * each attachment token of its table rewritten (before its record is
 * substituted; its `meta` too, so a sharing image is the file's address), and
 * how its record, once projected, is given the parts. A page naming no
 * attachment, or no collection, is used as it is.
 */
export function collectionAttachments(
  page: Page,
  app: App,
  db: DataSourceDb
): { readonly page: Page; readonly address: RecordAddress } {
  const tableName = page.collection?.table
  const template = [page.components, page.meta] as const
  const addressing =
    tableName === undefined
      ? undefined
      : attachmentAddressing({ template, app, tableName, sign: db.signFileUrl })
  if (addressing === undefined) return { page, address: async (record) => record }
  const [components, meta] = addressing.rewrite(template)
  return {
    page: { ...page, components, ...(meta !== undefined && { meta }) },
    address: addressing.address,
  }
}
