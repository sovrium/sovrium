/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtml } from '@/domain/kernel/markdown/markdown-renderer'

/**
 * Email template data types for Better Auth integration
 */
export interface PasswordResetEmailData {
  /** The operator's app name, printed as the email header. */
  readonly appName?: string
  readonly userName?: string
  readonly resetUrl: string
  readonly expiresIn?: string
}

export interface EmailVerificationData {
  /** The operator's app name, printed as the email header. */
  readonly appName?: string
  readonly userName?: string
  readonly verifyUrl: string
  readonly expiresIn?: string
}

/**
 * Email CSS styles
 */
const EMAIL_STYLES = `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: #f5f5f5;
}
.container {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 40px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.header {
  text-align: center;
  margin-bottom: 30px;
}
.logo {
  font-size: 28px;
  font-weight: bold;
  color: #1a1a1a;
}
.content {
  margin-bottom: 30px;
}
.content li {
  margin-bottom: 4px;
}
.button {
  display: inline-block;
  background-color: #0066cc;
  color: #ffffff !important;
  text-decoration: none;
  padding: 14px 28px;
  border-radius: 6px;
  font-weight: 600;
  margin: 20px 0;
}
.button:hover {
  background-color: #0052a3;
}
.footer {
  text-align: center;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  color: #666;
  font-size: 12px;
}
.link-fallback {
  word-break: break-all;
  color: #666;
  font-size: 12px;
  margin-top: 15px;
}
.warning {
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  padding: 12px;
  margin-top: 20px;
  font-size: 13px;
  color: #856404;
}
`

/**
 * The brand an email is headed with when the sending app's name is unknown —
 * a bare engine with no config. Any app that declares a `name` sends under it:
 * an operator's app never mails its users as "Sovrium".
 */
const FALLBACK_EMAIL_BRAND = 'Sovrium'

/** The name an email speaks under: the app's own, or the fallback when it is unknown. */
export const resolveBrand = (appName: string | undefined): string =>
  appName !== undefined && appName.trim() !== '' ? appName : FALLBACK_EMAIL_BRAND

/**
 * The footer line that differs between an email a person asked for (a reset,
 * a verification) and one the instance sends on its own (an operator alert).
 */
const requestedEmailNotice = (brand: string): string =>
  `<p>This email was sent by ${escapeHtml(brand)}. If you didn't request this, please ignore this email.</p>`

/** What {@link emailLayout} frames its content with. */
export interface EmailLayoutOptions {
  /** The sending app's name; heads the email. Falls back to "Sovrium". */
  readonly appName?: string
  /**
   * Replaces the "if you didn't request this" line. Inserted VERBATIM, so a
   * caller passing anything derived from data must escape it first.
   */
  readonly footerHtml?: string
}

/**
 * Base email layout wrapper
 *
 * Provides consistent styling for all email templates. The header is the
 * sending app's name. There is deliberately no copyright line: the email is
 * the operator's, not the engine vendor's.
 */
export function emailLayout(content: string, options: EmailLayoutOptions = {}): string {
  const brand = escapeHtml(resolveBrand(options.appName))
  const footerHtml = options.footerHtml ?? requestedEmailNotice(resolveBrand(options.appName))
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brand}</title>
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header"><div class="logo">${brand}</div></div>
    ${content}
    <div class="footer">
      ${footerHtml}
    </div>
  </div>
</body>
</html>`
}

/**
 * Password reset email template
 *
 * Used by Better Auth's sendResetPassword callback.
 *
 * @example
 * ```typescript
 * const { subject, html, text } = passwordResetEmail({
 *   userName: 'John',
 * resetUrl: '[internal ref]',
 *   expiresIn: '1 hour',
 * })
 * ```
 */
export function passwordResetEmail(data: PasswordResetEmailData): {
  readonly subject: string
  readonly html: string
  readonly text: string
} {
  const greeting = data.userName ? `Hi ${data.userName},` : 'Hi,'
  const htmlGreeting = data.userName ? `Hi ${escapeHtml(data.userName)},` : 'Hi,'
  const expiry = data.expiresIn ?? '1 hour'
  const brand = resolveBrand(data.appName)
  const htmlBrand = escapeHtml(brand)

  const content = `
    <div class="content">
      <p>${htmlGreeting}</p>
      <p>We received a request to reset your password for your ${htmlBrand} account.</p>
      <p>Click the button below to reset your password:</p>
      <p style="text-align: center;">
        <a href="${escapeHtml(data.resetUrl)}" class="button">Reset Password</a>
      </p>
      <p class="link-fallback">
        If the button doesn't work, copy and paste this link into your browser:<br>
        ${escapeHtml(data.resetUrl)}
      </p>
      <div class="warning">
        This link will expire in ${expiry}. If you didn't request a password reset, you can safely ignore this email.
      </div>
    </div>
  `

  const text = `
${greeting}

We received a request to reset your password for your ${brand} account.

Reset your password by visiting this link:
${data.resetUrl}

This link will expire in ${expiry}.

If you didn't request a password reset, you can safely ignore this email.
`.trim()

  return {
    subject: `Reset your ${brand} password`,
    html: emailLayout(content, { appName: data.appName }),
    text,
  }
}

/**
 * Email verification template
 *
 * Used by Better Auth's sendVerificationEmail callback.
 *
 * @example
 * ```typescript
 * const { subject, html, text } = emailVerificationEmail({
 *   userName: 'John',
 * verifyUrl: '[internal ref]',
 *   expiresIn: '24 hours',
 * })
 * ```
 */
export function emailVerificationEmail(data: EmailVerificationData): {
  readonly subject: string
  readonly html: string
  readonly text: string
} {
  const greeting = data.userName ? `Hi ${data.userName},` : 'Hi,'
  const htmlGreeting = data.userName ? `Hi ${escapeHtml(data.userName)},` : 'Hi,'
  const expiry = data.expiresIn ?? '24 hours'
  const brand = resolveBrand(data.appName)
  const htmlBrand = escapeHtml(brand)

  const content = `
    <div class="content">
      <p>${htmlGreeting}</p>
      <p>Welcome to ${htmlBrand}! Please verify your email address to complete your registration.</p>
      <p>Click the button below to verify your email:</p>
      <p style="text-align: center;">
        <a href="${escapeHtml(data.verifyUrl)}" class="button">Verify Email</a>
      </p>
      <p class="link-fallback">
        If the button doesn't work, copy and paste this link into your browser:<br>
        ${escapeHtml(data.verifyUrl)}
      </p>
      <div class="warning">
        This link will expire in ${expiry}. If you didn't create an account with ${htmlBrand}, you can safely ignore this email.
      </div>
    </div>
  `

  const text = `
${greeting}

Welcome to ${brand}! Please verify your email address to complete your registration.

Verify your email by visiting this link:
${data.verifyUrl}

This link will expire in ${expiry}.

If you didn't create an account with ${brand}, you can safely ignore this email.
`.trim()

  return {
    subject: `Verify your ${brand} email address`,
    html: emailLayout(content, { appName: data.appName }),
    text,
  }
}
