/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The secret fields of an automation trigger, replaced before the trigger is
 * listed by `GET /api/automations`.
 *
 * Every member reads that listing, so a secret written as a literal in the
 * config must not travel in it. Each field is replaced whether it holds a
 * literal or a `$env.X` reference: the listing never needs either. The fields
 * are the webhook's `auth.{token,key,secret,password,username}`, the
 * verification handshake's `verification.verifyToken`, and a signing `secret`
 * written at the top of the trigger.
 */

const REDACTED = '[redacted]'

const AUTH_SECRET_FIELDS = ['token', 'key', 'secret', 'password', 'username'] as const

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined

const redactFields = (
  source: Readonly<Record<string, unknown>>,
  fields: readonly string[]
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(source).map(([field, value]) => [
      field,
      fields.includes(field) && value !== undefined ? REDACTED : value,
    ])
  )

/** The trigger as the listing shows it: every secret field replaced by `[redacted]`. */
export const redactTriggerSecrets = (
  trigger: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  const auth = asRecord(trigger['auth'])
  const verification = asRecord(trigger['verification'])
  return {
    ...redactFields(trigger, ['secret']),
    ...(auth === undefined ? {} : { auth: redactFields(auth, AUTH_SECRET_FIELDS) }),
    ...(verification === undefined
      ? {}
      : { verification: redactFields(verification, ['verifyToken']) }),
  }
}
