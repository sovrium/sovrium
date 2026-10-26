/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isLocalizedPagePath,
  localizedPageAddresses,
  type DeclaredPagePath,
  type PageAddress,
} from '@/domain/kernel/matching/localized-path'
import { fillRoutePattern } from '@/domain/kernel/matching/route-matcher'
import { storedLanguageMap } from '@/domain/models/app/languages/localized-value-service'
import { declaresTranslatable } from '@/domain/models/app/tables/translatable-field-service'

/**
 * `collection.slugField` as authored: one field shared by every language, or a
 * map of one field per language code.
 */
export type CollectionSlugField = string | Readonly<Record<string, string>>

/** Whether the collection names one slug field per language. */
export const isSlugFieldPerLanguage = (
  slugField: CollectionSlugField
): slugField is Readonly<Record<string, string>> => typeof slugField !== 'string'

/**
 * The field a record is read by in `language`: the one shared field, or that
 * language's field of a per-language map. `undefined` when the map names no
 * field for `language`, or no language is given for a map: that language has
 * no record address, and no other language's field stands in for it.
 */
export const slugFieldFor = (
  slugField: CollectionSlugField,
  language: string | undefined
): string | undefined => {
  if (!isSlugFieldPerLanguage(slugField)) return slugField
  return language === undefined ? undefined : slugField[language]
}

/**
 * The language a matched route speaks, read off its parameters: each
 * language's path names its dynamic segment after that language's field, so
 * the field the route captured names the language. `undefined` for a shared
 * field, or a route carrying none of the map's fields.
 */
export const routeSlugLanguage = (
  slugField: CollectionSlugField,
  routeParams: Readonly<Record<string, string>>
): string | undefined =>
  isSlugFieldPerLanguage(slugField)
    ? Object.keys(slugField).find((language) => {
        const field = slugField[language]
        return field !== undefined && routeParams[field] !== undefined
      })
    : undefined

/** A record's slug in `field`, or `undefined` when it holds none (empty, `NULL`, absent). */
const slugValueOf = (
  record: Readonly<Record<string, unknown>>,
  field: string
): string | undefined => textOrUndefined(record[field])

/** `value` as a slug: a number's digits, a non-empty string, else `undefined`. */
const textOrUndefined = (value: unknown): string | undefined => {
  if (typeof value === 'number') return String(value)
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * A translatable slug's value in `language`, read off the map it is STORED as
 * (PostgreSQL's `jsonb` object, SQLite's JSON text) — never through the read
 * fallback: a language whose map holds no value has no slug ([internal ref] A1).
 */
const storedSlugValueOf = (
  record: Readonly<Record<string, unknown>>,
  field: string,
  language: string
): string | undefined => textOrUndefined(storedLanguageMap(record[field], undefined)?.[language])

/** The tables a collection's slug field is looked up in, as this module reads them. */
type TablesForSlugField =
  ReadonlyArray<{ readonly name: string; readonly fields: ReadonlyArray<object> }> | undefined

/**
 * Whether a collection names ONE slug field (`slugField: slug`) that is
 * translatable: each language reads its record by its own value of that field.
 */
export const isTranslatableSlugField = (
  tables: TablesForSlugField,
  tableName: string,
  slugField: CollectionSlugField
): slugField is string => {
  if (isSlugFieldPerLanguage(slugField)) return false
  const field = tables
    ?.find((table) => table.name === tableName)
    ?.fields.find((candidate) => (candidate as { readonly name?: unknown }).name === slugField)
  return field !== undefined && declaresTranslatable(field)
}

/** What {@link recordLanguageAddresses} reads. */
export interface RecordLanguageAddressesInput {
  readonly path: DeclaredPagePath
  readonly slugField: CollectionSlugField
  /** The record, its translatable slug as STORED (the language map), when `translatable`. */
  readonly record: Readonly<Record<string, unknown>>
  readonly languages: ReadonlyArray<string>
  /** `slugField` names one translatable field ({@link isTranslatableSlugField}). */
  readonly translatable?: boolean
}

/**
 * A record's address in every language it has a slug in, in `languages`
 * order: language M's path filled with the record's slug in M — its
 * `slugField[M]` for a slug field per language, its M value of the one
 * translatable slug field otherwise. The one computation the page's
 * `hreflang` alternates, its language switcher and the sitemap all read, so
 * the three always pair the same addresses.
 *
 * A language whose slug is empty or missing has no address: it is left out,
 * never filled from another language's slug, nor from the read fallback.
 * `undefined` when the page names neither form beside a path per language:
 * its addresses are its route's own.
 */
export const recordLanguageAddresses = (
  input: RecordLanguageAddressesInput
): ReadonlyArray<PageAddress> | undefined => {
  const { path, slugField, record, languages } = input
  const perLanguage = isSlugFieldPerLanguage(slugField)
  if (!isLocalizedPagePath(path) || (!perLanguage && input.translatable !== true)) return undefined
  const addresses = localizedPageAddresses(path)
  return languages.flatMap((language) => {
    const address = addresses.find((entry) => entry.language === language)
    const field = perLanguage ? slugField[language] : slugField
    const slug =
      field === undefined
        ? undefined
        : perLanguage
          ? slugValueOf(record, field)
          : storedSlugValueOf(record, field, language)
    if (address === undefined || field === undefined || slug === undefined) return []
    return [
      { language, path: fillRoutePattern(address.path, { [field]: encodeURIComponent(slug) }) },
    ]
  })
}
