/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'
import { sha256Hex } from './common'
import { evidenceFileSchema } from './evidence'

/**
 * API contract for `GET /api/signatures/requests/:requestId/export` — a
 * self-contained bundle a third party checks offline with
 * `sovrium signature verify <export>`, and the report that command prints.
 *
 * The bundle is ONE JSON document ({@link exportManifestSchema}): the evidence
 * file and every file it covers, each with its role, its SHA-256 and its bytes
 * in base64. One document needs no archive format on either side, and a third
 * party can read it with any JSON tool. Verification never contacts the server.
 */

export const EXPORT_FORMAT = 'sovrium-signature-export'
export const EXPORT_FORMAT_VERSION = 1

export const exportFileSchema = Schema.Struct({
  path: Schema.String.annotate({ description: 'Name of the file within the bundle' }),
  role: Schema.Literals(['frozen-document', 'signed-document', 'proof', 'mark']).annotate({
    description: 'What the file is',
  }),
  sha256: sha256Hex(
    'SHA-256 of the file bytes; the event that wrote the file records the same digest in the chain'
  ),
  contentBase64: Schema.String.annotate({ description: 'The file bytes, base64' }),
}).annotate({ identifier: 'SignatureExportFile' })

export const exportManifestSchema = Schema.Struct({
  format: Schema.Literal(EXPORT_FORMAT),
  version: Schema.Literal(EXPORT_FORMAT_VERSION),
  evidence: evidenceFileSchema,
  files: Schema.Array(exportFileSchema),
}).annotate({ identifier: 'SignatureExportManifest' })

/** @public */
export type ExportManifest = typeof exportManifestSchema.Type

/** Every check `sovrium signature verify` runs, in order. */
export const VERIFY_CHECKS = [
  'manifest',
  'files',
  'chain',
  'document',
  'signatures',
  'seal',
  'timestamp',
] as const

export const verifyCheckSchema = Schema.Struct({
  check: Schema.Literals(VERIFY_CHECKS),
  outcome: Schema.Literals(['pass', 'fail', 'absent', 'untrusted']).annotate({
    description:
      'absent when the request carries no seal or no timestamp; untrusted when a seal or a timestamp verifies but its certificate leads to no root the verifier was given',
  }),
  detail: optionalField(Schema.String.annotate({ description: 'Why a check failed' })),
}).annotate({ identifier: 'SignatureVerifyCheck' })

export const verifyReportSchema = Schema.Struct({
  valid: Schema.Boolean.annotate({
    description:
      'No check failed: each passed, is absent or is untrusted; exit code 0 exactly when true',
  }),
  requestId: Schema.String.annotate({ description: 'The request the bundle belongs to' }),
  events: Schema.Finite.annotate({ description: 'Events in the chain' }),
  erasures: Schema.Finite.annotate({ description: 'Erasure events in the chain' }),
  checks: Schema.Array(verifyCheckSchema),
}).annotate({ identifier: 'SignatureVerifyReport' })

/** @public */
export type VerifyReport = typeof verifyReportSchema.Type
