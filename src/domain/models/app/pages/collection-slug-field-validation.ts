/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cross-validation of a collection page's slug field per language
 * (`slugField: { fr: slug_fr, en: slug_en }`).
 *
 * Six refusals, in this order, each naming the page and the language:
 *
 *  1. a language `languages.supported` does not declare;
 *  2. a plain `path` beside the map: a path per language is what gives each
 *     language its own segment;
 *  3. a map naming other languages than the `path` map: a language with a
 *     path and no slug field (or the reverse) has no way to find its record;
 *  4. a field the collection's table does not have;
 *  5. a field that is not `single-line-text`: a slug is one line of text — or
 *     a translatable one, which holds a slug per language already and is
 * named once (`slugField: slug`), never per language ([internal ref] A1);
 *  6. a language's path lacking the `:<field>` segment named after its field,
 *     which is how the route hands the slug to the record lookup.
 *
 * A slug field that is not unique is not refused but warned about
 * ({@link slugFieldUniquenessWarnings}): two records sharing a slug make one
 * address serve the first and pair it with the wrong twin. One translatable
 * slug field is warned about once, unless it is unique in each language.
 */

import { isLocalizedPagePath } from '@/domain/kernel/matching/localized-path'
import { declaresTranslatable } from '../tables/translatable-field-service'
import { isUniqueInEachLanguage } from '../tables/translatable-unique-service'
import { isSlugFieldPerLanguage, isTranslatableSlugField } from './collection-slug-field-service'

/** One field of a table, as this validation reads it. */
interface FieldForSlugValidation {
  readonly name: string
  readonly type: string
  readonly unique?: boolean
  readonly translatable?: boolean
}

/** One table, as this validation reads it. */
interface TableForSlugValidation {
  readonly name: string
  readonly fields: ReadonlyArray<FieldForSlugValidation>
  readonly unique?: ReadonlyArray<{ readonly fields: ReadonlyArray<string> }>
  readonly indexes?: ReadonlyArray<{
    readonly fields: ReadonlyArray<string>
    readonly unique?: boolean
  }>
}

/** Minimal app shape this validation reads. */
export interface AppForSlugFieldValidation {
  readonly pages?: ReadonlyArray<{
    readonly name: string
    readonly path: string | Readonly<Record<string, string>>
    readonly collection?: {
      readonly table: string
      readonly slugField: string | Readonly<Record<string, string>>
    }
  }>
  readonly languages?: { readonly supported: ReadonlyArray<{ readonly code: string }> }
  readonly tables?: ReadonlyArray<TableForSlugValidation>
}

/** A collection page naming a slug field per language, with its table when declared. */
interface PerLanguageSlugPage {
  readonly name: string
  readonly path: string | Readonly<Record<string, string>>
  readonly fields: Readonly<Record<string, string>>
  readonly tableName: string
  readonly table: TableForSlugValidation | undefined
}

const perLanguageSlugPages = (app: AppForSlugFieldValidation): ReadonlyArray<PerLanguageSlugPage> =>
  (app.pages ?? []).flatMap((page) => {
    const { collection } = page
    if (collection === undefined || !isSlugFieldPerLanguage(collection.slugField)) return []
    return [
      {
        name: page.name,
        path: page.path,
        fields: collection.slugField,
        tableName: collection.table,
        table: app.tables?.find((table) => table.name === collection.table),
      },
    ]
  })

const refuseUndeclaredLanguage = (
  page: PerLanguageSlugPage,
  codes: ReadonlyArray<string>
): true | string => {
  const unknown = Object.keys(page.fields).find((code) => !codes.includes(code))
  if (unknown === undefined) return true
  const declared =
    codes.length === 0
      ? 'the app declares no languages'
      : `languages.supported declares ${codes.join(', ')}`
  return `Page "${page.name}" names a slug field for language "${unknown}" (${page.fields[unknown]}), but ${declared}`
}

const refusePlainPath = (page: PerLanguageSlugPage): true | string =>
  isLocalizedPagePath(page.path)
    ? true
    : `Page "${page.name}" names a slug field per language beside one path (${page.path}); write a path per language, each language's segment named after its field: { ${Object.entries(
        page.fields
      )
        .map(([code, field]) => `${code}: /…/:${field}`)
        .join(', ')} }`

const refuseDifferentLanguages = (
  page: PerLanguageSlugPage,
  paths: Readonly<Record<string, string>>
): true | string => {
  const withoutField = Object.keys(paths).find((code) => page.fields[code] === undefined)
  if (withoutField !== undefined) {
    return `Page "${page.name}" declares a path for language "${withoutField}" (${paths[withoutField]}) but no slug field for it; slugField and path must name the same languages`
  }
  const withoutPath = Object.keys(page.fields).find((code) => paths[code] === undefined)
  return withoutPath === undefined
    ? true
    : `Page "${page.name}" names a slug field for language "${withoutPath}" (${page.fields[withoutPath]}) but no path for it; slugField and path must name the same languages`
}

