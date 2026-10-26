/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataFilterSchema, ViewerRowLookupSchema } from './components/data-source'

/**
 * One slug field per language, keyed by language code:
 * `{ fr: slug_fr, en: slug_en }`.
 *
 * Each language's address reads its record by that language's field, and the
 * page's `path` must then be a path per language whose dynamic segment, in
 * each language, is named after that language's field
 * (`{ fr: /cas/:slug_fr, en: /cases/:slug_en }`).
 *
 * The keys are plain strings on purpose, as for a path per language: an
 * Effect `Schema.Record` whose key schema refuses a key DROPS that entry
 * silently. Which codes are allowed, which fields exist and whether the
 * page's `path` matches are judged with the app, where each refusal can name
 * the page, the language and the field.
 */
export const LocalizedSlugFieldSchema = Schema.Record(
  Schema.String,
  Schema.String.check(Schema.isMinLength(1))
).pipe(
  Schema.annotate({
    title: 'Slug field per language',
    description:
      "One slug field per language, keyed by language code. Each language's address finds its record by that language's field, and lists the same record's address in every other language as its hreflang alternate.",
    examples: [{ fr: 'slug_fr', en: 'slug_en' }],
  }),
  Schema.check(
    Schema.makeFilter((fields: Readonly<Record<string, string>>) =>
      Object.keys(fields).length > 0
        ? true
        : 'A slug field per language must name at least one language'
    )
  )
)

/**
 * `collection.slugField`: one field shared by every language, or one field
 * per language.
 *
 * The plain string keeps its meaning unchanged. It is also the form a
 * translatable field will take: a string naming a field that holds one value
 * per language needs no map.
 */
export const PageCollectionSlugFieldSchema = Schema.Union([
  Schema.String,
  LocalizedSlugFieldSchema,
]).annotate({
  title: 'Slug field',
  description:
    'Field whose value becomes the URL parameter: one field for every language, or a map of one field per language code.',
  howTo:
    "Name one field when every language shares the slug. When each language has its own slug (`slug_fr`, `slug_en`), give a map `{ fr: slug_fr, en: slug_en }` and write `path` per language with each language's segment named after its field: `path: { fr: /cas/:slug_fr, en: /cases/:slug_en }`. Make each slug field `unique`. A record whose slug is empty in a language has no page in that language, and no alternate points there. To keep one translatable slug field instead of one field per language, name it once (`slugField: slug`) beside a path per language that each carry `:slug`: each language reads its own value, and a record with no value in a language has no page there.",
})

/**
 * `pages[].collection` — a template page that generates one route per record
 * of a table.
 *
 * The `slugField` names the field mapped to the dynamic URL parameter, and
 * `$record.*` becomes available in every component, in `meta` and in
 * children. `$collection.previous` and `$collection.next` name the records on
 * either side in the collection's order — within the record's `scope` when one
 * is declared — and `$collection.resume`, with `resume`, the first record of
 * that scope the reader has no row for.
 *
 * @example
 * ```yaml
 * path: /lessons/:slug
 * collection:
 *   table: lessons
 *   slugField: slug
 *   filter: [{ field: status, operator: eq, value: published }]
 *   scope: course
 *   resume: { table: completions, link: lesson, user: member }
 * ```
 */
export const PageCollectionSchema = Schema.Struct({
  /** Table name to generate pages from (must exist in app.tables) */
  table: Schema.String.annotate({
    description: 'Table name to generate collection pages from',
  }),
  /**
   * The field whose value becomes the URL parameter: one field for every
   * language, or a {@link LocalizedSlugFieldSchema} map of one field per
   * language.
   */
  slugField: PageCollectionSlugFieldSchema,
  /** Optional filter to limit which records generate pages */
  filter: Schema.optional(
    Schema.Array(DataFilterSchema).annotate({
      description: 'Filter conditions to limit which records generate pages',
    })
  ),
  /**
   * Keep `$collection.previous` / `$collection.next` (and `resume`) among
   * the records sharing the current record's value of this field: a
   * lesson's neighbours stay in its course, and the last lesson of a course
   * has no next rather than one pointing into another course.
   */
  scope: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Field whose value the current record shares with its neighbours: `$collection.previous`, `$collection.next` and `$collection.resume` stay among the records with the same value (a lesson's course). Without it they range over the whole collection",
        examples: ['course', 'section'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Expose `$collection.resume`: the first record, in the collection's
   * order and within `scope`, that has no row of `table` for the reader —
   * the first lesson she has not completed. Empty when every record has one.
   */
  resume: Schema.optional(
    ViewerRowLookupSchema.annotate({
      description:
        "Exposes `$collection.resume`, the first record in the collection's order (within `scope`) for which the reader has no row of `table`: the first lesson she has not completed. Empty when she has a row for every record, and records she may not read are skipped",
    })
  ),
}).annotate({
  identifier: 'PageCollection',
  title: 'Page Collection',
  description: 'Template page configuration that generates one route per table record',
})

/** @public */
export type PageCollection = Schema.Schema.Type<typeof PageCollectionSchema>
