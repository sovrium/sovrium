/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  StorageService,
  UNATTRIBUTED_BUCKET,
  type BucketBinding,
} from '@/application/ports/services/storage-service'
import { TEMP_STORAGE_PREFIX } from '@/domain/models/app/automations/actions/file/shared'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { logError } from '@/infrastructure/logging/logger'
import { attachGeneratedFile } from './document-attach'
import { GeneratedFileWriteError } from './document-output-error'
import { tempKey, uploadArtifactTo } from './file-support'
import { safeFilename } from './safe-filename'
import type { ActionRunContext, AutomationContext } from './shared'
import type { StepRequirements } from '../run/types'
import type { App } from '@/domain/models/app'
import type { DocumentResult } from '@/domain/models/app/automations/actions/document/shared'

/**
 * THE ONE OUTPUT ROAD of every `document/*` and `pdf/*` action: where a
 * generated file is written, under which key, what happens when one is
 * already there, and which record it is attached to.
 *
 * A generated file is attached to a record or temporary — a file in a bucket
 * that belongs to no record could be neither exported nor erased for anyone:
 *
 * - no `attachTo` → temporary: under `tmp/automations/` (an authored `key` is
 *   placed under that prefix), in no bucket, served by no route, swept with
 *   the temp files. A `bucket` without `attachTo` is refused;
 * - `attachTo` → into THE FIELD's bucket (`system` when the column names
 *   none, and `bucket`, when given, must name the same), at
 *   `<uuid>-<filename>` unless `key`, then into the record's field (`replace`
 *   deletes what it swaps out); an attached file is erased with its record.
 *
 * `ifExists` decides a taken key: `overwrite` (default) | `suffix` (up to
 * `name-1000.ext`) | `skip` (and, with `attachTo`, attach the file already
 * there) | `fail`. `overwrite` and `skip` only take a file THIS automation
 * generated: a person's upload, or another automation's file, fails the step
 * and is kept. Every write records the automation that generated it.
 */

/** What a generator produced, before it is written. */
export interface GeneratedFile {
  readonly bytes: Uint8Array
  readonly contentType: string
  readonly pages?: number
  readonly width?: number
  readonly height?: number
}

/** The `output` prop as the run resolved it (its strings filled in). */
export interface ResolvedDocumentOutput {
  readonly filename?: unknown
  readonly bucket?: unknown
  readonly key?: unknown
  readonly ifExists?: unknown
  readonly attachTo?: {
    readonly table?: unknown
    readonly record?: unknown
    readonly field?: unknown
    readonly mode?: unknown
  }
}

type WriteRequirements = StepRequirements

const refuse = (message: string): Effect.Effect<never, GeneratedFileWriteError> =>
  Effect.fail(new GeneratedFileWriteError({ message }))

/** Whether an authored key stays a plain relative key (no leading `/`, no `.`/`..` segment). */
const isPlainKey = (key: string): boolean =>
  key !== '' &&
  !key.startsWith('/') &&
  !key.includes('\\') &&
  key.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')

/** `name-<n>.ext` for the n-th suffixed copy of a key. */
export const suffixedKey = (key: string, n: number): string => {
  const slash = key.lastIndexOf('/')
  const dot = key.lastIndexOf('.')
  return dot > slash + 1 ? `${key.slice(0, dot)}-${n}${key.slice(dot)}` : `${key}-${n}`
}

interface Placement {
  readonly binding: BucketBinding
  readonly key: string
  readonly explicitKey: boolean
}

const nonEmpty = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/** The bucket the file goes to (`undefined`: temporary), or why the output contradicts itself. */
const targetBucket = (
  output: ResolvedDocumentOutput,
  app: App
): { readonly bucket?: string } | { readonly refusal: string } => {
  const explicit = nonEmpty(output.bucket)
  const { attachTo } = output
  if (attachTo === undefined) {
    return explicit === undefined
      ? {}
      : {
          refusal: `output bucket "${explicit}" names no record: attach the file with attachTo, or drop the bucket to keep it temporary`,
        }
  }
  const field =
    resolveFieldBucket(app, String(attachTo.table ?? ''), String(attachTo.field ?? '')) ??
    SYSTEM_BUCKET_NAME
  return explicit === undefined || explicit === field
    ? { bucket: field }
    : {
        refusal: `output bucket "${explicit}" differs from "${field}", the bucket of the attachment field`,
      }
}

