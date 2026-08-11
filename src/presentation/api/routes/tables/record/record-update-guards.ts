/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { rawGetRecordProgram } from '@/application/use-cases/tables/programs'
import { isRecordReadOnly } from '@/domain/validators/field-condition-evaluator'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import {
  createValidationLayer,
  sanitizeRichTextFields,
  validateFieldFormats,
  validateMultiSelectOptions,
  validateMultiSelectSelectionLimits,
} from '@/presentation/api/validation'
import type { App, Table } from '@/domain/models/app'
import type { getTableContext } from '@/presentation/api/utils/context-helpers'
import type { FieldFormatError, FieldValidationError } from '@/presentation/api/validation'
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
  if (fetched._tag === 'Left' || !fetched.right) return undefined

  if (isRecordReadOnly(table.fields, fetched.right as Readonly<Record<string, unknown>>)) {
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
  const READONLY_FIELDS = new Set(['id', 'created_at', 'updated_at'])
  const attempted = Object.keys(fields).filter((field) => READONLY_FIELDS.has(field))
  if (attempted.length === 0) return undefined
  return c.json(
    {
      success: false,
      message: `Cannot write to readonly field '${attempted[0]!}'`,
      code: 'VALIDATION_ERROR',
    },
    400
  )
}

/**
 * Detect an update carrying a value that violates its column's declared format
 * (`email`, `url`). Returns the violation, or `undefined` when every supplied
 * value is well-formed.
 *
 * Unlike its sibling guards this returns the ERROR rather than a `Response`:
 * the caller renders it through the shared `formatValidationError`, which is
 * what pins the status at 422 and emits the `code`/`field`/`errors` envelope
 * the crud-form island decodes. Keeping the rendering in one place is why the
 * update path cannot drift from the create path's wire shape.
 *
 * This runs the SAME rule as the create path — `validateFieldFormats` over
 * `findColumnFormatViolations` — rather than a second copy. That is the whole
 * point: `POST /api/tables/:t/records` refused a malformed address while
 * `PATCH /api/tables/:t/records/:id` accepted it, so one resource enforced two
 * different contracts depending on the verb, and the malformed value reached
 * the column anyway. Neither `email` nor `url` compiles to a CHECK constraint
 * (`sql-type-mappings.ts` emits a bare VARCHAR(255)/TEXT), so nothing
 * downstream refused it either.
 *
 * Only columns the payload SUPPLIES are inspected — that property lives in the
 * shared rule and is what makes it safe on a PARTIAL update. A row already
 * holding a malformed legacy value stays editable through its other columns;
 * validating absent columns would escalate old data into a hard write outage
 * on every row that predates the rule.
 *
 * Ordering: this runs AFTER the role/field-permission gates, matching the
 * create path, so an unauthorized caller still gets the S1 anti-enumeration
 * 404 and never learns whether their value would have been well-formed.
 *
 */
async function validateUpdateFieldFormats(
  app: App,
  tableName: string,
  userRole: string,
  fields: Record<string, unknown>
): Promise<FieldFormatError | undefined> {
  const result = await Effect.runPromise(
    validateFieldFormats(fields).pipe(
      Effect.provide(createValidationLayer(app, tableName, userRole)),
      Effect.either
    )
  )
  return result._tag === 'Left' ? result.left : undefined
}

/**
 * Detect an update carrying a `multi-select` value that is not a declared
 * option, or that selects more options than `maxSelections` permits. Returns
 * the violation, or `undefined` when every supplied selection is admissible.
 *
 * Like {@link validateUpdateFieldFormats} this returns the ERROR rather than a
 * `Response`, so the caller renders it through the shared
 * `formatValidationError` — which is what keeps the update path's wire shape
 * from drifting from the create path's, and what assigns each violation its
 * status: 422 for membership (`FieldFormatError`), 400 for cardinality
 * (`FieldValidationError`).
 *
 * This runs the SAME rules as the create path rather than a second copy. That
 * is the whole point: the update path needed its own explicit call because
 * `PATCH` does not traverse `validateRecordCreation`, so fixing create alone
 * left this hole open — exactly as it did for `email`/`url` before. Before this
 * guard existed, `PATCH` with an undeclared option returned 200 and OVERWROTE
 * the column on SQLite, which carries no member CHECK; on PostgreSQL it reached
 * the driver and was answered from the DB seam, naming no column.
 *
 * Refusing HERE is what makes the two engines agree, and it is deliberately a
 * pre-validation rather than a nicer rendering of the driver's complaint: a
 * value the operator never declared is a client error, so it should never
 * become a database error in the first place.
 *
 * Cardinality is enforced on this verb too, though only the create path has a
 * dedicated spec: `maxSelections` a `PATCH` could exceed at will would be no
 * cap at all.
 *
 * Only columns the payload SUPPLIES are inspected — that property lives in the
 * shared rule and is what makes it safe on a PARTIAL update. A row already
 * holding an undeclared legacy value stays editable through its other columns.
 *
 * Ordering: this runs AFTER the role/field-permission gates, matching the
 * create path, so an unauthorized caller still gets the S1 anti-enumeration
 * 404 and never learns whether their selection would have been accepted.
 *
 */
async function validateUpdateMultiSelectValues(
  app: App,
  tableName: string,
  userRole: string,
  fields: Record<string, unknown>
): Promise<FieldFormatError | FieldValidationError | undefined> {
  const layer = createValidationLayer(app, tableName, userRole)
  const membership = await Effect.runPromise(
    validateMultiSelectOptions(fields).pipe(Effect.provide(layer), Effect.either)
  )
  if (membership._tag === 'Left') return membership.left
  const cardinality = await Effect.runPromise(
    validateMultiSelectSelectionLimits(fields).pipe(Effect.provide(layer), Effect.either)
  )
  return cardinality._tag === 'Left' ? cardinality.left : undefined
}

/**
 * Every per-VALUE rule the update path enforces, in create-path order: column
 * formats first, then `multi-select` membership, then `multi-select`
 * cardinality. Returns the first violation, or `undefined` when the update may
 * proceed.
 *
 * Exposed as ONE call so the route handler cannot acquire a new value rule
 * without acquiring its update-path enforcement at the same time — which is the
 * failure mode this whole seam exists to prevent, twice over now (`email`/`url`
 * once, `multi-select` again).
 */
export async function validateUpdateFieldValues(
  app: App,
  tableName: string,
  userRole: string,
  fields: Record<string, unknown>
): Promise<FieldFormatError | FieldValidationError | undefined> {
  const formatError = await validateUpdateFieldFormats(app, tableName, userRole, fields)
  if (formatError) return formatError
  return validateUpdateMultiSelectValues(app, tableName, userRole, fields)
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
  userRole: string,
  fields: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return Effect.runPromise(
    sanitizeRichTextFields(fields).pipe(
      Effect.provide(createValidationLayer(app, tableName, userRole))
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
  return c.json(
    {
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
    404
  )
}
