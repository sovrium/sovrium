/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, SchemaGetter } from 'effect'

/**
 * The transports outgoing email can leave through. SMTP is the default and
 * stays the only one that needs no vendor account; the three others are the
 * HTTP APIs of Brevo, Resend and Amazon SES (API v2), selected with
 * `EMAIL_PROVIDER`.
 */
export const EMAIL_PROVIDERS = ['smtp', 'brevo', 'resend', 'ses'] as const

/**
 * Email environment configuration.
 *
 * Env vars: EMAIL_PROVIDER, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER,
 * SMTP_PASS, SMTP_FROM, SMTP_FROM_NAME, BREVO_API_KEY, RESEND_API_KEY,
 * EMAIL_SES_REGION, EMAIL_SES_ACCESS_KEY_ID, EMAIL_SES_SECRET_ACCESS_KEY,
 * EMAIL_API_URL.
 *
 * The sender (`SMTP_FROM`, `SMTP_FROM_NAME`) is shared by every transport, so
 * switching transport never changes who mail comes from.
 */
export const EmailEnvSchema = Schema.Struct({
  emailProvider: Schema.optional(
    Schema.Literals(EMAIL_PROVIDERS).pipe(
      Schema.annotate({
        defaultNote: 'smtp',
        description:
          'The transport outgoing email leaves through (EMAIL_PROVIDER): smtp, or the HTTP API of brevo, resend or ses. Any other value refuses to start the server.',
        examples: ['brevo'],
      })
    )
  ),
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
        description:
          "Sender display name (SMTP_FROM_NAME). When unset, the sending app's `name` is used, then 'Sovrium' for an engine with no app name.",
        examples: ['Your App Name'],
      })
    )
  ),
  brevoApiKey: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Brevo API key (BREVO_API_KEY), sent in the api-key header. Required when EMAIL_PROVIDER is brevo.',
      })
    )
  ),
  resendApiKey: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Resend API key (RESEND_API_KEY), sent as a bearer token. Required when EMAIL_PROVIDER is resend.',
      })
    )
  ),
  sesRegion: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'AWS region of the Amazon SES account (EMAIL_SES_REGION). Required when EMAIL_PROVIDER is ses.',
        examples: ['eu-west-3'],
      })
    )
  ),
  sesAccessKeyId: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Access key id of the IAM credentials that sign SES requests (EMAIL_SES_ACCESS_KEY_ID). Required when EMAIL_PROVIDER is ses.',
      })
    )
  ),
  sesSecretAccessKey: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Secret access key of the IAM credentials that sign SES requests (EMAIL_SES_SECRET_ACCESS_KEY). Required when EMAIL_PROVIDER is ses.',
      })
    )
  ),
  emailApiUrl: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote:
          "the provider's own address: https://api.brevo.com/v3, https://api.resend.com, or https://email.<EMAIL_SES_REGION>.amazonaws.com",
        description:
          'Base address of the selected HTTP transport (EMAIL_API_URL), for a regional endpoint or a relay in front of the provider. Ignored for smtp.',
        examples: ['https://email.eu-west-3.amazonaws.com'],
      })
    )
  ),
})
