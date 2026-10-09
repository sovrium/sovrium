/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  readOtherSpelling,
  readStoredObjectOwner,
} from '@/application/use-cases/buckets/bucket-file-programs'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  mayReplaceOrRemoveObject,
  ownershipGovernsAction,
  type ObjectReplacingAction,
} from '@/domain/models/app/buckets/object-ownership-validation'
import { logError } from '@/infrastructure/logging/logger'
import {
  provideDomain,
  runDomainPromise,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { storageErrorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type { Context } from 'hono'

/**
 * Refuse a delete or an overwrite of an object the caller neither uploaded nor
 * administers, when the bucket leaves that action undeclared.
 *
 * Runs AFTER {@link canAct}, which has already required a session for the
 * undeclared fallback. A key the bucket does not hold passes: the operation
 * itself then answers its own 404. A refusal answers that SAME 404, body for
 * body — the unknown key's for a delete, the foreign key's for an overwrite —
 * so it tells the caller nothing about whose object sits at the key.
 *
 * A declared grant is never narrowed here (`ownershipGovernsAction`), and the
 * caller's role is only looked up once an object is actually at stake. An
 * upload is also held to every other spelling of its key the storage would
 * land on the same object ({@link refuseSecondSpelling}).
 */
export async function refuseUnlessOwnerOrAdmin(
  c: Context,
  input: ObjectGateInput
): Promise<Response | undefined> {
  const exact = await refuseUnlessOwnerOrAdminAt(c, input)
  if (exact !== undefined || input.action !== 'upload' || input.key === undefined) return exact
  return refuseSecondSpelling(c, { ...input, key: input.key })
}

/** What the gate judges: the caller, the bucket, and the key at stake. */
interface ObjectGateInput {
  readonly app: App
  readonly bucket: Bucket
  readonly action: ObjectReplacingAction
  readonly session: UserSession | undefined
  /** The key at stake; absent (an upload with no explicit path) is a NEW object. */
  readonly key: string | undefined
}

/**
 * Answer an explicit-path upload whose key is a second spelling of a stored key
 * — equal after Unicode normalisation, or after letter case too where the
 * storage disk ignores it — exactly as that stored key would be answered when
 * the caller may not replace it: another bucket's object, or one the caller
 * neither uploaded nor administers, earns the same 404. A caller who may
 * replace it gets a 409 that does not echo the stored spelling: the object is
 * reachable under the key it was stored with, never redirected.
 */
async function refuseSecondSpelling(
  c: Context,
  input: ObjectGateInput & { readonly key: string }
): Promise<Response | undefined> {
  const other = await runRequestEffect(
    c,
    provideDomain(c, readOtherSpelling({ key: input.key })).pipe(Effect.result)
  )
  if (other._tag === 'Failure') {
    logError('[buckets] upload spelling check failed', other.failure)
    return c.json(storageErrorBody('Storage unavailable', 'STORAGE_ERROR'), 500)
  }
  const stored = other.success
  if (stored === undefined) return undefined
  if (stored.bucket !== input.bucket.name) return notFound(c, 'File not found')
  const refusal = await refuseUnlessOwnerOrAdminAt(c, { ...input, key: stored.key })
  return refusal ?? spellingTaken(c)
}

/** The 409 a second spelling of a stored key earns from a caller who may replace it. */
export const spellingTaken = (c: Context): Response =>
  c.json(
    storageErrorBody('A file is already stored under another spelling of this path', 'CONFLICT'),
    409
  )

/** The owner-or-admin judgement for the object stored at exactly `input.key`. */
async function refuseUnlessOwnerOrAdminAt(
  c: Context,
  input: ObjectGateInput
): Promise<Response | undefined> {
  const { app, bucket, action, session, key } = input
  if (key === undefined) return undefined
  const governs = ownershipGovernsAction({
    permissions: bucket.permissions,
    action,
    appHasAuth: app.auth !== undefined,
  })
  if (!governs || session === undefined) return undefined

  const owner = await runRequestEffect(
    c,
    provideDomain(c, readStoredObjectOwner({ key, bucket: bucket.name })).pipe(Effect.result)
  )
  if (owner._tag === 'Failure') {
    // The catalog could not be read, so ownership is unknown: refuse rather
    // than let the write through unjudged.
    logError(`[buckets] ${action} ownership check failed`, owner.failure)
    return c.json(storageErrorBody('Storage unavailable', 'STORAGE_ERROR'), 500)
  }
  if (!owner.success.stored) return undefined

  const role = await runDomainPromise(c, getUserRole(session.userId))
  const allowed = mayReplaceOrRemoveObject({
    uploadedBy: owner.success.uploadedBy,
    callerId: session.userId,
    callerIsAdmin: isAdminEquivalent(role, app),
  })
  return allowed ? undefined : notFound(c, 'File not found')
}
