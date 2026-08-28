/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'

/**
 * Email (SMTP) environment configuration.
 *
 * Env vars: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_FROM_NAME
 */
export const EmailEnvSchema = Schema.Struct({
  smtpHost: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'SMTP server hostname (SMTP_HOST)',
        examples: ['smtp.gmail.com'],
      })
    )
  ),
  smtpPort: Schema.optional(
    Schema.FiniteFromString.pipe(
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(65_535)
      ),
      Schema.annotate({ description: 'SMTP server port (SMTP_PORT)', examples: [587] })
    )
  ),
  smtpSecure: Schema.optional(
    // EFFECT 4: `Schema.transform(from, to, {decode, encode})` ->
    // `from.pipe(Schema.decodeTo(to, {decode, encode}))` with each side a
    // `SchemaGetter` (migration/v3-to-v4.md:14284).
    Schema.String.pipe(
      Schema.decodeTo(Schema.Boolean, {
        decode: SchemaGetter.transform((s: string) => s === 'true'),
        encode: SchemaGetter.transform((b: boolean) => (b ? 'true' : 'false')),
      }),
      Schema.annotate({ description: 'Use TLS (SMTP_SECURE)' })
    )
  ),
  smtpUser: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'SMTP username (SMTP_USER)' }))
  ),
  smtpPass: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'SMTP password (SMTP_PASS)' }))
  ),
  smtpFrom: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Sender email address (SMTP_FROM)',
        examples: ['noreply@yourdomain.com'],
      })
    )
  ),
  smtpFromName: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Sender display name (SMTP_FROM_NAME)',
        examples: ['Your App Name'],
      })
    )
  ),
})
