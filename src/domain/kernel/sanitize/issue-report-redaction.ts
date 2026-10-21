/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { redactBoundQueryValues } from '@/domain/kernel/sanitize/bound-value-redaction'
import { redactEmail } from '@/domain/kernel/sanitize/email-redaction'
import { isSecretHeaderName } from '@/domain/kernel/sanitize/http-header-redaction'
import { redactConnectionUrl } from '@/domain/kernel/sanitize/redact-connection-url'

/** What a redacted value is replaced with (the logger's own marker). */
export const REDACTED_REPORT_VALUE = '[redacted]'

// The logger's attribute masker (`redactLogAttributes`,
// `src/infrastructure/logging/logger.ts`) masks by KEY on structured
// attributes; it lives in infrastructure, which domain cannot import, and it
// never scans free text. A report carries free text — a pasted log, a stack, a
// config excerpt — so the pass below scans text, composing the domain-side
// maskers that already exist (connection URLs, emails, bound query values,
// secret header names) and mirroring the logger's key and credential-scheme
// patterns for the rest.

/** Any URL with a scheme and an authority, where credentials could sit. */
const URL_IN_TEXT = /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s'"<>`]+/g

/** `Bearer …` / `Basic …` credentials, wherever they appear (the logger's CREDENTIAL_VALUE). */
const SCHEME_CREDENTIAL = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]+/gi

/** A whole `Cookie:` / `Set-Cookie:` header line: one value holds many pairs. */
const COOKIE_LINE = /^(\s*(?:set-)?cookie\s*:\s*).+$/gim

/** `key=value`, `key: value`, `"key": "value"` — the key is checked separately. */
const KEY_VALUE = /([A-Za-z0-9_.-]+)(["']?\s*[:=]\s*["']?)([^\s"',;&]+)/g

/** Key segments that name a credential, beyond the header markers. */
const SECRET_KEY_SEGMENT =
  /(?:^|[-_.])(?:key|auth(?:orization|entication|[-_]?token)?|passwd|pwd|credentials?|private[-_]?key|dsn|database[-_]?url)(?:$|[-_.])/i

/** A plain email address. */
const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

/**
 * A config's `$env.NAME` reference: it names a variable, not its value, so it
 * stays readable at a credential key (`token: $env.PAYMENTS_TOKEN`).
 */
const isEnvReference = (value: string): boolean => /^\$env\.[A-Za-z_][A-Za-z0-9_]*$/.test(value)

/** Whether a key's value is a credential, by its name alone. */
export const isSecretKeyName = (name: string): boolean =>
  isSecretHeaderName(name) || SECRET_KEY_SEGMENT.test(name)

/**
 * `text` with every credential, connection string and email address masked.
 *
 * Applied to every value a report link carries, because the link lands in a
 * PUBLIC issue: once submitted, a token in it is no longer the operator's to
 * revoke quietly.
 */
export const redactIssueReportText = (text: string): string =>
  redactBoundQueryValues(text)
    .replace(URL_IN_TEXT, (url) => redactConnectionUrl(url))
    .replace(SCHEME_CREDENTIAL, (_match, scheme: string) => `${scheme} ${REDACTED_REPORT_VALUE}`)
    .replace(COOKIE_LINE, (_match, head: string) => `${head}${REDACTED_REPORT_VALUE}`)
    .replace(KEY_VALUE, (match, key: string, separator: string, value: string) =>
      isSecretKeyName(key) && !isEnvReference(value)
        ? `${key}${separator}${REDACTED_REPORT_VALUE}`
        : match
    )
    .replace(EMAIL_IN_TEXT, (email) => redactEmail(email))
