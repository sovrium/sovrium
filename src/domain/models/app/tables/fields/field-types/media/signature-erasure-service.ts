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
 * {@link ERASED_SIGNER_NAME}, drops the image key and, on a version 2 value,
 * the account id its identity carries; the object itself is removed with every
 * other object she uploaded.
 *
 * Her signatures are found by their image, a signature whose `image` is one of
 * the objects she uploaded, and, on a version 2 value, by the account its
 * identity names, which finds the typed ones too. A typed signature of version
 * 1 names neither, and cannot be attributed.
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

/** Whether a version 2 identity names the erased account. */
const namesAccount = (identity: unknown, userId: string | undefined): boolean =>
  userId !== undefined &&
  typeof identity === 'object' &&
  identity !== null &&
  (identity as Readonly<Record<string, unknown>>)['kind'] === 'account' &&
  (identity as Readonly<Record<string, unknown>>)['userId'] === userId

/**
 * The signature as erasure leaves it, or `undefined` when it is not one the
 * erased person gave: its image is none of `uploadedKeys`, and its identity
 * does not name `userId`.
 */
export const erasedSignature = (
  value: unknown,
  uploadedKeys: ReadonlySet<string>,
  userId?: string
): Readonly<Record<string, unknown>> | undefined => {
  const signature = asObject(value)
  if (signature === undefined) return undefined
  const { image, identity } = signature
  const uploadedByHer = typeof image === 'string' && uploadedKeys.has(image)
  if (!uploadedByHer && !namesAccount(identity, userId)) return undefined
  // A version 2 value names her account too: its kind stays, her id goes.
  const kept =
    typeof identity === 'object' && identity !== null
      ? { identity: { kind: (identity as Readonly<Record<string, unknown>>)['kind'] } }
      : {}
  // eslint-disable-next-line unicorn/no-null -- the stored JSON says the image is gone with an explicit null
  return { ...signature, ...kept, image: null, signerName: ERASED_SIGNER_NAME }
}

/**
 * The signature as a signer's erasure leaves it, found by the evidence entry
 * it was recorded as (`evidenceId`), or `undefined` when the cell is not one of
 * `evidenceIds`. Used for a signer of a flow, who may have no account: her
 * name goes, her mark's key goes (the mark itself is evidence, kept until its
 * retention ends), her account id goes, and what she agreed to stays.
 */
export const erasedSignatureByEvidence = (
  value: unknown,
  evidenceIds: ReadonlySet<string>
): Readonly<Record<string, unknown>> | undefined => {
  const signature = asObject(value)
  const { evidenceId, identity } = signature ?? {}
  if (signature === undefined || typeof evidenceId !== 'string' || !evidenceIds.has(evidenceId)) {
    return undefined
  }
  const kept =
    typeof identity === 'object' && identity !== null
      ? { identity: { kind: (identity as Readonly<Record<string, unknown>>)['kind'] } }
      : {}
  // eslint-disable-next-line unicorn/no-null -- the stored JSON says the image is gone with an explicit null
  return { ...signature, ...kept, image: null, signerName: ERASED_SIGNER_NAME }
}
