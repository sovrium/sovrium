/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `signature` field is WRITE-ONCE.
 *
 * A signature records that one person agreed to one statement at one instant.
 * An edit that replaced it — or cleared it so it could be signed again — would
 * leave a record that looks signed by whoever wrote last, with nothing to tell
 * it from the original. So once a signature field holds a value, an update
 * naming it is refused unless it sends the very value already stored (a form
 * resubmitting the whole record changes nothing).
 *
 * Pure: the caller hands the row as stored and the fields the update sends.
 */

/** The stored value as a structure: SQLite holds the JSON as text. */
const parsed = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

/** A JSON-comparable rendering of a value, with object keys sorted. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === 'object' && inner !== null && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner as Record<string, unknown>).toSorted(([a], [b]) =>
            a.localeCompare(b)
          )
        )
      : inner
  )

/** Whether a stored cell holds a signature. */
const isSigned = (value: unknown): boolean => {
  const stored = parsed(value)
  return stored !== null && stored !== undefined && stored !== ''
}

/**
 * The first signature field the update would change on a row that already
 * holds a signature there, or `undefined` when the update keeps every one.
 */
export const signatureOverwriteOf = (input: {
  readonly fields: readonly { readonly name: string; readonly type: string }[]
  readonly held: Readonly<Record<string, unknown>> | null | undefined
  readonly update: Readonly<Record<string, unknown>>
}): string | undefined => {
  const { held, update } = input
  if (held === null || held === undefined) return undefined
  return input.fields
    .filter((field) => field.type === 'signature' && Object.hasOwn(update, field.name))
    .find(
      (field) =>
        isSigned(held[field.name]) &&
        canonical(parsed(held[field.name])) !== canonical(parsed(update[field.name]))
    )?.name
}
