/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two refusals an attachment rule can produce, and why they are two.
 *
 * A {@link AttachmentRuleViolation} is a verdict ABOUT THE PAYLOAD: too many
 * files, a type the column does not accept, bytes above the declared cap. The
 * caller sent something the column refuses, and naming the field is what makes
 * the answer actionable.
 *
 * An {@link AttachmentStorageUnavailable} is the opposite — the rule never got
 * to form a verdict, because the storage a field's own contract depends on
 * would not answer. It says nothing about the value, which is why it carries
 * the originating cause for the server and nothing field-scoped for the client.
 *
 * Keeping them apart is the whole of the fail-closed fix. Every one of these
 * sites used to substitute a fabricated value for the one it could not obtain —
 * a zero-byte download, an ignored upload — and report success, so an outage
 * was persisted as data: an oversized file admitted into a capped column, a
 * `size: 0` written for bytes nobody read, a row pointing at a key that was
 * never stored. Collapsing the two back into one error would restore exactly
 * that, because a caller cannot retry an answer it was told was a verdict.
 */

import { Data } from 'effect'

/**
 * The payload violates an attachment column's declared constraint.
 *
 * `message` is rendered to the caller verbatim and `field` names the column,
 * because a record write carrying several attachment columns is unactionable
 * without knowing which one refused.
 */
export class AttachmentRuleViolation extends Data.TaggedError('AttachmentRuleViolation')<{
  readonly message: string
  readonly field: string
}> {}

/**
 * A storage read or write the column's contract depended on did not complete.
 *
 * `cause` is the originating `StorageError` and is for the server only: a lost
 * object, rotated credentials, a revoked policy and an object store that is
 * simply down are indistinguishable at this seam, and none of them is the
 * caller's business (standing rule S4).
 */
export class AttachmentStorageUnavailable extends Data.TaggedError('AttachmentStorageUnavailable')<{
  readonly message: string
  readonly field: string
  readonly cause: unknown
}> {}

/**
 * The single constructor for every attachment rule that fails because storage
 * would not answer. One helper rather than an inline construction at each of the
 * three sites, so they cannot drift into three different stories about the same
 * outage.
 *
 * `reason` names what the rule could not DO, never what the caller did wrong.
 * Curried because every call site hands it straight to `Effect.mapError`.
 */
export const storageUnavailable =
  (fieldName: string, reason: string) =>
  (cause: unknown): Readonly<AttachmentStorageUnavailable> =>
    new AttachmentStorageUnavailable({
      message: `Storage is unavailable: ${reason} for field '${fieldName}'`,
      field: fieldName,
      cause,
    })
