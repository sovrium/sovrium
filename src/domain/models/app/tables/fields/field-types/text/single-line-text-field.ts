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
    default: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Default value for this field when creating new records',
        })
      )
    ),
    writeOnly: WriteOnlyOptionSchema,
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
