/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Email Configuration Domain Models
 *
 * Simplified SMTP-only email configuration for the application.
 * Focuses on essential SMTP settings for email delivery.
 *
 * Structure:
 * - config: SMTP connection settings, sender defaults, and template configuration
 *
 * Features:
 * - SMTP server configuration (host, port, secure)
 * - Environment variable references for credentials ($VAR_NAME syntax)
 * - Sender addresses with display names
 * - Reply-to address support
 * - Template engine support (Handlebars, EJS, Pug, Nunjucks)
 * - Preview mode for development (logs instead of sending)
 *
 * Implementation Details:
 * - Connection pooling, retry logic, rate limiting are infrastructure concerns
 * - Handled by the email service layer, not domain configuration
 *
 * @example
 * ```typescript
 * // Basic SMTP configuration
 * const emailConfig: EmailConfig = {
 *   from: 'noreply@myapp.com',
 *   fromName: 'MyApp',
 *   host: 'smtp.gmail.com',
 *   port: 587,
 *   secure: true,
 *   username: '$SMTP_USER',
 *   password: '$SMTP_PASS'
 * }
 *
 * // With templates and reply-to
 * const fullConfig: EmailConfig = {
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

// Re-export all email-related schemas and types
export * from './config'
