/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentPropsSchema } from '../../components/props'

export const ComponentI18nSchema = Schema.Record({
  key: Schema.String.pipe(
    Schema.pattern(/^[a-z]{2}(-[A-Z]{2})?$/, {
      message: () => 'Language code must be ISO 639-1 format (e.g., en-US, fr-FR)',
    })
  ),
  value: Schema.Struct({
    content: Schema.optional(
      Schema.String.annotations({
        description: 'Translated content text',
      })
    ),
    props: Schema.optional(ComponentPropsSchema),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'ComponentI18n',
    title: 'Component I18n',
    description: 'Localized translations per language for this component',
  })
)

export type ComponentI18n = Schema.Schema.Type<typeof ComponentI18nSchema>
