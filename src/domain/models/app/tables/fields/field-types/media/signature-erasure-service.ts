/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What account erasure leaves of a signature the erased person gave.
 *
 * A signature names its signer (`signerName`) and points at her drawn mark
 * (`image`, an object she uploaded). Both are her personal data. What she
 * agreed to — the `statement`, the instant and the `method` — is the record's
 * own history and stays. So erasure replaces the name with
 * {@link ERASED_SIGNER_NAME} and drops the image key; the object itself is
 * removed with every other object she uploaded.
 *
 * Her signatures are found by their image: a signature whose `image` is one of
 * the objects she uploaded is hers. A typed signature with no image names no
 * object and so cannot be attributed this way.
 *
 * The write-once rule binds user writes; erasure is not one.
 */

/** The name a signature carries once its signer's account is erased. */
export const ERASED_SIGNER_NAME = '[erased]'

/** A stored cell parsed: JSONB arrives as an object, SQLite JSON as text. */
const asObject = (value: unknown): Readonly<Record<string, unknown>> | undefined => {
  const parsed = ((): unknown => {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value) as unknown
    } catch {
      return undefined
    }
  })()
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Readonly<Record<string, unknown>>)
    : undefined
}

/**
 * The signature as erasure leaves it, or `undefined` when it is not one the
 * erased person gave (its image is none of `uploadedKeys`).
 */
export const erasedSignature = (
  value: unknown,
  uploadedKeys: ReadonlySet<string>
): Readonly<Record<string, unknown>> | undefined => {
  const signature = asObject(value)
  const image = signature?.['image']
  if (signature === undefined || typeof image !== 'string' || !uploadedKeys.has(image)) {
    return undefined
  }
  // eslint-disable-next-line unicorn/no-null -- the stored JSON says the image is gone with an explicit null
  return { ...signature, image: null, signerName: ERASED_SIGNER_NAME }
}