/** An authored key as written in a bucket, or placed under the temporary prefix without one. */
const placedKey = (key: string, bucket: string | undefined): string =>
  bucket !== undefined || key.startsWith(TEMP_STORAGE_PREFIX) ? key : `${TEMP_STORAGE_PREFIX}${key}`

/** Where the file goes: its bucket binding and key, or why it cannot go there. */
const placementOf = (
  output: ResolvedDocumentOutput,
  app: App,
  filename: string
): Effect.Effect<Placement, GeneratedFileWriteError> => {
  const authoredKey = nonEmpty(output.key)
  if (authoredKey !== undefined && !isPlainKey(authoredKey)) {
    return refuse(`output key "${authoredKey}" must be a relative key with no "." or ".." segment`)
  }
  const target = targetBucket(output, app)
  if ('refusal' in target) return refuse(target.refusal)
  const { bucket } = target
  const safe = safeFilename(filename)
  const generated =
    bucket === undefined ? tempKey(`-${safe}`) : `${globalThis.crypto.randomUUID()}-${safe}`
  return Effect.succeed({
    binding: bucket ?? UNATTRIBUTED_BUCKET,
    key: authoredKey === undefined ? generated : placedKey(authoredKey, bucket),
    explicitKey: authoredKey !== undefined,
  })
}

interface Existing {
  readonly bucket?: string
  readonly uploadedBy?: string
  readonly generatedBy?: string
  readonly size: number
  readonly contentType: string
}

/** The object already at `key`, in any bucket, or `undefined`. */
const existingAt = (key: string): Effect.Effect<Existing | undefined, never, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const meta = yield* Effect.result(storage.getMetadata(key, UNATTRIBUTED_BUCKET))
    return meta._tag === 'Success' ? meta.success : undefined
  })

/**
 * Why the file at a taken key is not this automation's to replace (or to
 * reuse on `skip`), or `undefined` when it is: in the same bucket, uploaded by
 * nobody, and generated by this very automation.
 */
const ownershipRefusal = (
  key: string,
  existing: Existing,
  binding: BucketBinding,
  automation: string
): string | undefined => {
  if (existing.uploadedBy !== undefined) {
    return `"${key}" holds a file a person uploaded; a generated file never replaces one`
  }
  const target = binding === UNATTRIBUTED_BUCKET ? undefined : binding
  if (existing.bucket !== target) {
    return `"${key}" already belongs to ${existing.bucket === undefined ? 'no bucket' : `bucket "${existing.bucket}"`}`
  }
  return existing.generatedBy === automation
    ? undefined
    : `"${key}" holds a file this automation did not generate; it only replaces its own`
}

type KeyDecision =
  | { readonly kind: 'write'; readonly key: string }
  | { readonly kind: 'skip'; readonly existing: Existing }

/** The highest number `suffix` tries before it refuses. */
const SUFFIX_LIMIT = 1000

/** The first free `name-<n>.ext` after `key`, or a refusal once `name-1000.ext` is taken. */
const firstFreeSuffix = (
  key: string,
  n = 1
): Effect.Effect<string, GeneratedFileWriteError, StorageService> =>
  Effect.flatMap(existingAt(suffixedKey(key, n)), (taken) => {
    if (taken === undefined) return Effect.succeed(suffixedKey(key, n))
    return n >= SUFFIX_LIMIT
      ? refuse(
          `every name from "${suffixedKey(key, 1)}" to "${suffixedKey(key, SUFFIX_LIMIT)}" is taken (ifExists: suffix stops at ${SUFFIX_LIMIT})`
        )
      : firstFreeSuffix(key, n + 1)
  })

