/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Email template data types for Better Auth integration
 */
export interface PasswordResetEmailData {
  readonly userName?: string
  readonly resetUrl: string
  readonly expiresIn?: string
}

export interface EmailVerificationData {
  readonly userName?: string
  readonly verifyUrl: string
  readonly expiresIn?: string
}

export interface OrganizationInviteData {
  readonly inviterName?: string
  readonly organizationName: string
  readonly inviteUrl: string
  readonly role?: string
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
 * Base email layout wrapper
 *
 * Provides consistent styling for all email templates.
 */
function emailLayout(content: string): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sovrium</title>
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header"><div class="logo">Sovrium</div></div>
    ${content}
    <div class="footer">
      <p>&copy; ${year} ESSENTIAL SERVICES. All rights reserved.</p>
      <p>This email was sent by Sovrium. If you didn't request this, please ignore this email.</p>
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
 *   resetUrl: 'https://app.sovrium.com/reset-password?token=...',
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
  const expiry = data.expiresIn ?? '1 hour'

  const content = `
    <div class="content">
      <p>${greeting}</p>
      <p>We received a request to reset your password for your Sovrium account.</p>
      <p>Click the button below to reset your password:</p>
      <p style="text-align: center;">
        <a href="${data.resetUrl}" class="button">Reset Password</a>
      </p>
      <p class="link-fallback">
        If the button doesn't work, copy and paste this link into your browser:<br>
        ${data.resetUrl}
      </p>
      <div class="warning">
        This link will expire in ${expiry}. If you didn't request a password reset, you can safely ignore this email.
      </div>
    </div>
  `

  const text = `
${greeting}

We received a request to reset your password for your Sovrium account.

Reset your password by visiting this link:
${data.resetUrl}

This link will expire in ${expiry}.

If you didn't request a password reset, you can safely ignore this email.

---
© ${new Date().getFullYear()} ESSENTIAL SERVICES. All rights reserved.
`.trim()

  return {
    subject: 'Reset your Sovrium password',
    html: emailLayout(content),
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
 *   verifyUrl: 'https://app.sovrium.com/verify-email?token=...',
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
  const expiry = data.expiresIn ?? '24 hours'

  const content = `
    <div class="content">
      <p>${greeting}</p>
      <p>Welcome to Sovrium! Please verify your email address to complete your registration.</p>
      <p>Click the button below to verify your email:</p>
      <p style="text-align: center;">
        <a href="${data.verifyUrl}" class="button">Verify Email</a>
      </p>
      <p class="link-fallback">
        If the button doesn't work, copy and paste this link into your browser:<br>
        ${data.verifyUrl}
      </p>
      <div class="warning">
        This link will expire in ${expiry}. If you didn't create a Sovrium account, you can safely ignore this email.
      </div>
    </div>
  `

  const text = `
${greeting}

Welcome to Sovrium! Please verify your email address to complete your registration.

Verify your email by visiting this link:
${data.verifyUrl}

This link will expire in ${expiry}.

If you didn't create a Sovrium account, you can safely ignore this email.

---
© ${new Date().getFullYear()} ESSENTIAL SERVICES. All rights reserved.
`.trim()

  return {
    subject: 'Verify your Sovrium email address',
    html: emailLayout(content),
    text,
  }
}

/**
 * Organization invitation email template
 *
 * Used when inviting users to join an organization.
 *
 * @example
 * ```typescript
 * const { subject, html, text } = organizationInviteEmail({
 *   inviterName: 'Jane',
 *   organizationName: 'Acme Corp',
 *   inviteUrl: 'https://app.sovrium.com/invite?token=...',
 *   role: 'member',
 *   expiresIn: '7 days',
 * })
 * ```
 */
export function organizationInviteEmail(data: OrganizationInviteData): {
  readonly subject: string
  readonly html: string
  readonly text: string
} {
  const inviter = data.inviterName ? `${data.inviterName} has` : 'You have been'
  const role = data.role ? ` as a ${data.role}` : ''
  const expiry = data.expiresIn ?? '7 days'

  const content = `
    <div class="content">
      <p>Hi,</p>
      <p>${inviter} invited you to join <strong>${data.organizationName}</strong>${role} on Sovrium.</p>
      <p>Click the button below to accept the invitation:</p>
      <p style="text-align: center;">
        <a href="${data.inviteUrl}" class="button">Accept Invitation</a>
      </p>
      <p class="link-fallback">
        If the button doesn't work, copy and paste this link into your browser:<br>
        ${data.inviteUrl}
      </p>
      <div class="warning">
        This invitation will expire in ${expiry}. If you don't want to join this organization, you can safely ignore this email.
      </div>
    </div>
  `

  const text = `
Hi,

${inviter} invited you to join ${data.organizationName}${role} on Sovrium.

Accept the invitation by visiting this link:
${data.inviteUrl}

This invitation will expire in ${expiry}.

If you don't want to join this organization, you can safely ignore this email.

---
© ${new Date().getFullYear()} ESSENTIAL SERVICES. All rights reserved.
`.trim()

  return {
    subject: `You've been invited to join ${data.organizationName} on Sovrium`,
    html: emailLayout(content),
    text,
  }
}
