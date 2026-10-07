/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { assembleMultipartRelated } from '@/domain/models/app/connections/operation-body-service'
import { WrittenBodyFileError, readOperationFile } from './connection-file-read'
import { buildOperationRequest, encodeBody, withEncodedBody } from './connection-request'
import type {
  BodyField,
  FieldBodyPlan,
  OperationRequest,
  WrittenBodyPiece,
  WrittenBodyPlan,
} from './connection-request'
import type { StorageService } from '@/application/ports/services/storage-service'

const pieceBytes = (
  piece: WrittenBodyPiece
): Effect.Effect<Uint8Array, WrittenBodyFileError, StorageService> =>
  piece.file !== undefined
    ? readOperationFile(piece.file, 'file').pipe(Effect.map((file) => file.bytes))
    : Effect.succeed(new TextEncoder().encode(piece.text))

/** The finished body and Content-Type of a written-body plan. */
const assemble = (
  plan: WrittenBodyPlan,
  boundary: string
): Effect.Effect<
  { readonly body: Uint8Array<ArrayBuffer>; readonly contentType: string },
  WrittenBodyFileError,
  StorageService
> =>
  plan.kind === 'raw'
    ? pieceBytes(plan.piece).pipe(
        // A copy, so the body owns a plain ArrayBuffer `fetch` accepts.
        Effect.map((bytes) => ({
          body: new Uint8Array(bytes),
          contentType: plan.piece.contentType,
        }))
      )
    : Effect.forEach(plan.parts, pieceBytes).pipe(
        Effect.map((bytes) =>
          assembleMultipartRelated(
            plan.parts.map((part, index) => ({
              contentType: part.contentType,
              bytes: bytes[index] ?? new Uint8Array(0),
            })),
            boundary
          )
        )
      )

/**
 * One field of a field body, its file read: inlined as one base64 string under
 * `encoding: base64` (or in a body with no file part to carry it), else a file
 * part carrying the file's original name and content type.
 */
const fieldValue = (
  field: BodyField,
  kind: FieldBodyPlan['kind']
): Effect.Effect<readonly [string, unknown], WrittenBodyFileError, StorageService> =>
  field.kind === 'value'
    ? Effect.succeed([field.name, field.value] as const)
    : readOperationFile(field.file, field.name).pipe(
        Effect.map(
          (file) =>
            [
              field.name,
              field.encoding === 'base64' || kind !== 'multipart'
                ? Buffer.from(file.bytes).toString('base64')
                : new File([new Uint8Array(file.bytes)], file.fileName, { type: file.contentType }),
            ] as const
        )
      )

/** Complete a request whose field body carries a `file` parameter: read, then encode. */
const completeFieldBody = (
  request: OperationRequest,
  plan: FieldBodyPlan
): Effect.Effect<OperationRequest, WrittenBodyFileError, StorageService> =>
  Effect.forEach(plan.fields, (field) => fieldValue(field, plan.kind)).pipe(
    Effect.map((fields) => withEncodedBody(request, encodeBody(plan.kind, fields))),
    Effect.withSpan('automations.connection-field-body')
  )

/**
 * Complete a request whose body is sent as written: read its files, assemble
 * the payload (one piece, or the parts of a multipart/related body under a
 * fresh boundary) and set its Content-Type; or read the files of a field body
 * and encode it. A request with neither is returned as it is.
 */
const completeWrittenBody = (
  request: OperationRequest
): Effect.Effect<OperationRequest, WrittenBodyFileError, StorageService> => {
  if (request.fieldBody !== undefined) return completeFieldBody(request, request.fieldBody)
  const plan = request.writtenBody
  if (plan === undefined) return Effect.succeed(request)
  return assemble(plan, `sovrium-${crypto.randomUUID()}`).pipe(
    Effect.map(({ body, contentType }) => ({
      url: request.url,
      method: request.method,
      headers: { ...request.headers, 'Content-Type': contentType },
      body,
    })),
    Effect.withSpan('automations.connection-written-body')
  )
}

/**
 * The request of one operation call, complete: placed and coerced by
 * `buildOperationRequest`, then with its written body read and assembled. A
 * parameter error or an unreadable file fails with the message the step
 * reports.
 */
export const buildCallRequest = (
  input: Parameters<typeof buildOperationRequest>[0]
): Effect.Effect<OperationRequest, WrittenBodyFileError, StorageService> => {
  const built = buildOperationRequest(input)
  return (
    built.ok
      ? completeWrittenBody(built.request)
      : Effect.fail(new WrittenBodyFileError({ message: built.error }))
  ).pipe(Effect.withSpan('automations.connection-call-request'))
}