/** Apply `ifExists` to the placement's key, on behalf of `automation`. */
const decideKey = (
  placement: Placement,
  policy: string,
  automation: string
): Effect.Effect<KeyDecision, GeneratedFileWriteError, StorageService> =>
  Effect.gen(function* () {
    const existing = yield* existingAt(placement.key)
    if (existing === undefined) return { kind: 'write', key: placement.key } as const
    if (policy === 'fail') {
      return yield* refuse(`a file already exists at "${placement.key}" (ifExists: fail)`)
    }
    if (policy === 'suffix')
      return { kind: 'write', key: yield* firstFreeSuffix(placement.key) } as const
    const refusal = ownershipRefusal(placement.key, existing, placement.binding, automation)
    if (refusal !== undefined) return yield* refuse(`cannot write the output: ${refusal}`)
    return policy === 'skip'
      ? ({ kind: 'skip', existing } as const)
      : ({ kind: 'write', key: placement.key } as const)
  })

const resultOf = (
  key: string,
  binding: BucketBinding,
  filename: string,
  file: Pick<GeneratedFile, 'pages' | 'width' | 'height'> & {
    readonly size: number
    readonly contentType: string
  }
): DocumentResult => ({
  key,
  ...(binding === UNATTRIBUTED_BUCKET ? {} : { bucket: binding }),
  // The name a later step hands on (an attachment, a converter's input) is
  // never a path: the same cleaning the key had.
  filename: safeFilename(filename),
  contentType: file.contentType,
  size: file.size,
  ...(file.pages === undefined ? {} : { pages: file.pages }),
  ...(file.width === undefined ? {} : { width: file.width }),
  ...(file.height === undefined ? {} : { height: file.height }),
})

/** Attach the written file; one that cannot be attached is removed, not left with no owner. */
const attachOrRemove = (input: {
  readonly output: ResolvedDocumentOutput
  readonly key: string
  readonly binding: BucketBinding
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}) =>
  Effect.gen(function* () {
    if (input.output.attachTo === undefined) return
    const storage = yield* StorageService
    yield* attachGeneratedFile({
      attachTo: input.output.attachTo,
      key: input.key,
      app: input.app,
      automation: input.automation,
      runContext: input.runContext,
    }).pipe(
      Effect.tapError(() =>
        storage['delete'](input.key, input.binding).pipe(
          Effect.tapCause((cause) =>
            Effect.sync(() =>
              logError('[automations] could not remove a generated file left unattached', cause, {
                key: input.key,
              })
            )
          ),
          // effect-swallow: the step already fails with the attach error; a leftover is logged.
          Effect.ignoreCause
        )
      )
    )
  })

/**
 * Write a generated file where its `output` says, and attach it to a record
 * when `attachTo` asks. Returns the step result, usable downstream as a
 * `{ step: <name> }` file reference.
 */
export const writeGeneratedFile = (input: {
  readonly output: ResolvedDocumentOutput
  readonly file: GeneratedFile
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
}): Effect.Effect<DocumentResult, GeneratedFileWriteError, WriteRequirements> =>
  Effect.gen(function* () {
    const { output, file, app } = input
    const filename =
      typeof output.filename === 'string' && output.filename !== '' ? output.filename : 'file'
    const placement = yield* placementOf(output, app, filename)
    const policy = typeof output.ifExists === 'string' ? output.ifExists : 'overwrite'
    const decision = placement.explicitKey
      ? yield* decideKey(placement, policy, input.automation.name)
      : ({ kind: 'write', key: placement.key } as const)
    if (decision.kind === 'skip') {
      // The file already there is this automation's: attach it as if just written,
      // and leave it in place when the record refuses it.
      if (output.attachTo !== undefined) {
        yield* attachGeneratedFile({ ...input, attachTo: output.attachTo, key: placement.key })
      }
      return resultOf(placement.key, placement.binding, filename, decision.existing)
    }
    const storage = yield* StorageService
    const wrote = yield* uploadArtifactTo(
      storage,
      decision.key,
      { bytes: file.bytes, contentType: file.contentType },
      { bucket: placement.binding, uploadedById: undefined, generatedBy: input.automation.name }
    )
    if (!wrote) return yield* refuse(`the output could not be written at "${decision.key}"`)
    const result = resultOf(decision.key, placement.binding, filename, {
      ...file,
      size: file.bytes.length,
    })
    yield* attachOrRemove({ ...input, key: decision.key, binding: placement.binding })
    return result
  }).pipe(Effect.withSpan('automations.write-generated-file'))
