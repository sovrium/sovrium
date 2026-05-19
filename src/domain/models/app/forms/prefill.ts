/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const PrefillSourceSchema = Schema.Union(
  Schema.String.pipe(
    Schema.pattern(/^\$(query|user|parent)\.[a-zA-Z_][a-zA-Z0-9_.]*$/, {
      message: () =>
        'Prefill source must be a literal value or a reference like $query.<name>, $user.<prop>, or $parent.<path>',
    })
  ),
  Schema.String,
  Schema.Number,
  Schema.Boolean
).annotations({
  identifier: 'PrefillSource',
  title: 'Prefill Source',
  description:
    'A literal default value or a $query.{name} / $user.{prop} / $parent.{path} reference',
})

export const PrefillSchema = Schema.Record({
  key: Schema.String,
  value: PrefillSourceSchema,
}).annotations({
  identifier: 'Prefill',
  title: 'Prefill Configuration',
  description:
    'Map of form field name → prefill source (literal or $query/$user/$parent reference)',
})

export type PrefillSource = Schema.Schema.Type<typeof PrefillSourceSchema>
export type Prefill = Schema.Schema.Type<typeof PrefillSchema>


export const InlinePrefillSchema = Schema.Struct({
  prefill: PrefillSchema,
  lockPrefill: Schema.optional(Schema.Boolean),
}).annotations({
  identifier: 'InlinePrefill',
  title: 'Inline Relationship Prefill',
  description:
    'Configures inline-form prefill from a parent record context. Used for "+ New child" patterns.',
})

export type InlinePrefill = Schema.Schema.Type<typeof InlinePrefillSchema>
