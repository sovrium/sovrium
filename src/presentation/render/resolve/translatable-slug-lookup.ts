/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A collection page reading its record by ONE translatable slug field
 * (`slugField: slug`, [internal ref] amendment A1): in each language the record is
 * found by that language's STORED value, and its addresses are built from the
 * stored map. Neither reads the read fallback: a record with no value in a
 * language has no page there.
 */

import { requestedRecordLanguage } from '@/domain/models/app/languages/localized-value-service'
import {
  isTranslatableSlugField,
  type CollectionSlugField,
} from '@/domain/models/app/pages/collection-slug-field-service'
import { storedCellOf } from '@/presentation/render/resolve/localized-rows-db'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

/**
 * The language code the record is looked up in — the page's own language, the
 * one its route was matched in — when the collection names one translatable
 * slug field; `{}` otherwise, so the lookup compares the column as it is.
 */
export const slugLookupLanguage = (
  collection: { readonly table: string; readonly slugField: CollectionSlugField },
  db: DataSourceDb
): { readonly paramLanguage?: string } => {
  const text = db.recordText
  if (text === undefined) return {}
  if (!isTranslatableSlugField(text.tables, collection.table, collection.slugField)) return {}
  const code = requestedRecordLanguage(text.languages, text.locale, undefined)
  return code === undefined ? {} : { paramLanguage: code }
}

/**
 * The record its addresses are read from: for one translatable slug field the
 * visitor may read, that field as it is STORED (the language map, read off
 * `stored`, the record before localization); any other record as it is.
 */
export const addressableRecord = (
  collection: { readonly table: string; readonly slugField: CollectionSlugField },
  record: Readonly<Record<string, unknown>>,
  stored: Readonly<Record<string, unknown>>,
  db: DataSourceDb
): { readonly record: Readonly<Record<string, unknown>>; readonly translatable: boolean } => {
  const { slugField } = collection
  if (!isTranslatableSlugField(db.recordText?.tables, collection.table, slugField)) {
    return { record, translatable: false }
  }
  if (!(slugField in record)) return { record, translatable: true }
  return { record: { ...record, [slugField]: storedCellOf(stored, slugField) }, translatable: true }
}
