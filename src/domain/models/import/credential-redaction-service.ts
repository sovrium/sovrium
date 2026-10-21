/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Credentials a migrated automation must never carry into the config.
 *
 * An automation definition is written by people, and people paste secrets
 * into it: an `Authorization` header on an HTTP step, a password in a basic-auth
 * module, an API key in a query parameter. The config the import writes is
 * usually committed, and a step it cannot map is quoted there — as a comment of
 * a stub, and in the report — so every quote goes through
 * {@link quoteOriginal}, which keeps the step readable and leaves its
 * credentials out.
 *
 * - **By name.** A header, a parameter or a key whose NAME says it holds a
 *   credential ({@link isCredentialName}) has its value replaced.
 * - **By value.** A `Bearer …` or `Basic …` value is replaced wherever it sits,
 *   and a URL that is itself a credential keeps only its host.
 * - **Expressions** are quoted as the source wrote them (`{{1.email}}`), not as
 *   the token list the mapper reads them through.
 */

import { isRecord, type Raw } from '@/domain/kernel/config-parsing/plain-object'
import { capabilityOf } from './capability-url-service'

/** What a credential is replaced with in a quote. */
export const REDACTED = '[credential removed]'

/**
 * A NAME — of a header, a query parameter, an input — whose value is a
 * credential: `Authorization`, `Cookie`, `X-API-Key`, `X-Auth-Token`,
 * `Private-Token`, `authPass`, `client_secret`, `access_token`, `password`.
 */
const CREDENTIAL_NAME =
  /^(?:authorization|proxy-authorization|cookie)$|api[-_]?key|token|secret|passw(?:or)?d|^(?:auth[-_]?)?pass$|signature|^x-auth/i

/** Whether a header, parameter or key name says its value is a credential. */
export const isCredentialName = (name: string): boolean => CREDENTIAL_NAME.test(name.trim())

/** A value that carries its own scheme of credential: `Bearer …`, `Basic …`, `Token …`. */
const SCHEMED_CREDENTIAL = /^\s*(?:bearer|basic|token)\s+\S/i

/** A string under `key`, its credential replaced. */
const redactText = (key: string, text: string): string => {
  if (text === '') return text
  if (isCredentialName(key) || SCHEMED_CREDENTIAL.test(text)) return REDACTED
  const url = capabilityOf(text) === undefined ? undefined : URL.parse(text.trim())
  return url === undefined || url === null ? text : `${url.protocol}//${url.host}/${REDACTED}`
}

/** A tokenised expression of the canonical model, by its shape. */
const expressionSourceOf = (value: unknown): string | undefined =>
  isRecord(value) && value['kind'] === 'expression' && typeof value['source'] === 'string'
    ? value['source']
    : undefined

/** A `{ name, value }` pair (an n8n or Make header list) whose name says it is a credential. */
const isCredentialPair = (value: Raw): boolean =>
  typeof value['name'] === 'string' && isCredentialName(value['name']) && 'value' in value

/**
 * A source step quoted for a person to read: indented JSON, each expression as
 * the source wrote it, and every credential replaced by {@link REDACTED}.
 */
export const quoteOriginal = (value: unknown): string =>
  JSON.stringify(
    value,
    (key: string, held: unknown) => {
      const source = expressionSourceOf(held)
      if (source !== undefined) return redactText(key, source)
      if (typeof held === 'string') return redactText(key, held)
      if (isRecord(held) && isCredentialPair(held)) return { ...held, value: REDACTED }
      return held
    },
    2
  )
