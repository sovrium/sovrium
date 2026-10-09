/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Redaction of credential-bearing HTTP headers, for every surface that reflects
 * a captured request back to an operator.
 *
 * Two such surfaces exist and BOTH leaked. The webhook delivery log stores the
 * headers it sent, and `buildAuthHeaders` puts the webhook's resolved plaintext
 * secret there — `Authorization: Bearer sk_live_…`, or an HMAC signature. The
 * automation run log stores `triggerData`, which for a webhook trigger captures
 * every INBOUND request header, including the caller's own credential. Neither
 * reflection scrubbed anything, and each would otherwise have grown its own
 * marker list.
 *
 * WHY BY NAME AND NOT BY VALUE
 * ----------------------------
 * `redact-secrets.ts` scrubs by VALUE: it knows the resolved env-var strings and
 * removes their occurrences. That is the right tool when the secret came from
 * `app.env`, and the wrong one here — a webhook signature is COMPUTED at send
 * time and an inbound caller's bearer token was never in the config at all, so
 * neither appears in any value list. A name-based rule catches both, and catches
 * the next one nobody enumerated.
 *
 * WHY THE NAME SURVIVES
 * ---------------------
 * Only the VALUE is replaced. An operator debugging a 401 needs to know the
 * header was sent, and a header name is not a credential. Dropping the key
 * entirely would make "sent an empty Authorization" and "sent none"
 * indistinguishable, which is the question the log exists to answer.
 */

/**
 * Header-name substrings that mark the value as a credential.
 *
 * Matched case-insensitively as a SUBSTRING, so `X-Hub-Signature-256`,
 * `X-Webhook-Signature`, `Proxy-Authorization` and a bespoke `X-Acme-Api-Token`
 * are all covered without an exhaustive list — the exhaustive list being the
 * thing that goes stale the first time somebody adds a header.
 */
const SECRET_HEADER_MARKERS: readonly string[] = [
  'authorization',
  'cookie',
  'signature',
  'secret',
  'token',
  'api-key',
  'apikey',
  'password',
]

/** The placeholder every redacted value carries, matching the config reflector. */
export const REDACTED_HEADER_VALUE = '***'

/** True when a header's VALUE must not be reflected. */
export const isSecretHeaderName = (name: string): boolean => {
  const lower = name.toLowerCase()
  return SECRET_HEADER_MARKERS.some((marker) => lower.includes(marker))
}

/** A case-insensitive membership test over `names`. */
const isNamedIn = (names: readonly string[]): ((name: string) => boolean) => {
  const named = new Set(names.map((name) => name.toLowerCase()))
  return (name) => named.has(name.toLowerCase())
}

/** Replace the value of every entry whose name `isCredential` accepts, keeping key order. */
const redactEntriesWhere = <V>(
  headers: Readonly<Record<string, V>>,
  isCredential: (name: string) => boolean
): Readonly<Record<string, V | typeof REDACTED_HEADER_VALUE>> =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) =>
      isCredential(name) ? [name, REDACTED_HEADER_VALUE] : [name, value]
    )
  )

/**
 * Replace the value of every credential-bearing header, preserving key order
 * and every other entry.
 *
 * Non-object input (a `null` column, a JSON string that never parsed, an array)
 * is returned unchanged: this is a reflection helper, not a validator, and
 * inventing a shape would hide a storage bug rather than fix it.
 */
export const redactSecretHeaders = (headers: unknown): unknown => {
  if (headers === null || typeof headers !== 'object' || Array.isArray(headers)) return headers
  return redactEntriesWhere(headers as Readonly<Record<string, unknown>>, isSecretHeaderName)
}

/**
 * Replace the value of every header NAMED in `names` (compared
 * case-insensitively), whatever the name is, preserving key order and every
 * other entry.
 *
 * This is the rule for a header set Sovrium itself built: the caller knows
 * which entries carry a credential because it produced them, so no name list
 * is consulted — a key sent under `X-Partner-Access` is redacted like an
 * `Authorization`.
 */
export const redactHeadersNamed = (
  headers: Readonly<Record<string, string>>,
  names: readonly string[]
): Readonly<Record<string, string>> => redactEntriesWhere(headers, isNamedIn(names))

/**
 * The headers that carry the caller's own credential whatever the request is
 * for: a session cookie, a cookie being set, and the two authorization headers.
 */
export const CREDENTIAL_HEADER_NAMES: readonly string[] = [
  'cookie',
  'set-cookie',
  'authorization',
  'proxy-authorization',
]

/**
 * Both rules at once: every header in {@link CREDENTIAL_HEADER_NAMES} or in
 * `namedHeaders`, and every header {@link isSecretHeaderName} matches.
 *
 * This is the rule for a request Sovrium RECEIVED and keeps: the name rule
 * cannot know that a sender's key travels under `X-Partner-Access`, so the
 * caller passes the header names its own configuration designates.
 */
export const redactCredentialHeaders = <V>(
  headers: Readonly<Record<string, V>>,
  namedHeaders: readonly string[]
): Readonly<Record<string, V | typeof REDACTED_HEADER_VALUE>> => {
  const named = isNamedIn([...CREDENTIAL_HEADER_NAMES, ...namedHeaders])
  return redactEntriesWhere(headers, (name) => named(name) || isSecretHeaderName(name))
}

/**
 * Redact the `headers` sub-object of a captured trigger payload.
 *
 * An automation's `triggerData` is `{ headers?, body?, query?, … }` — the shape
 * `webhook-handler.ts` builds. Only `headers` is rewritten: the BODY is the
 * automation's actual input and an operator inspecting a failed run needs it,
 * while a name-based rule has nothing to say about arbitrary body keys.
 *
 * `namedHeaders` are the headers the trigger's own configuration designates as
 * its credential (see {@link redactCredentialHeaders}); a run recorded since
 * that redaction moved to record time already carries the marker, and a second
 * pass over a marker is a no-op.
 */
export const redactTriggerDataHeaders = (
  triggerData: unknown,
  namedHeaders: readonly string[] = []
): unknown => {
  if (triggerData === null || typeof triggerData !== 'object' || Array.isArray(triggerData)) {
    return triggerData
  }
  const record = triggerData as Record<string, unknown>
  if (!('headers' in record)) return triggerData
  const { headers } = record
  if (headers === null || typeof headers !== 'object' || Array.isArray(headers)) return triggerData
  return {
    ...record,
    headers: redactCredentialHeaders(headers as Readonly<Record<string, unknown>>, namedHeaders),
  }
}
