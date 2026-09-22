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

/**
 * Whether outgoing email is configured for this process.
 *
 * `SMTP_HOST` is the single switch: set means "send", unset means "log and
 * carry on" — there is no localhost fallback transport in the runtime, so the
 * presence of the host IS the configuration.
 *
 * Pure, and it lives HERE rather than beside the transport for a layering
 * reason found in W5b of the layout programme. The predicate has a reader on
 * the HTTP surface — the mounted-app guard that hides a mail-gated public path
 * when no mail can be sent — and reaching `infrastructure/email/` for it would
 * have put `sendEmail` and a live nodemailer transport in a route's import
 * graph to answer a question about an environment variable. A predicate over a
 * string bag is a domain fact; delivering a message is not.
 */
export const hasSmtpHost = (env: Readonly<Record<string, string | undefined>>): boolean =>
  Boolean(env['SMTP_HOST'])
