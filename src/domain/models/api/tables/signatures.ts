/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

/**
 * API contract for `POST /api/tables/:tableId/records/:recordId/signatures/:field`
 * — a signed-in person signs a `signature` field of a record she may write,
 * from a `signature-pad` on a page.
 *
 * **Which statement.** The request names the page the pad was shown on
 * (`page`) and the digest of the statement the reader saw
 * (`statementDigest`). The server resolves the statement of every
 * `signature-pad` of that page bound to this field, against the record as the
 * caller may read it now, and accepts the signature only when one of them
 * hashes to the digest; otherwise it answers 409 `STATEMENT_CHANGED` and the
 * page reloads. The stored statement is the server's, never text from the
 * request.
 *
 * **Refusals.** 404 when the caller may not write the field, the record or
 * the page does not exist, or the field is owned by a signing flow (signed
 * through its links only). The multipart `image` part follows the same limits
 * as the signing route.
 */
export const inlineSignRequestFieldsSchema = Schema.Struct({
  consent: Schema.Literal('true').annotate({
    description: 'The signer agreed to the statement; anything else is refused',
  }),
  method: Schema.Literals(['drawn', 'typed']).annotate({
    description: 'Whether the mark was drawn or typed',
  }),
  typedName: optionalField(
    Schema.String.annotate({ description: 'The typed name, when method is typed' }).pipe(
      Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200))
    )
  ),
  page: Schema.String.annotate({
    description: 'Name of the declared page the signature-pad was shown on',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  statementDigest: Schema.String.annotate({
    description: 'SHA-256 (lowercase hex) of the statement exactly as the reader saw it',
  }).pipe(Schema.check(Schema.isPattern(/^[0-9a-f]{64}$/))),
}).annotate({ identifier: 'InlineSignRequestFields' })

/** @public */
export type InlineSignRequestFields = typeof inlineSignRequestFieldsSchema.Type
