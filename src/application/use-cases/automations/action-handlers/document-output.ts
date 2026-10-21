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
import { storageReadOrUndefined } from '@/application/use-cases/storage/storage-failure-log'
import { isCanonicalStorageKey } from '@/domain/kernel/identity/storage-key'
import { TEMP_STORAGE_PREFIX } from '@/domain/models/app/automations/actions/file/shared'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { logError } from '@/infrastructure/logging/logger'
import { attachGeneratedFile, attachReusedFile, guardStarterAttach } from './document-attach'
import { GeneratedFileWriteError } from './document-output-error'
import { firstFreeSuffix } from './document-output-suffix'
import { storeArtifact, tempKey } from './file-support'
import { CALLER_REFUSAL } from './record-caller-gate'
import { safeFilename } from './safe-filename'
import { starterStanding } from './starter-file-gate'
import { runMayRetakeKey, starterOverwriteVerdict } from './starter-overwrite-gate'
import { builtFromStepRunBytes } from './step-file-inputs'
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
 * there under the attachment-reference rule: a run acting for nobody attaches
 * only a file it wrote itself) | `fail`. `overwrite` and `skip` only take a file THIS automation
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

/**
 * A taken key's refusal as the starter of `automation`'s run reads it: the
 * detail (`detail`) in a run nobody started and for an admin-equivalent
 * starter, the records API's `Resource not found` for anyone else, naming
 * neither the bucket that holds the file nor who wrote it.
 */
export const takenKeyAnswer = (
  app: App,
  automation: AutomationContext,
  detail: string
): Effect.Effect<string, never, StepRequirements> =>
  starterStanding(app, automation).pipe(
    Effect.map((standing) => (standing.kind === 'open' ? detail : CALLER_REFUSAL)),
    Effect.withSpan('automations.taken-key-answer')
  )

/** The starter's refusal, reported as the records API's `Resource not found` and nothing more. */
const callerRefused = (message: string) =>
  Effect.fail(new GeneratedFileWriteError({ message, callerRefused: true }))

/** A taken key refused, worded for the starter of `automation`'s run. */
const refuseTakenKey = (
  app: App,
  automation: AutomationContext,
  detail: string
): Effect.Effect<never, GeneratedFileWriteError, StepRequirements> =>
  Effect.flatMap(takenKeyAnswer(app, automation, detail), (message) =>
    message === CALLER_REFUSAL ? callerRefused(message) : refuse(message)
  )

/** Whether an authored key stays a plain relative key (no leading `/`, no `.`/`..` segment). */
export const isPlainKey = isCanonicalStorageKey

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
  StorageService.use((storage) =>
    storageReadOrUndefined(storage.getMetadata(key, UNATTRIBUTED_BUCKET), key, 'document output')
  )

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

/**
 * Why `automation` may not write at `key` in `bucket`, or `undefined` when the
 * key is free or holds a file this automation stored there itself. Shared with
 * `file/upload`, which never replaces a file it did not store.
 */
export const takenKeyRefusal = (
  key: string,
  bucket: string,
  automation: string
): Effect.Effect<string | undefined, never, StorageService> =>
  existingAt(key).pipe(
    Effect.map((existing) =>
      existing === undefined ? undefined : ownershipRefusal(key, existing, bucket, automation)
    ),
    Effect.withSpan('automations.taken-key-refusal')
  )

/** A key to write at (create-only: replacing nothing), or the file already there to keep. */
type KeyDecision =
  | { readonly kind: 'write'; readonly key: string; readonly createOnly: boolean }
  | { readonly kind: 'skip'; readonly existing: Existing }

/** Apply `ifExists` to the placement's key, on behalf of `automation`. */
const decideKey = (
  placement: Placement,
  policy: string,
  run: { readonly app: App; readonly automation: AutomationContext }
): Effect.Effect<KeyDecision, GeneratedFileWriteError, StepRequirements> =>
  Effect.gen(function* () {
    const existing = yield* existingAt(placement.key)
    if (existing === undefined) {
      // No catalog row is not "free": a hand-started run writes over no object it did not write.
      const verdict = yield* starterOverwriteVerdict(run.app, run.automation)(placement.key)
      if (verdict.kind === 'refused') return yield* callerRefused(verdict.refusal)
      return { kind: 'write', key: placement.key, createOnly: verdict.kind === 'free' } as const
    }
    if (policy === 'fail') {
      const detail = `a file already exists at "${placement.key}" (ifExists: fail)`
      return yield* refuseTakenKey(run.app, run.automation, detail)
    }
    if (policy === 'suffix') {
      const key = yield* firstFreeSuffix(placement.key)
      const judged = (yield* starterStanding(run.app, run.automation)).kind === 'judged'
      return { kind: 'write', key, createOnly: judged } as const
    }
    const { name } = run.automation
    const ownRun = yield* runMayRetakeKey(run.app, run.automation, placement.binding, placement.key)
    const refusal =
      ownershipRefusal(placement.key, existing, placement.binding, name) ??
      (ownRun ? undefined : `"${placement.key}" holds a file an earlier run generated`)
    if (refusal !== undefined) {
      return yield* refuseTakenKey(run.app, run.automation, `cannot write the output: ${refusal}`)
    }
    return policy === 'skip'
      ? ({ kind: 'skip', existing } as const)
      : ({ kind: 'write', key: placement.key, createOnly: false } as const)
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

/** Store the file at the decided key as the run's own (create-only when found free: a file stored meanwhile is kept). */
const storeDecided = (
  input: { readonly file: GeneratedFile; readonly automation: AutomationContext },
  placement: Placement,
  decision: Extract<KeyDecision, { readonly kind: 'write' }>
) =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const wrote = yield* storeArtifact(
      storage,
      decision.key,
      { bytes: input.file.bytes, contentType: input.file.contentType },
      {
        bucket: placement.binding,
        uploadedById: undefined,
        generatedBy: input.automation.name,
        mode: decision.createOnly ? 'create-only' : 'replace',
      }
    )
    if (wrote === 'taken') return yield* callerRefused(CALLER_REFUSAL)
    if (wrote === 'failed')
      return yield* refuse(`the output could not be written at "${decision.key}"`)
    const { binding } = placement
    const written = input.automation.writtenFiles // run bytes only if every file read carries them
    const carriesRunBytes = yield* builtFromStepRunBytes(written)
    yield* Effect.sync(() => written?.record(binding, decision.key, { carriesRunBytes }))
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
    // A hand-started run's attachment is its starter's write: judged before
    // the bucket is touched, so a refusal writes, attaches and deletes nothing.
    if (output.attachTo !== undefined) {
      yield* guardStarterAttach({ attachTo: output.attachTo, app, automation: input.automation })
    }
    const policy = typeof output.ifExists === 'string' ? output.ifExists : 'overwrite'
    const decision = placement.explicitKey
      ? yield* decideKey(placement, policy, input)
      : ({ kind: 'write', key: placement.key, createOnly: false } as const)
    if (decision.kind === 'skip') {
      // The file already there was not written by this step: it is attached only
      // under the attachment-reference rule, and left in place when refused.
      if (output.attachTo !== undefined) {
        yield* attachReusedFile({ ...input, attachTo: output.attachTo, key: placement.key })
      }
      return resultOf(placement.key, placement.binding, filename, decision.existing)
    }
    yield* storeDecided(input, placement, decision)
    const result = resultOf(decision.key, placement.binding, filename, {
      ...file,
      size: file.bytes.length,
    })
    yield* attachOrRemove({ ...input, key: decision.key, binding: placement.binding })
    return result
  }).pipe(Effect.withSpan('automations.write-generated-file'))
