/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const HttpUrlSchema = Schema.String.pipe(
  Schema.pattern(/^https?:\/\//, {
    message: () => 'URL must start with http:// or https://',
  })
).annotations({
  title: 'HTTP URL',
  description: 'HTTP/HTTPS URL',
  format: 'uri',
})

export type HttpUrl = Schema.Schema.Type<typeof HttpUrlSchema>

export const HttpUrlOrRecordTemplateSchema = Schema.String.pipe(
  Schema.pattern(/^https?:\/\/|\$record\./, {
    message: () =>
      'URL must start with http:// or https://, or contain a $record.<field> substitution token',
  })
).annotations({
  title: 'HTTP URL or Record Template',
  description: 'HTTP/HTTPS URL or string containing $record.* substitution token',
  format: 'uri',
})

export type HttpUrlOrRecordTemplate = Schema.Schema.Type<typeof HttpUrlOrRecordTemplateSchema>
