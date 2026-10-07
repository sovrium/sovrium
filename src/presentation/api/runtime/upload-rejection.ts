/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The status each upload refusal earns, shared by every upload door that runs
 * the bucket's own rules (`checkUploadFile`): the app's public upload and the
 * operator console's.
 *
 * A table rather than a chain of `if`s, and TOTAL over
 * the policy's refusal reasons, so a rule added on the application side cannot
 * reach the wire without someone choosing its status here. Only the size cap is
 * a 413 — the rest are malformed requests.
 */

import { storageErrorBody } from '@/presentation/api/runtime/auth-helpers'
import type { ApiErrorCode } from '@/domain/models/api/combinators/error'
import type { Context } from 'hono'

/**
 * The refusal reasons of the application's upload policy, restated here because
 * this tier may not import a use-case. A reason added there and not here makes
 * every `rejectUpload` call a type error — the totality the table exists for.
 */
type UploadRejectionReason =
  'invalid-filename' | 'invalid-path' | 'file-too-large' | 'mime-type-not-allowed'

interface UploadRejection {
  readonly reason: UploadRejectionReason
  readonly message: string
}

const UPLOAD_REJECTION_STATUS: Readonly<
  Record<UploadRejectionReason, { readonly status: 400 | 413; readonly code: ApiErrorCode }>
> = {
  'invalid-filename': { status: 400, code: 'BAD_REQUEST' },
  'invalid-path': { status: 400, code: 'BAD_REQUEST' },
  'file-too-large': { status: 413, code: 'PAYLOAD_TOO_LARGE' },
  'mime-type-not-allowed': { status: 400, code: 'BAD_REQUEST' },
}

/**
 * Answer a refused upload with its status. `toBody` shapes the error envelope,
 * so each door keeps the body its clients already read.
 */
export const rejectUpload = (
  c: Context,
  rejection: Readonly<UploadRejection>,
  toBody: (message: string, code: ApiErrorCode) => object = storageErrorBody
): Response => {
  const { status, code } = UPLOAD_REJECTION_STATUS[rejection.reason]
  return c.json(toBody(rejection.message, code), status)
}
