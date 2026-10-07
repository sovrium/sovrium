/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { placeholderNames } from './operation-body-service'
import type { ConnectionOperation } from './operations'

/**
 * Load-time checks of an operation body sent as written (`raw`,
 * `multipart-related`). Two mistakes would otherwise reach the wire silently:
 *
 *  1. A placeholder naming a parameter the operation does not declare `in:
 *     body` — it would always be filled with nothing, and the service would
 *     receive an empty name or a broken JSON document.
 *  2. A body or part carrying both `content` and `file`, or neither — there is
 *     no single payload to send.
 *
 * And three about a `file` parameter, which travels only in a field body: as a
 * file part of a `multipart` body, or inlined with `encoding: base64`.
 */

interface BodyPiece {
  readonly label: string
  readonly contentType: string
  readonly content?: string | undefined
  readonly file?: string | undefined
}

/** The pieces a written body sends: the body itself, or each of its parts. */
const piecesOf = (body: ConnectionOperation['body']): readonly BodyPiece[] => {
  if (body === undefined || typeof body === 'string') return []
  if (body.kind === 'raw') return [{ label: 'body', ...body }]
  return body.parts.map((part, index) => ({ label: `body part ${index + 1}`, ...part }))
}

/** Why one piece does not carry exactly one payload, or `undefined`. */
const payloadIssue = (piece: BodyPiece): string | undefined => {
  if (piece.content !== undefined && piece.file !== undefined) {
    return `${piece.label} declares both content and file; give exactly one`
  }
  if (piece.content === undefined && piece.file === undefined) {
    return `${piece.label} declares neither content nor file; give exactly one`
  }
  return undefined
}

/** The first placeholder of a piece naming no `in: body` parameter, or `undefined`. */
const placeholderIssue = (
  piece: BodyPiece,
  params: ConnectionOperation['params']
): string | undefined => {
  const templates = [piece.contentType, piece.content ?? '', piece.file ?? '']
  const stray = templates.flatMap(placeholderNames).find((name) => params?.[name]?.in !== 'body')
  return stray === undefined
    ? undefined
    : `${piece.label} placeholder '{{params.${stray}}}' names no parameter declared with in: body`
}

/**
 * Why a parameter's `file` type or `encoding` cannot travel, or `undefined`:
 * a `file` parameter outside the body, `encoding` on another type, or a `file`
 * parameter without `encoding` in a `json` or `form` body, which has no file
 * part to carry it.
 */
const fileParamIssue = (operation: ConnectionOperation): string | undefined =>
  Object.entries(operation.params ?? {})
    .map(([name, param]) => {
      if (param.type !== 'file') {
        return param.encoding === undefined
          ? undefined
          : `parameter '${name}' declares encoding, which only a type: file parameter takes`
      }
      if (param.in !== 'body') {
        return `file parameter '${name}' is sent in: ${param.in}; a file travels only in: body`
      }
      const kind = operation.body ?? 'json'
      return param.encoding === undefined && (kind === 'json' || kind === 'form')
        ? `file parameter '${name}' has no file part in a ${kind} body; declare encoding: base64 or send a multipart body`
        : undefined
    })
    .find((issue) => issue !== undefined)

/**
 * Why an operation's written body cannot be sent, or `undefined`. The message
 * names the connection and the operation; `operationsIssue` reports it.
 */
export const operationBodyIssue = (
  connectionName: string,
  operation: ConnectionOperation
): string | undefined => {
  const issue =
    fileParamIssue(operation) ??
    piecesOf(operation.body)
      .map((piece) => payloadIssue(piece) ?? placeholderIssue(piece, operation.params))
      .find((message) => message !== undefined)
  return issue === undefined
    ? undefined
    : `Connection '${connectionName}' operation '${operation.name}' ${issue}`
}
