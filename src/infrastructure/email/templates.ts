/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeHtml } from '@/domain/kernel/markdown/markdown-renderer'
import { ENGLISH_WORDS, expiryIn, greetingsOf, type EmailWords } from './email-words'

/**
 * Email template data types for Better Auth integration
 */
export interface PasswordResetEmailData {
  /** The operator's app name, printed as the email header. */
  readonly appName?: string
  readonly userName?: string
  readonly resetUrl: string
  readonly expiresIn?: string
  /** The reader's language; English when absent. */
  readonly words?: EmailWords
}

export interface EmailVerificationData {
  /** The operator's app name, printed as the email header. */
  readonly appName?: string
  readonly userName?: string
  readonly verifyUrl: string
  readonly expiresIn?: string
  /** The reader's language; English when absent. */
  readonly words?: EmailWords
}

/** What the confirmation-link email for an immediate account deletion is built from. */
export interface AccountDeletionEmailData {
  /** The operator's app name, printed as the email header. */
  readonly appName?: string
  readonly userName?: string
  readonly confirmUrl: string
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
const requestedEmailNotice = (brand: string, words: EmailWords): string =>
  `<p>${words.t('requestedNotice', { app: escapeHtml(brand) })}</p>`

/** What {@link emailLayout} frames its content with. */
export interface EmailLayoutOptions {
  /** The sending app's name; heads the email. Falls back to "Sovrium". */
  readonly appName?: string
  /**
   * Replaces the "if you didn't request this" line. Inserted VERBATIM, so a
   * caller passing anything derived from data must escape it first.
   */
  readonly footerHtml?: string
  /** The reader's language, for `<html lang>` and the footer; English when absent. */
  readonly words?: EmailWords
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
  const words = options.words ?? ENGLISH_WORDS
  const footerHtml =
    options.footerHtml ?? requestedEmailNotice(resolveBrand(options.appName), words)
  return `<!DOCTYPE html>
<html lang="${escapeHtml(words.lang)}">
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
  const words = data.words ?? ENGLISH_WORDS
  const greeting = greetingsOf(words, data.userName)
  const expires = words.t('linkExpires', { expiry: expiryIn(words, data.expiresIn ?? '1 hour') })
  const brand = resolveBrand(data.appName)
  const htmlBrand = escapeHtml(brand)

  const content = `
    <div class="content">
      <p>${greeting.html}</p>
      <p>${words.t('resetPassword.intro', { app: htmlBrand })}</p>
      <p>${words.t('resetPassword.cta')}</p>
      <p style="text-align: center;">
        <a href="${escapeHtml(data.resetUrl)}" class="button">${words.t('resetPassword.button')}</a>
      </p>
      <p class="link-fallback">
        ${words.t('linkFallback')}<br>
        ${escapeHtml(data.resetUrl)}
      </p>
      <div class="warning">
        ${expires} ${words.t('resetPassword.ignore')}
      </div>
    </div>
  `

  const text = `
${greeting.text}

${words.t('resetPassword.intro', { app: brand })}

${words.t('resetPassword.textCta')}
${data.resetUrl}

${expires}

${words.t('resetPassword.ignore')}
`.trim()

  return {
    subject: words.t('resetPassword.subject', { app: brand }),
    html: emailLayout(content, { appName: data.appName, words }),
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
  const words = data.words ?? ENGLISH_WORDS
  const greeting = greetingsOf(words, data.userName)
  const expires = words.t('linkExpires', { expiry: expiryIn(words, data.expiresIn ?? '24 hours') })
  const brand = resolveBrand(data.appName)
  const htmlBrand = escapeHtml(brand)

  const content = `
    <div class="content">
      <p>${greeting.html}</p>
      <p>${words.t('verification.intro', { app: htmlBrand })}</p>
      <p>${words.t('verification.cta')}</p>
      <p style="text-align: center;">
        <a href="${escapeHtml(data.verifyUrl)}" class="button">${words.t('verification.button')}</a>
      </p>
      <p class="link-fallback">
        ${words.t('linkFallback')}<br>
        ${escapeHtml(data.verifyUrl)}
      </p>
      <div class="warning">
        ${expires} ${words.t('verification.ignore', { app: htmlBrand })}
      </div>
    </div>
  `

  const text = `
${greeting.text}

${words.t('verification.intro', { app: brand })}

${words.t('verification.textCta')}
${data.verifyUrl}

${expires}

${words.t('verification.ignore', { app: brand })}
`.trim()

  return {
    subject: words.t('verification.subject', { app: brand }),
    html: emailLayout(content, { appName: data.appName, words }),
    text,
  }
}

/**
 * The confirmation-link email for an immediate account deletion.
 *
 * Sent by Better Auth's `sendDeleteAccountVerification` when a signed-in person
 * asks to delete their account; following the link, signed in as that account,
 * erases it for good. The subject names the deletion, so the person can tell
 * this mail from every other one the app sends.
 */
export function accountDeletionEmail(data: AccountDeletionEmailData): {
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
      <p>We received a request to delete your ${htmlBrand} account.</p>
      <p>Following the link below erases your account and everything in it, for good. This cannot be undone.</p>
      <p style="text-align: center;">
        <a href="${escapeHtml(data.confirmUrl)}" class="button">Delete my account</a>
      </p>
      <p class="link-fallback">
        If the button doesn't work, copy and paste this link into your browser:<br>
        ${escapeHtml(data.confirmUrl)}
      </p>
      <div class="warning">
        This link will expire in ${expiry} and works only while you are signed in to this account. If you didn't ask to delete your account, ignore this email: nothing changes.
      </div>
    </div>
  `

  const text = `
${greeting}

We received a request to delete your ${brand} account.

Following this link erases your account and everything in it, for good. This cannot be undone:
${data.confirmUrl}

This link will expire in ${expiry} and works only while you are signed in to this account.

If you didn't ask to delete your account, ignore this email: nothing changes.
`.trim()

  return {
    subject: `Confirm the deletion of your ${brand} account`,
    html: emailLayout(content, { appName: data.appName }),
    text,
  }
}
