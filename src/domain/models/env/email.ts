/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Email (SMTP) environment configuration.
 *
 * Env vars: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_FROM_NAME
 */
export const EmailEnvSchema = Schema.Struct({
  smtpHost: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'SMTP server hostname (SMTP_HOST)',
        examples: ['smtp.gmail.com'],
      })
    )
  ),
  smtpPort: Schema.optional(
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(65_535),
      Schema.annotations({ description: 'SMTP server port (SMTP_PORT)', examples: [587] })
    )
  ),
  smtpSecure: Schema.optional(
    Schema.transform(Schema.String, Schema.Boolean, {
      decode: (s) => s === 'true',
      encode: (b) => (b ? 'true' : 'false'),
    }).pipe(Schema.annotations({ description: 'Use TLS (SMTP_SECURE)' }))
  ),
  smtpUser: Schema.optional(
    Schema.String.pipe(Schema.annotations({ description: 'SMTP username (SMTP_USER)' }))
  ),
  smtpPass: Schema.optional(
    Schema.String.pipe(Schema.annotations({ description: 'SMTP password (SMTP_PASS)' }))
  ),
  smtpFrom: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Sender email address (SMTP_FROM)',
        examples: ['noreply@yourdomain.com'],
      })
    )
  ),
  smtpFromName: Schema.optional(
    Schema.String.pipe(
      Schema.annotations({
        description: 'Sender display name (SMTP_FROM_NAME)',
        examples: ['Your App Name'],
      })
    )
  ),
})

export type EmailEnvConfig = Schema.Schema.Type<typeof EmailEnvSchema>

/** @public */
export const parseEmailEnvConfig = (): EmailEnvConfig =>
  Schema.decodeUnknownSync(EmailEnvSchema)({
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpSecure: process.env.SMTP_SECURE,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    smtpFrom: process.env.SMTP_FROM,
    smtpFromName: process.env.SMTP_FROM_NAME,
  })
