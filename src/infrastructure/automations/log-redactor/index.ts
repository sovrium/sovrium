/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const MIN_REDACTABLE_LENGTH = 8

export const REDACTED_PLACEHOLDER = '[REDACTED]'

export const collectRedactableSecrets = (
  env: Readonly<Record<string, string>>
): ReadonlyArray<string> =>
  Object.values(env).filter(
    (value) => typeof value === 'string' && value.length >= MIN_REDACTABLE_LENGTH
  )

export const redactString = (text: string, secrets: ReadonlyArray<string>): string =>
  secrets.reduce((acc, secret) => acc.replaceAll(secret, REDACTED_PLACEHOLDER), text)

export interface RedactableLogger {
  readonly info: (...args: ReadonlyArray<unknown>) => void
  readonly warn: (...args: ReadonlyArray<unknown>) => void
  readonly error: (...args: ReadonlyArray<unknown>) => void
}

const redactArg = (arg: unknown, secrets: ReadonlyArray<string>): unknown =>
  typeof arg === 'string' ? redactString(arg, secrets) : arg

export const wrapLog = (
  log: RedactableLogger,
  secrets: ReadonlyArray<string>
): RedactableLogger => ({
  info: (...args) => log.info(...args.map((a) => redactArg(a, secrets))),
  warn: (...args) => log.warn(...args.map((a) => redactArg(a, secrets))),
  error: (...args) => log.error(...args.map((a) => redactArg(a, secrets))),
})

export const wrapError = (error: unknown, secrets: ReadonlyArray<string>): Readonly<Error> => {
  const baseMessage = error instanceof Error ? error.message : String(error)
  const baseStack = error instanceof Error ? error.stack : undefined
  const redactedMessage = redactString(baseMessage, secrets)
  const redacted = new Error(redactedMessage)
  if (baseStack !== undefined) {
    redacted.stack = redactString(baseStack, secrets)
  }
  return redacted
}
