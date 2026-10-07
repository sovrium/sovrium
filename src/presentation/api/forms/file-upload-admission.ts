/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Data, Effect } from 'effect'
import { resolveUploadBucket } from '@/application/use-cases/buckets/resolve-bucket'
import { checkUploadFile } from '@/application/use-cases/buckets/upload-policy'
import { fieldSubmitIdentifier } from '@/domain/models/app/forms/form-field-helpers'
import {
  admitFormFile,
  type FormFileFieldLimits,
} from '@/domain/models/app/forms/form-file-upload-validation'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * The server-side gate every file of a form submission passes before anything
 * is stored.
 *
 * Two tiers, both answered on the file's bytes as read:
 *
 *  1. The FIELD — its `accept` list and `maxFileSize`, judged by
 *     {@link admitFormFile} on the content as well as on the claim.
 *  2. The BUCKET the field uploads into — the very `checkUploadFile` policy the
 *     bucket endpoint runs (filename, the bucket's or the instance's size cap,
 *     its `allowedMimeTypes`), so the form road cannot store what the bucket
 *     road refuses.
 *
 * A refusal names the field and says whether it was the size (413) or anything
 * else (400). The caller checks EVERY file before uploading the first, so a
 * refused submission stores nothing.
 *
 * A file the server could not read or store is the server's fault, not the
 * visitor's: {@link failGenerically} logs the cause, naming the form, and answers
 * a {@link FormUploadError} whose message carries none of it.
 */

/** A file of the submission the server will not store. */
export class FormUploadRefusedError extends Data.TaggedError('FormUploadRefusedError')<{
  readonly fieldName: string
  readonly reason: 'type' | 'size'
  readonly message: string
}> {}

/** A posted file, read, with the field it was posted on. */
export interface ReadFormFile {
  readonly field: string
  readonly file: File
  readonly bytes: Uint8Array
}

/** A file the gate admitted, with the type to store and the bucket it goes to. */
export interface AdmittedFormFile extends ReadFormFile {
  readonly mimeType: string
  readonly bucketName: string
}

/** The upload limits the form declares on `field`; none for an undeclared key. */
const fieldLimits = (form: Readonly<Form>, field: string): FormFileFieldLimits => {
  const declared = form.fields.find((candidate) => fieldSubmitIdentifier(candidate) === field)
  if (declared?.kind !== 'table-field' && declared?.kind !== 'standalone') return {}
  return {
    ...(declared.accept === undefined ? {} : { accept: declared.accept }),
    ...(declared.maxFileSize === undefined ? {} : { maxFileSize: declared.maxFileSize }),
  }
}

/**
 * Admit one read file, or refuse it naming its field. `bucketName` is the
 * bucket the field uploads into, resolved by the caller.
 */
export const admitReadFormFile = (
  app: Readonly<App>,
  form: Readonly<Form>,
  read: Readonly<ReadFormFile>,
  bucketName: string
): Effect.Effect<AdmittedFormFile, FormUploadRefusedError> => {
  const verdict = admitFormFile(fieldLimits(form, read.field), {
    name: read.file.name,
    declaredType: read.file.type,
    bytes: read.bytes,
  })
  if (!verdict.admitted) {
    return Effect.fail(
      new FormUploadRefusedError({
        fieldName: read.field,
        reason: verdict.reason,
        message: verdict.message,
      })
    )
  }
  const bucket = resolveUploadBucket(app, bucketName)
  const rejection =
    bucket === undefined
      ? undefined
      : checkUploadFile(bucket, {
          name: read.file.name,
          size: read.bytes.length,
          type: verdict.mimeType,
        })
  if (rejection !== undefined) {
    return Effect.fail(
      new FormUploadRefusedError({
        fieldName: read.field,
        reason: rejection.reason === 'file-too-large' ? 'size' : 'type',
        message: rejection.message,
      })
    )
  }
  return Effect.succeed({ ...read, mimeType: verdict.mimeType, bucketName })
}

/** A file of the submission the server could not read or store. */
export class FormUploadError extends Data.TaggedError('FormUploadError')<{
  readonly message: string
}> {}

/** What the visitor is told when storing a file fails: the cause stays on the server. */
const UPLOAD_FAILED_MESSAGE = 'The file could not be stored. Please try again later.'

/** The tag of the failure inside `cause`, for the server log line. */
const failureTag = (cause: Cause.Cause<unknown>): string => {
  const failure = Cause.squash(cause)
  if (typeof failure === 'object' && failure !== null && '_tag' in failure) {
    return String(failure._tag)
  }
  return failure instanceof Error ? failure.name : 'unknown failure'
}

/**
 * Log why storing a file for `formName` failed, then answer the generic
 * {@link FormUploadError}: the storage layer's own text never reaches the visitor.
 */
export const failGenerically =
  (formName: string, step: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, FormUploadError, R> =>
    effect.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError(`[forms] ${step} for form "${formName}" failed (${failureTag(cause)})`, cause)
        })
      ),
      Effect.mapError(() => new FormUploadError({ message: UPLOAD_FAILED_MESSAGE }))
    )

/** The bytes of a posted file could not be read. */
class UploadedFileReadError extends Data.TaggedError('UploadedFileReadError')<{
  readonly cause: unknown
}> {}

/** Read one posted file's bytes. */
export const readOne = (
  formName: string,
  field: string,
  file: File
): Effect.Effect<ReadFormFile, FormUploadError> =>
  Effect.tryPromise({
    try: () => file.arrayBuffer(),
    catch: (cause) => new UploadedFileReadError({ cause }),
  }).pipe(
    failGenerically(formName, 'reading an uploaded file'),
    Effect.map((buffer) => ({ field, file, bytes: new Uint8Array(buffer) }))
  )
