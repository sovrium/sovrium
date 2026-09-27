/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Attachment-reference confinement for form submissions.
 *
 * A form bound to a table writes a record, so a submission that NAMES a stored
 * file is held to the rule a record write is held to: the file must be
 * catalogued under the column's bucket and downloadable by the submitter. The
 * rule itself is `validateAttachmentReferences`; this module only decides what
 * a submission exposes to it.
 *
 * Two things are exempt by construction. Fields whose files this multipart body
 * uploads itself are stored into the column's bucket by the request being
 * validated, so they are skipped by name. Inline `{ name, content }` payloads
 * are skipped by the rule. Every other field — JSON or multipart — is checked,
 * because a plain-text key travels as easily in either.
 *
 * The refusal is a `FieldValidationError`, so the submission route answers it
 * through its ordinary field-validation 400. A catalog outage is returned as is
 * and lands in the route's generic rejection branch instead.
 */

import { Effect } from 'effect'
import { validateAttachmentReferences } from '@/application/use-cases/attachments/validate-attachment-references'
import { resolveStoragePublicAccess } from '@/domain/models/process-env/storage/storage-public-access'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { FieldValidationError } from '@/presentation/api/middleware/validation'
import type { AttachmentStorageUnavailable } from '@/application/use-cases/attachments/errors'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { FormRequestSession } from '@/presentation/api/forms/access-gate'
import type { Context } from 'hono'

/** The subset of the submission the bound table would receive. */
const boundColumnValues = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  const columns = new Set(
    form.fields.flatMap((field) => (field.kind === 'table-field' ? [field.column] : []))
  )
  return Object.fromEntries(Object.entries(body).filter(([name]) => columns.has(name)))
}

/** Input to {@link checkSubmissionAttachmentReferences}. */
export interface SubmissionReferenceCheck {
  readonly c: Context
  readonly app: App
  readonly form: Form
  /** The body the bound-table write will receive. */
  readonly body: Readonly<Record<string, unknown>>
  /** Fields whose files this request uploaded itself (multipart). */
  readonly uploadedFields: ReadonlySet<string>
  readonly session: FormRequestSession | undefined
}

/**
 * Refuse a submission whose bound attachment columns reference a file outside
 * the column's bucket or the submitter's download reach. `undefined` when the
 * form writes no table or every reference is admissible.
 */
export async function checkSubmissionAttachmentReferences(
  input: Readonly<SubmissionReferenceCheck>
): Promise<FieldValidationError | AttachmentStorageUnavailable | undefined> {
  const tableName = input.form.submitTo.table
  if (typeof tableName !== 'string') return undefined
  const outcome = await Effect.runPromise(
    provideDomain(
      input.c,
      validateAttachmentReferences({
        scope: { app: input.app, tableName },
        fields: boundColumnValues(input.form, input.body),
        writer:
          input.session === undefined
            ? { authenticated: false }
            : { authenticated: true, role: input.session.role },
        publicAccess: resolveStoragePublicAccess(),
        exemptFields: input.uploadedFields,
      })
    ).pipe(Effect.result)
  )
  if (outcome._tag === 'Success') return undefined
  const { failure } = outcome
  // A catalog that could not be read is not a verdict about the reference, so
  // it is NOT rendered as the field refusal: it reaches the route's generic
  // rejection branch, which logs it.
  return failure._tag === 'AttachmentReferenceRefused'
    ? new FieldValidationError(failure.message, failure.field)
    : failure
}
