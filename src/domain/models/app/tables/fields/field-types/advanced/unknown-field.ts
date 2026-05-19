/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from '../base-field'

export const KNOWN_FIELD_TYPES = [
  'ai-categorize',
  'ai-extract',
  'ai-generate',
  'ai-sentiment',
  'ai-summary',
  'ai-tag',
  'ai-translate',
  'array',
  'autonumber',
  'barcode',
  'button',
  'checkbox',
  'color',
  'count',
  'created-at',
  'created-by',
  'currency',
  'date',
  'datetime',
  'decimal',
  'deleted-at',
  'duration',
  'email',
  'formula',
  'geolocation',
  'integer',
  'json',
  'long-text',
  'lookup',
  'multi-select',
  'multiple-attachments',
  'percentage',
  'phone-number',
  'progress',
  'rating',
  'relationship',
  'rich-text',
  'rollup',
  'single-attachment',
  'single-line-text',
  'single-select',
  'status',
  'time',
  'updated-at',
  'updated-by',
  'url',
  'user',
] as const

export const UnknownFieldSchema = Schema.Struct({
  ...BaseFieldSchema.fields,
  type: Schema.String.pipe(
    Schema.filter((t) => !KNOWN_FIELD_TYPES.includes(t as (typeof KNOWN_FIELD_TYPES)[number]), {
      message: () => 'Type must be an unknown field type (not a recognized field type)',
    })
  ),
})

export type UnknownField = Schema.Schema.Type<typeof UnknownFieldSchema>
