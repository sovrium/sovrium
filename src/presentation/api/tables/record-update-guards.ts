/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { isRecordReadOnly } from '@/domain/models/app/tables/field-condition-evaluator-service'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { checkRecordUpdateValues, findReadonlyUpdateField } from './record-rules'
import { createValidationLayer, sanitizeRichTextFields } from './validation'
import type { App, Table } from '@/domain/models/app'
import type {
  FieldFormatError,
  FieldStorageError,
  FieldValidationError,
} from '@/presentation/api/tables/validation'
import type { Context } from 'hono'

/** Input for {@link checkFieldConditionReadOnly}. */
export interface FieldConditionCheckInput {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly recordId: string
}

/**
 * Reject a record update when a field `condition` has placed the record in a
 * read-only state (e.g. a `single-select` status of `completed` with
 * `conditions: [{ when: 'completed', then: { readOnly: true } }]`).
 *
 * Evaluated against the record's CURRENT stored value — fetched here — so a
 * locked record cannot be mutated through any field. Returns a `400` response
 * when locked, or `undefined` when the update may proceed.
 *
 */
export async function checkFieldConditionReadOnly(
  input: FieldConditionCheckInput
): Promise<Response | undefined> {
  const { c, table, session, tableName, recordId } = input
  const hasConditions = table?.fields?.some(
    (field) =>
      'conditions' in field && Array.isArray(field.conditions) && field.conditions.length > 0
  )
  if (!table || !hasConditions) return undefined

  const fetched = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  if (fetched._tag === 'Failure' || !fetched.success) return undefined

  if (isRecordReadOnly(table.fields, fetched.success as Readonly<Record<string, unknown>>)) {
    return c.json(
      {
        success: false,
        message: 'Cannot update record: a field condition has made this record read-only',
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }
  return undefined
}

/**
 * Reject an update that targets an engine-managed readonly column
 * (`id`, `created_at`, `updated_at`). Returns a `400` response or `undefined`.
 */
export function validateUpdateReadonlyFields(
  fields: Record<string, unknown>,
  c: Context
): Response | undefined {
  const attempted = findReadonlyUpdateField(fields)
  if (attempted === undefined) return undefined
  return c.json(
    {
      success: false,
      message: `Cannot write to readonly field '${attempted}'`,
      code: 'VALIDATION_ERROR',
    },
    400
  )
}

/** The request and payload a per-value update rule is evaluated against. */
export interface UpdateValueCheck {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly fields: Record<string, unknown>
}

/**
 * Every per-VALUE rule the update path enforces — `checkRecordUpdateValues`,
 * the one composition the MCP update tool runs too — on the request's domain
 * runtime (attachment confinement reads the storage catalog). Returns the first
 * violation for the caller to render through the shared
 * `formatValidationError`, which is what keeps the update path's wire shape and
 * statuses (422 format, 400 cardinality) from drifting from the create path's;
 * `undefined` when the update may proceed.
 *
 * @see [internal ref],
 */
export async function validateUpdateFieldValues(
  input: Readonly<UpdateValueCheck>
): Promise<FieldFormatError | FieldValidationError | FieldStorageError | undefined> {
  const { c, app, tableName, userRole, fields } = input
  const outcome = await Effect.runPromise(
    provideDomain(
      c,
      checkRecordUpdateValues(fields).pipe(
        Effect.provide(
          createValidationLayer(app, tableName, {
            role: userRole,
            groups: getTableContext(c).userGroups,
            signedOut: isGuestSession(getTableContext(c).session.userId),
          })
        )
      )
    ).pipe(Effect.result)
  )
  return outcome._tag === 'Failure' ? outcome.failure : undefined
}

/**
 * HTML-sanitize every `rich-text` column the payload supplies, returning the
 * field map to write. Returns the values to persist rather than a `Response`
 * or an error: unlike its sibling guards this one TRANSFORMS the write instead
 * of merely admitting or refusing it, so the caller must feed the result
 * forward — dropping it would leave the raw markup on the column while every
 * gate reported success.
 *
 * This runs the SAME rule as the create path — `sanitizeRichTextFields` over
 * the canonical `sanitizeRichTextHTML` (security rule S2, one sanitizer) —
 * rather than a second copy. That is the whole point: `POST
 * /api/tables/:t/records` scrubbed `<script>`, `on*` handlers and
 * `javascript:` URLs out of a `rich-text` column while `PATCH
 * /api/tables/:t/records/:id` persisted them verbatim, so one resource
 * enforced two different write contracts depending on the verb, and the
 * hostile markup reached the column that the record-field renderer and the
 * WYSIWYG form both read back.
 *
 * Only columns the payload SUPPLIES are inspected, which is what makes it safe
 * on a PARTIAL update — a row already holding legacy markup is left alone
 * until something writes to it.
 *
 * Scope is TYPE-driven: `long-text` and `single-line-text` are never rendered
 * as HTML and are left byte-identical, so ordinary prose containing angle
 * brackets survives a PATCH intact.
 *
 * Ordering: this runs AFTER the role/field-permission gates and after format
 * validation, matching the create path, so an unauthorized caller still gets
 * the S1 anti-enumeration 404 first.
 *
 * @see [internal ref],
 */
export async function sanitizeUpdateRichTextFields(
  app: App,
  tableName: string,
  writer: Parameters<typeof createValidationLayer>[2],
  fields: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return Effect.runPromise(
    sanitizeRichTextFields(fields).pipe(
      Effect.provide(createValidationLayer(app, tableName, writer))
    )
  )
}

/**
 * Reject an update that targets a field the user's role cannot write
 * (per field-level permissions). `user_id` is system-protected and silently
 * ignored. Returns a `404` response (S1 anti-enumeration — the
 * field-permission boundary is not discoverable; field name is dropped) or
 * `undefined`.
 */
export function validateUpdateForbiddenFields(
  forbiddenFields: readonly string[],
  c: Context
): Response | undefined {
  const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])
  const attempted = forbiddenFields.filter((field) => !SYSTEM_PROTECTED_FIELDS.has(field))
  if (attempted.length === 0) return undefined
  return notFound(c)
}
