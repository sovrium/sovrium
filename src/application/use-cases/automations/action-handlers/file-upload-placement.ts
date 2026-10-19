/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  UNATTRIBUTED_BUCKET,
  uploadTargetParts,
} from '@/application/ports/services/storage-service'
import { resolveUploadBucket } from '@/application/use-cases/buckets/resolve-bucket'
import { checkUploadPathType } from '@/application/use-cases/buckets/upload-policy'
import { isPlainKey, takenKeyAnswer, takenKeyRefusal } from './document-output'
import { extByMime, tempKey } from './file-support'
import { unlessKeyTaken } from './starter-overwrite-gate'
import type { AutomationContext } from './shared'
import type { StepRequirements } from '../run/types'
import type { UploadTarget } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'

type Placed = { readonly key: string; readonly target: UploadTarget }

/**
 * A placement the overwrite gate admitted, its write made create-only when the
 * key was found free: a file stored there in the meantime is then kept.
 */
const admitted = (
  verdict: (Placed & { readonly createOnly: boolean }) | { readonly refusal: string }
): Placed | { readonly refusal: string } =>
  'refusal' in verdict
    ? verdict
    : {
        key: verdict.key,
        target: {
          ...uploadTargetParts(verdict.target),
          mode: verdict.createOnly ? 'create-only' : 'replace',
        },
      }

/**
 * Where an upload goes: with no `bucket`, a temporary artifact in no bucket at
 * its `path` or a fresh temp key; with a `bucket` (declared, checked at start),
 * catalogued there as stored by `automation`, at its `path` or a fresh key
 * outside the temp prefix. A `path` that is not a plain relative key is
 * refused, so is one whose extension names a type the bucket does not take,
 * and so is one holding a file this automation did not store — or, in
 * a run someone started by hand, one this very run did not write, a file no
 * bucket holds included, refused as its starter may read it.
 */
export const uploadPlacement = (input: {
  readonly app: App
  readonly path: string | undefined
  readonly bucket: string | undefined
  readonly mime: string
  readonly automation: AutomationContext
}): Effect.Effect<Placed | { readonly refusal: string }, never, StepRequirements> =>
  Effect.gen(function* () {
    const { path, bucket, mime, automation } = input
    const hasPath = path !== undefined && path.trim() !== ''
    if (hasPath && !isPlainKey(path)) {
      return {
        refusal: `file.upload path "${path}" must be a relative key with no "." or ".." segment`,
      }
    }
    if (bucket === undefined) {
      if (!hasPath) return { key: tempKey(''), target: UNATTRIBUTED_BUCKET } satisfies Placed
      return admitted(
        yield* unlessKeyTaken<Placed>(input.app, automation, path, {
          key: path,
          target: UNATTRIBUTED_BUCKET,
        })
      )
    }
    // Start refuses an undeclared literal; a `code` step's call is checked here.
    const declared = resolveUploadBucket(input.app, bucket)
    if (declared === undefined) {
      return { refusal: `file.upload bucket "${bucket}" is not declared` }
    }
    const target = { bucket, uploadedById: undefined, generatedBy: automation.name }
    if (!hasPath) return { key: `${globalThis.crypto.randomUUID()}${extByMime(mime)}`, target }
    const typeRefusal = checkUploadPathType(declared, path)
    if (typeRefusal !== undefined) return { refusal: `file.upload ${typeRefusal.message}` }
    const refusal = yield* takenKeyRefusal(path, bucket, automation.name)
    if (refusal === undefined)
      return admitted(
        yield* unlessKeyTaken<Placed>(input.app, automation, path, { key: path, target })
      )
    const detail = `file.upload cannot write the file: ${refusal}`
    return { refusal: yield* takenKeyAnswer(input.app, automation, detail) }
  }).pipe(Effect.withSpan('automations.upload-placement'))
