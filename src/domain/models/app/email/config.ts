/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { EnvRefSchema } from '../common/env-ref'

export { EnvRefSchema }
export type { EnvRef } from '../common/env-ref'

/**
 * Email Address Schema
 *
 * Validates RFC 5322 compliant email addresses.
 */
export const EmailAddressSchema = Schema.String.pipe(
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  Schema.annotations({
    title: 'Email Address',
    description: 'Valid email address (RFC 5322)',
    examples: ['user@example.com', 'noreply@myapp.com', 'support@company.co.uk'],
  })
)

export type EmailAddress = Schema.Schema.Type<typeof EmailAddressSchema>

/**
 * Email Address with Name Schema
 *
 * Email address with optional display name.
 *
 * @example
 * ```typescript
 * // Simple address
 * 'noreply@example.com'
 *
 * // With name
 * { name: 'MyApp Support', address: 'support@example.com' }
 * ```
 */
export const EmailAddressWithNameSchema = Schema.Union(
  EmailAddressSchema,
  Schema.Struct({
    /** Display name */
    name: Schema.String,
    /** Email address */
    address: EmailAddressSchema,
  })
).pipe(
  Schema.annotations({
    title: 'Email Address with Name',
    description: 'Email address with optional display name',
    examples: ['noreply@example.com', { name: 'MyApp Support', address: 'support@example.com' }],
  })
)

export type EmailAddressWithName = Schema.Schema.Type<typeof EmailAddressWithNameSchema>

/**
 * SMTP Configuration Schema
 *
 * SMTP server settings for email delivery.
 * Full connection pooling, TLS details, and timeout settings
 * are infrastructure concerns handled by nodemailer.
 */
export const SmtpConfigSchema = Schema.Struct({
  /** SMTP server host */
  host: Schema.String,
  /** SMTP server port */
  port: Schema.Number.pipe(Schema.int(), Schema.between(1, 65_535)),
  /** Use secure connection (TLS) */
  secure: Schema.optional(Schema.Boolean),
  /** SMTP username (env var reference) */
  username: Schema.optional(EnvRefSchema),
  /** SMTP password (env var reference) */
  password: Schema.optional(EnvRefSchema),
}).pipe(
  Schema.annotations({
    title: 'SMTP Configuration',
    description: 'SMTP server settings for email delivery',
    examples: [
      { host: 'smtp.gmail.com', port: 587, secure: true },
      { host: 'smtp.sendgrid.net', port: 587, username: '$SMTP_USER', password: '$SMTP_PASS' },
    ],
  })
)

export type SmtpConfig = Schema.Schema.Type<typeof SmtpConfigSchema>

/**
 * Template Engine Schema
 *
 * Supported template engines for email rendering.
 */
export const TemplateEngineSchema = Schema.Literal('handlebars', 'ejs', 'pug', 'nunjucks').pipe(
  Schema.annotations({
    title: 'Template Engine',
    description: 'Template engine for email rendering',
  })
)

export type TemplateEngine = Schema.Schema.Type<typeof TemplateEngineSchema>

/**
 * Email Template Configuration Schema
 *
 * Simplified template settings focusing on WHAT templates to use,
 * not HOW to process them (that's infrastructure concern).
 */
export const EmailTemplateConfigSchema = Schema.Struct({
  /** Template engine to use */
  engine: TemplateEngineSchema,
  /** Directory containing email templates */
  templatesDir: Schema.String,
  /** File extension for templates (e.g., '.hbs', '.ejs') */
  extension: Schema.optional(Schema.String),
  /** Enable template caching in production */
  cache: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    title: 'Email Template Configuration',
    description: 'Template engine and directory settings',
    examples: [
      { engine: 'handlebars', templatesDir: './templates/emails' },
      {
        engine: 'ejs',
        templatesDir: './views/emails',
        extension: '.ejs',
        cache: true,
      },
    ],
  })
)

export type EmailTemplateConfig = Schema.Schema.Type<typeof EmailTemplateConfigSchema>

/**
 * Email Configuration Schema
 *
 * Simplified SMTP-only email configuration for the application.
 * Focuses on essential SMTP settings and sender information.
 *
 * Implementation details like connection pooling, retry logic,
 * rate limiting, and TLS certificates are infrastructure concerns
 * handled by the email service layer.
 *
 * @example
 * ```typescript
 * // Basic SMTP configuration
 * {
 *   from: 'noreply@myapp.com',
 *   fromName: 'MyApp',
 *   host: 'smtp.gmail.com',
 *   port: 587,
 *   secure: true,
 *   username: '$SMTP_USER',
 *   password: '$SMTP_PASS'
 * }
 *
 * // With optional features
 * {
 *   from: 'noreply@myapp.com',
 *   fromName: 'MyApp',
 *   replyTo: 'support@myapp.com',
 *   host: 'smtp.gmail.com',
 *   port: 587,
 *   secure: true,
 *   username: '$SMTP_USER',
 *   password: '$SMTP_PASS',
 *   templates: {
 *     engine: 'handlebars',
 *     templatesDir: './templates/emails'
 *   }
 * }
 * ```
 */
export const EmailConfigSchema = Schema.Struct({
  /** Sender email address */
  from: Schema.String.pipe(
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
    Schema.annotations({ description: 'Sender email address (e.g., noreply@myapp.com)' })
  ),
  /** Sender display name */
  fromName: Schema.optional(Schema.String),
  /** Reply-to email address */
  replyTo: Schema.optional(Schema.String),
  /** SMTP server host */
  host: Schema.String,
  /** SMTP server port */
  port: Schema.Number.pipe(Schema.int(), Schema.between(1, 65_535)),
  /** Use secure connection (TLS) */
  secure: Schema.optional(Schema.Boolean),
  /** SMTP username (env var reference) */
  username: Schema.optional(EnvRefSchema),
  /** SMTP password (env var reference) */
  password: Schema.optional(EnvRefSchema),
  /** Template engine configuration */
  templates: Schema.optional(EmailTemplateConfigSchema),
  /** Enable preview mode (logs emails instead of sending) */
  preview: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Preview mode - log emails instead of sending' })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Email Configuration',
    description: 'SMTP-based email delivery configuration for the application',
    examples: [
      // Basic SMTP
      {
        from: 'noreply@myapp.com',
        host: 'smtp.gmail.com',
        port: 587,
        secure: true,
      },
      // With authentication
      {
        from: 'noreply@myapp.com',
        fromName: 'MyApp',
        host: 'smtp.gmail.com',
        port: 587,
        secure: true,
        username: '$SMTP_USER',
        password: '$SMTP_PASS',
      },
      // With all options
      {
        from: 'noreply@myapp.com',
        fromName: 'MyApp',
        replyTo: 'support@myapp.com',
        host: 'smtp.gmail.com',
        port: 587,
        secure: true,
        username: '$SMTP_USER',
        password: '$SMTP_PASS',
        templates: { engine: 'handlebars', templatesDir: './templates/emails' },
        preview: false,
      },
    ],
  })
)

export type EmailConfig = Schema.Schema.Type<typeof EmailConfigSchema>

/**
 * Encoded type of EmailConfigSchema (what goes in before validation)
 */
export type EmailConfigEncoded = Schema.Schema.Encoded<typeof EmailConfigSchema>
