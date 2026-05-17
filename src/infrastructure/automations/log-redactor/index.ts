/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Minimum length of an env var value to qualify for redaction. Shorter
 * values (`"1"`, `"true"`, `"yes"`) frequently appear as legitimate
 * unrelated content elsewhere in logs and would over-redact. Real
 * secrets (API keys, OAuth tokens, signing secrets) are universally
 * longer than 8 characters.
 */
export const MIN_REDACTABLE_LENGTH = 8

/**
 * Marker substituted in place of any redactable secret value.
 */
export const REDACTED_PLACEHOLDER = '[REDACTED]'

/**
 * Filter the env map down to the values eligible for redaction. Used at
 * the call boundary so the redactor itself can stay a pure stateless
 * function operating on a single string.
 * @public
 */
export const collectRedactableSecrets = (
  env: Readonly<Record<string, string>>
): ReadonlyArray<string> =>
  Object.values(env).filter(
    (value) => typeof value === 'string' && value.length >= MIN_REDACTABLE_LENGTH
  )

/**
 * Replace every occurrence of every secret with `[REDACTED]`. Operates
 * on the input verbatim — the caller decides which fields to redact
 * (log message, error message, error stack). Multiple secret values
 * are handled by chained `replaceAll` so overlapping substrings still
 * resolve to a single `[REDACTED]` per occurrence.
 *
 * Pure function: same `(text, secrets)` always yields the same output.
 */
export const redactString = (text: string, secrets: ReadonlyArray<string>): string =>
  secrets.reduce((acc, secret) => acc.replaceAll(secret, REDACTED_PLACEHOLDER), text)

/**
 * Wrap a structured logger so every `info`/`warn`/`error` argument that
 * is a string has all secret values replaced before persistence. Non-
 * string args are passed through unchanged — their JSON serialization
 * happens downstream in the run-history append, where the redactor is
 * also applied to the serialized payload.
 *
 * The returned logger preserves the input shape (info/warn/error) so
 * the code action handler can swap it in transparently.
 */
export interface RedactableLogger {
  readonly info: (...args: ReadonlyArray<unknown>) => void
  readonly warn: (...args: ReadonlyArray<unknown>) => void
  readonly error: (...args: ReadonlyArray<unknown>) => void
}

const redactArg = (arg: unknown, secrets: ReadonlyArray<string>): unknown =>
  typeof arg === 'string' ? redactString(arg, secrets) : arg

/** @public */
export const wrapLog = (
  log: RedactableLogger,
  secrets: ReadonlyArray<string>
): RedactableLogger => ({
  info: (...args) => log.info(...args.map((a) => redactArg(a, secrets))),
  warn: (...args) => log.warn(...args.map((a) => redactArg(a, secrets))),
  error: (...args) => log.error(...args.map((a) => redactArg(a, secrets))),
})

/**
 * Return a NEW Error whose `message` and `stack` have every secret
 * value redacted. The original error is left untouched so debugging at
 * the host realm still sees the real values; only the persisted
 * representation is sanitized.
 *
 * Falls back to a fresh `Error` when given a non-Error so the run-
 * history append always sees a uniform shape.
 * @public
 */
export const wrapError = (error: unknown, secrets: ReadonlyArray<string>): Readonly<Error> => {
  const baseMessage = error instanceof Error ? error.message : String(error)
  const baseStack = error instanceof Error ? error.stack : undefined
  const redactedMessage = redactString(baseMessage, secrets)
  const redacted = new Error(redactedMessage)
  if (baseStack !== undefined) {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- reassigning Error.stack is the standard way to surface a redacted trace
    redacted.stack = redactString(baseStack, secrets)
  }
  return redacted
}