const refuseFieldOf = (page: PerLanguageSlugPage): true | string => {
  const { table } = page
  if (table === undefined) return true
  const problem = Object.entries(page.fields)
    .map(([code, name]) => {
      const field = table.fields.find((candidate) => candidate.name === name)
      if (field === undefined) {
        return `Page "${page.name}" reads its language "${code}" slug from ${name}, a field table "${page.tableName}" does not have`
      }
      if (field.type !== 'single-line-text') {
        return `Page "${page.name}" reads its language "${code}" slug from ${name}, a ${field.type} field; a slug field must be single-line-text`
      }
      return declaresTranslatable(field)
        ? `Page "${page.name}" reads its language "${code}" slug from ${name}, a translatable field, which holds a slug per language already; name it once: slugField: ${name}`
        : undefined
    })
    .find((message) => message !== undefined)
  return problem ?? true
}

const refuseMissingSegment = (
  page: PerLanguageSlugPage,
  paths: Readonly<Record<string, string>>
): true | string => {
  const entry = Object.entries(page.fields).find(
    ([code, field]) => !(paths[code] ?? '').split('/').includes(`:${field}`)
  )
  if (entry === undefined) return true
  const [code, field] = entry
  return `Page "${page.name}" writes its path for language "${code}" as ${paths[code] ?? ''}, which needs a :${field} segment named after its slug field`
}

const refusePage = (page: PerLanguageSlugPage, codes: ReadonlyArray<string>): true | string => {
  const languageError = refuseUndeclaredLanguage(page, codes)
  if (languageError !== true) return languageError
  const pathError = refusePlainPath(page)
  if (pathError !== true || !isLocalizedPagePath(page.path)) return pathError
  const paths = page.path
  const languagesError = refuseDifferentLanguages(page, paths)
  if (languagesError !== true) return languagesError
  const fieldError = refuseFieldOf(page)
  return fieldError === true ? refuseMissingSegment(page, paths) : fieldError
}

/**
 * Validate every collection page naming a slug field per language.
 *
 * @returns `true` when valid, otherwise the first refusal, naming the page, the language and the field
 */
export const validateCollectionSlugFields = (app: AppForSlugFieldValidation): true | string => {
  const codes = (app.languages?.supported ?? []).map((language) => language.code)
  const refusal = perLanguageSlugPages(app)
    .map((page) => refusePage(page, codes))
    .find((outcome) => outcome !== true)
  return refusal ?? true
}

/** Whether `field` of `table` holds one value per record: its own `unique`, or a one-field unique constraint. */
const isUniqueField = (table: TableForSlugValidation, field: string): boolean =>
  table.fields.some((candidate) => candidate.name === field && candidate.unique === true) ||
  (table.unique ?? []).some((entry) => entry.fields.length === 1 && entry.fields[0] === field) ||
  (table.indexes ?? []).some(
    (index) => index.unique === true && index.fields.length === 1 && index.fields[0] === field
  )

/**
 * One warning per collection page naming one translatable slug field that is
 * not unique in each language, naming the page and the field.
 */
const translatableSlugWarnings = (app: AppForSlugFieldValidation): ReadonlyArray<string> =>
  (app.pages ?? []).flatMap((page) => {
    const { collection } = page
    if (collection === undefined) return []
    const { slugField, table: tableName } = collection
    if (!isTranslatableSlugField(app.tables, tableName, slugField)) return []
    const field = app.tables
      ?.find((table) => table.name === tableName)
      ?.fields.find((candidate) => candidate.name === slugField)
    return field === undefined || isUniqueInEachLanguage(field)
      ? []
      : [
          `Page "${page.name}" reads its slug from ${slugField}, a translatable field that is not unique: two records sharing a slug in one language make that address serve the first. Declare ${slugField} unique`,
        ]
  })

/** {@link slugFieldUniquenessWarnings} for the pages naming a slug field per language. */
const perLanguageSlugWarnings = (app: AppForSlugFieldValidation): ReadonlyArray<string> =>
  perLanguageSlugPages(app).flatMap((page) => {
    const { table } = page
    if (table === undefined) return []
    return Object.entries(page.fields)
      .filter(([, field]) => !isUniqueField(table, field))
      .map(
        ([code, field]) =>
          `Page "${page.name}" reads its language "${code}" slug from ${field}, which is not unique: two records sharing a slug make one address serve the first. Declare ${field} unique`
      )
  })

/**
 * One warning per slug field of a per-language map that is not unique, naming
 * the page, the language and the field, and one per translatable slug field
 * that is not unique in each language. Valid config, so never a refusal.
 */
export const slugFieldUniquenessWarnings = (
  app: AppForSlugFieldValidation
): ReadonlyArray<string> => [...perLanguageSlugWarnings(app), ...translatableSlugWarnings(app)]
