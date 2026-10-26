/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

/**
 * `writeOnly` — a value people and automations can WRITE, that only the
 * server reads back.
 *
 * Shared by `single-line-text` and `long-text`, the two text types a secret is
 * stored in (a client secret, an API token, a private key). Any other field
 * type refuses the key: a write-only date, choice or number has no use, and a
 * write-only computed field would be a value nobody can ever see.
 *
 * The flag is stronger than a field read rule on purpose: the admin role
 * bypasses every `permissions.fields[].read` rule, and this one it does not.
 * The OpenAPI keyword of the same name means the same thing — present in a
 * request, absent from every response.
 */
export const WriteOnlyOptionSchema = Schema.optional(
  Schema.Boolean.pipe(
    Schema.annotate({
      title: 'Write-only',
      description:
        'Keep the value out of every answer. A write-only field can be set and replaced by anyone allowed to write it, but no role reads it back, the admin included: the records API, its exports, realtime events, the MCP tools, the operator console and the record history omit it, and filtering, sorting, grouping or searching on it answers as if the field did not exist. A record shows only whether a value is stored, in its `_writeOnly` block. Automations and seed files still read and write it, so a secret reaches the system that needs it without passing through a person. It cannot be combined with `unique` or `fullTextSearch`, and a formula or lookup cannot read it.',
      defaultNote: 'false — the value is read under the usual field rules',
    })
  )
)

/**
 * `translatable` — one value per declared language, held in the field's own
 * column as a map from language code to text (`{ "fr": "…", "en": "…" }`).
 *
 * Shared by `single-line-text` and `long-text`, the two prose types a record's
 * content is written in (a product name, an article body, an FAQ answer). Any
 * other field type refuses the key: an email, a URL, a number or a choice is
 * not prose and must not differ by language.
 *
 * A reader gets ONE string, resolved through the active language, then
 * `languages.fallback`, then `languages.default`; `?lang=*` and every machine
 * output (webhooks, realtime, automations, the MCP tools, exports) get the
 * whole map. `required` means the default-language value is present.
 */
export const TranslatableOptionSchema = Schema.optional(
  Schema.Boolean.pipe(
    Schema.annotate({
      title: 'Translatable',
      description:
        "Store one value per language the app declares, in the field's own column, as a map from language code to text. A reader receives one string, chosen by the active language (the request's `lang` parameter, then its `Accept-Language` header, on a page the page's own language), then `languages.fallback`, then `languages.default`; a records request with `lang=*` receives the whole map instead. Webhooks, realtime events, the MCP record tools, the JSON export and the GDPR export always carry the whole map, and the CSV export gives it one column per declared language (`name.en`, `name.fr`); an automation template prints the default-language value, `{{trigger.data.record.name.fr}}` one language. A filter or a sort compares the default-language value; a search reads every language. A write of a plain string sets the active language and keeps the others; a write of an object merges by language, and a language set to `null` is removed. `required` asks for the default-language value only. It needs at least two declared languages. It cannot be combined with `writeOnly` or `fullTextSearch`. On a `single-line-text`, `unique` holds within each language: two live records cannot share a value in the same language, while the same value in two languages is allowed, and a record with no value in a language never collides. A `long-text` cannot be `unique`, and a table-level `unique` entry cannot name a translatable field; a formula, rollup or condition cannot read it.",
      howTo:
        'Declare `languages` with two or more entries, then set `translatable: true` on the text field whose content differs by language — a product name, an article body. Leave codes that are the same in every language (a SKU) untranslatable; a slug that differs by language can be one translatable `unique` field. Seed a value as a string for the default language, or as a map: `{ en: Linen shirt, fr: Chemise en lin }`. Adding a language later needs no migration; turning the option off keeps only the default-language value and asks for `allowDestructive`.',
      defaultNote: 'false — the field holds one value, the same in every language',
    })
  )
)

/**
 * The `default` of a field that may be translatable: a string, or a map from
 * language code to text.
 *
 * A string is the default-language value. A map gives a value per language and
 * is only meaningful on a `translatable` field; its keys must be declared
 * language codes.
 */
export const TranslatableDefaultSchema = Schema.optional(
  Schema.Union([
    Schema.String,
    Schema.Record(Schema.String, Schema.String).pipe(
      Schema.annotate({
        title: 'Per-language default',
        description:
          'A default value per language, keyed by declared language code — `{ en: Untitled, fr: Sans titre }`. Only a `translatable` field takes a map.',
      })
    ),
  ]).pipe(
    Schema.annotate({
      identifier: 'TextFieldDefault',
      description:
        'Default value for this field when creating new records. On a `translatable` field, a string is the default-language value and a map gives one value per declared language.',
    })
  )
)

/**
 * Single Line Text Field
 *
 * Short text input limited to a single line. Ideal for names, titles, labels,
 * and brief identifiers. Text is stored as-is without formatting. Required flag
 * makes the field mandatory. Unique constraint ensures no duplicate values across
 * records. Indexing improves search and filter performance on this field.
 *
 * Business Rules:
 * - Single-line constraint prevents multi-line input, ensuring consistent formatting and UI display
 * - Text is stored without formatting, preserving raw input for maximum flexibility
 * - Constant value 'single-line-text' ensures type safety and enables discriminated unions
 *
 * @example
 * ```typescript
 * const field = {
 *   id: 1,
 *   name: 'title',
 *   type: 'single-line-text',
 *   required: true,
 *   unique: false,
 *   indexed: true,
 *   default: 'Untitled'
 * }
 * ```
 */
export const SingleLineTextFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('single-line-text').pipe(
      Schema.annotate({
        description:
          "Constant value 'single-line-text' for type discrimination in discriminated unions",
      })
    ),
    default: TranslatableDefaultSchema,
    writeOnly: WriteOnlyOptionSchema,
    translatable: TranslatableOptionSchema,
  }),
  Schema.annotate({
    title: 'Single Line Text Field',
    description:
      'Short text input limited to a single line. Ideal for names, titles, labels, and brief identifiers. Text is stored as-is without formatting.',
    examples: [
      {
        id: 1,
        name: 'title',
        type: 'single-line-text',
        required: true,
        unique: false,
        indexed: true,
        default: 'Untitled',
      },
      {
        id: 2,
        name: 'first_name',
        type: 'single-line-text',
        required: true,
      },
    ],
  })
)

/** @public */
export type SingleLineTextField = Schema.Schema.Type<typeof SingleLineTextFieldSchema>
