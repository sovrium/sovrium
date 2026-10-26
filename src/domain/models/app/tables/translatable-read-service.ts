/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lookupLinksOf, MAX_LOOKUP_CHAIN_DEPTH } from './lookup-link-service'
import { declaresTranslatable } from './translatable-field-service'
import type { App } from '@/domain/models/app'

/**
 * Whether `field` of `tableName` holds translatable content when read: the
 * field is translatable itself, or it is a lookup copying one — through as many
 * lookups of lookups as {@link MAX_LOOKUP_CHAIN_DEPTH} allows. A lookup carries
 * its source's map through and is resolved at read with the same rule, so a
 * lookup and its source never disagree.
 */
export const readsTranslatableValue = (
  app: App,
  tableName: string,
  field: string,
  depth = 0
): boolean => {
  if (depth > MAX_LOOKUP_CHAIN_DEPTH) return false
  const declared = app.tables
    ?.find((table) => table.name === tableName)
    ?.fields.find((candidate) => candidate.name === field)
  if (declared === undefined) return false
  if (declaresTranslatable(declared)) return true
  if (declared.type !== 'lookup') return false
  const link = lookupLinksOf(app, tableName).find((candidate) => candidate.lookup === field)
  return (
    link !== undefined &&
    readsTranslatableValue(app, link.relatedTable.name, link.relatedField, depth + 1)
  )
}

/**
 * The fields of `tableName` that hold translatable content when read (see
 * {@link readsTranslatableValue}). Empty for an app that declares no
 * languages, which cannot declare a translatable field.
 */
export const translatableReadFieldsOf = (app: App, tableName: string): ReadonlySet<string> => {
  if (app.languages === undefined) return new Set()
  const fields = app.tables?.find((table) => table.name === tableName)?.fields ?? []
  return new Set(
    fields.map((field) => field.name).filter((name) => readsTranslatableValue(app, tableName, name))
  )
}
