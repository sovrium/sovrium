/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MailpitEmail } from '../../email-utils'

/**
 * Extract a token/parameter from a URL found in email HTML content.
 *
 * @param html - The HTML content of the email
 * @param paramName - The URL parameter name to extract (e.g., 'token', 'code')
 * @returns The extracted token value, or null if not found
 *
 * @example
 * ```typescript
 * const html = '<a href="http://localhost:3000/verify?token=abc123">Verify</a>'
 * const token = extractTokenFromUrl(html, 'token')
 * // Returns: 'abc123'
 * ```
 */
export function extractTokenFromUrl(html: string, paramName: string): string | null {
  // Match URLs with the specified parameter
  const urlRegex = new RegExp(`href=["']([^"']*[?&]${paramName}=([^"'&]+)[^"']*)["']`, 'i')
  const match = html.match(urlRegex)

  if (match?.[2]) {
    return decodeURIComponent(match[2])
  }

  // Also try to find plain URLs (not in href)
  const plainUrlRegex = new RegExp(`[?&]${paramName}=([^\\s&"'<>]+)`, 'i')
  const plainMatch = html.match(plainUrlRegex)

  return plainMatch?.[1] ? decodeURIComponent(plainMatch[1]) : null
}

/**
 * Extract a verification/reset URL from email HTML content.
 *
 * @param html - The HTML content of the email
 * @param pathPattern - A regex pattern to match the URL path (e.g., /verify-email, /reset-password)
 * @returns The full URL, or null if not found
 *
 * @example
 * ```typescript
 * const html = '<a href="http://localhost:3000/api/auth/verify-email?token=abc123">Verify</a>'
 * const url = extractUrlFromEmail(html, /verify-email/)
 * // Returns: 'http://localhost:3000/api/auth/verify-email?token=abc123'
 * ```
 */
export function extractUrlFromEmail(html: string, pathPattern: RegExp): string | null {
  // Match href URLs containing the path pattern
  const urlRegex = /href=["']([^"']+)["']/gi
  let match

  while ((match = urlRegex.exec(html)) !== null) {
    const url = match[1]
    if (url && pathPattern.test(url)) {
      return url
    }
  }

  return null
}

/**
 * Extract an OTP (One-Time Password) code from email text content.
 * Looks for 6-digit numeric codes commonly used in 2FA.
 *
 * @param text - The text content of the email
 * @returns The extracted OTP code, or null if not found
 *
 * @example
 * ```typescript
 * const text = 'Your verification code is: 123456'
 * const otp = extractOtpCode(text)
 * // Returns: '123456'
 * ```
 */
export function extractOtpCode(text: string): string | null {
  // Match standalone 6-digit codes (common OTP format)
  const otpRegex = /\b(\d{6})\b/
  const match = text.match(otpRegex)
  return match?.[1] ?? null
}

/**
 * Extract backup codes from email text content.
 * Backup codes are typically alphanumeric codes used for account recovery.
 *
 * @param text - The text content of the email
 * @returns Array of backup codes found
 *
 * @example
 * ```typescript
 * const text = 'Your backup codes: ABC123, DEF456, GHI789'
 * const codes = extractBackupCodes(text)
 * // Returns: ['ABC123', 'DEF456', 'GHI789']
 * ```
 */
export function extractBackupCodes(text: string): string[] {
  // Match alphanumeric codes (typically 6-10 characters)
  const codeRegex = /\b([A-Z0-9]{6,10})\b/g
  const codes: string[] = []
  let match

  while ((match = codeRegex.exec(text)) !== null) {
    if (match[1]) {
      codes.push(match[1])
    }
  }

  return codes
}

/**
 * Assert that an email was received with expected properties.
 *
 * @param email - The Mailpit email to validate
 * @param expectations - Expected email properties
 * @throws Error if any expectation is not met
 *
 * @example
 * ```typescript
 * assertEmailReceived(email, {
 *   to: 'user@example.com',
 *   from: 'noreply@myapp.com',
 *   subjectContains: 'Verify your email'
 * })
 * ```
 */
export function assertEmailReceived(
  email: MailpitEmail,
  expectations: {
    to?: string
    from?: string
    subjectContains?: string
    subjectEquals?: string
    bodyContains?: string
  }
): void {
  if (expectations.to) {
    const toAddresses = email.To.map((t) => t.Address)
    if (!toAddresses.includes(expectations.to)) {
      throw new Error(
        `Expected email to be sent to "${expectations.to}", but was sent to: ${toAddresses.join(', ')}`
      )
    }
  }

  if (expectations.from) {
    if (email.From.Address !== expectations.from) {
      throw new Error(
        `Expected email from "${expectations.from}", but was from: ${email.From.Address}`
      )
    }
  }

  if (expectations.subjectContains) {
    if (!email.Subject.includes(expectations.subjectContains)) {
      throw new Error(
        `Expected email subject to contain "${expectations.subjectContains}", but subject was: ${email.Subject}`
      )
    }
  }

  if (expectations.subjectEquals) {
    if (email.Subject !== expectations.subjectEquals) {
      throw new Error(
        `Expected email subject to equal "${expectations.subjectEquals}", but subject was: ${email.Subject}`
      )
    }
  }

  if (expectations.bodyContains) {
    const body = email.HTML || email.Text
    if (!body.includes(expectations.bodyContains)) {
      throw new Error(
        `Expected email body to contain "${expectations.bodyContains}", but it was not found`
      )
    }
  }
}

/**
 * Wait for an email matching recipient and subject pattern.
 * Convenience wrapper around mailpit.waitForEmail.
 *
 * @param mailpit - The MailpitHelper instance
 * @param options - Email matching options
 * @returns The matching email
 *
 * @example
 * ```typescript
 * const email = await waitForEmailTo(mailpit, {
 *   to: 'user@example.com',
 *   subjectContains: 'Verify'
 * })
 * ```
 */
export async function waitForEmailTo(
  mailpit: { waitForEmail: (predicate: (email: MailpitEmail) => boolean) => Promise<MailpitEmail> },
  options: {
    to: string
    subjectContains?: string
  }
): Promise<MailpitEmail> {
  return mailpit.waitForEmail((email) => {
    const toMatch = email.To.some((t) => t.Address === options.to)
    const subjectMatch = options.subjectContains
      ? email.Subject.toLowerCase().includes(options.subjectContains.toLowerCase())
      : true
    return toMatch && subjectMatch
  })
}
