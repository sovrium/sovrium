/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The per-field rules of a record write.
 *
 * Two kinds of rule live here and they are wired differently. The pure ones —
 * readonly columns, required fields, write permissions, declared formats —
 * delegate to a `domain/validators/` predicate and render its verdict into this
 * seam's error vocabulary. The attachment ones need storage, so they are
 * PROGRAMS in `application/use-cases/attachments/`; this file reads the request
 * scope off `ValidationContext`, calls one, and translates its refusal.
 *
 * Nothing here decides a status code. `VALIDATION_ERROR_ENVELOPES`
 * (`middleware/validation.ts`) is the single total map from error tag to wire
 * envelope, and it stays that way precisely so a new rule cannot invent a
 * fourth dialect on the way out.
 */

import { Effect } from 'effect'
import { enrichAttachmentMetadata as writeAttachmentMetadata } from '@/application/use-cases/attachments/enrich-attachment-metadata'
import { uploadInlineAttachmentContent as persistInlineAttachments } from '@/application/use-cases/attachments/upload-inline-attachments'
import { validateAttachmentConstraints as checkAttachmentConstraints } from '@/application/use-cases/attachments/validate-attachment-constraints'
import { isAdminEquivalent } from '@/domain/models/app'
import { hasPermission } from '@/domain/models/app/auth/permissions'
import { findColumnFormatViolations } from '@/domain/models/app/tables/column-formats-validation'
import { isReadonlyComputedFieldType } from '@/domain/models/app/tables/fields'
import { findMissingRequiredFieldNames } from '@/domain/models/app/tables/required-fields-validation'
import {
  FieldValidationError,
  FieldPermissionError,
  FieldFormatError,
  FieldStorageError,
  ValidationContext,
} from '../middleware/validation'
import type { FieldErrorDetail } from '../middleware/validation'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { AttachmentScope } from '@/application/use-cases/attachments/attachment-fields'
import type {
  AttachmentRuleViolation,
  AttachmentStorageUnavailable,
} from '@/application/use-cases/attachments/errors'
import type { App } from '@/domain/models/app'
import type { FormatConstrainedFieldType } from '@/domain/models/app/tables/column-formats-validation'

/**
 * Validate that 'id' field is not in the request (readonly)
 */
export function validateReadonlyIdField(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, never> {
  if ('id' in fields) {
    return Effect.fail(new FieldValidationError("Cannot write to readonly field 'id'", 'id'))
  }
  return Effect.void
}

/**
 * Reject direct writes to system-managed / computed field TYPES.
 *
 * Read-only-ness is TYPE-driven, NOT `default`-driven (GAP-10): a user-declared
 * `default` is an OVERRIDABLE fallback (the DB column gets a `DEFAULT` clause),
 * so a field merely carrying a `default` stays writable — supplying a value
 * overrides the default, omitting it applies the default. Only computed/
 * system-managed field TYPES (`formula`, `rollup`, `count`, `lookup`,
 * `autonumber`, `created-at`/`updated-at`/`created-by`/`updated-by`/
 * `deleted-at`/`deleted-by`) are genuinely readonly — they are DB-computed
 * (GENERATED ALWAYS / trigger / view) or platform-populated, so a direct write
 * would otherwise crash at the INSERT (500). Catch it here with a clean 4xx.
 *
 * Source of truth: {@link isReadonlyComputedFieldType}.
 */
export function validateReadonlyComputedFields(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)

    const readonlyComputedFields =
      table?.fields?.filter((f) => isReadonlyComputedFieldType(f.type)) ?? []

    // EVERY computed column the request tried to write, in table
    // field-declaration order — not just the first one found
    //.
    const attempted = readonlyComputedFields
      .filter((f) => f.name in fields)
      .map((f) => ({ field: f.name, message: `Cannot write to readonly field '${f.name}'` }))

    const firstAttempted = attempted[0]
    if (firstAttempted) {
      return yield* Effect.fail(
        new FieldValidationError(firstAttempted.message, firstAttempted.field, attempted)
      )
    }
  })
}

/**
 * Every required text field that is PRESENT but empty, in table
 * field-declaration order.
 *
 * The missing-field check in {@link validateRequiredFields} tests key presence
 * only (`!(field.name in fields)`), and `{ code: '' }` has the key — so without
 * this branch an empty string silently satisfies `required`. Whitespace is
 * trimmed first: '   ' supplies no value either.
 *
 * Emptiness is the WHOLE rule. AppSchema declares no minimum length for text
 * fields, so `required` can only ever mean "a value must be supplied", never
 * "a value must be N characters" — and the platform must not invent a boundary
 * the operator never configured. A one-character product code, initial, or
 * label is ordinary business data. The message
 * names the declared constraint, and matches the wording the client-side gate
 * already uses (`validateCrudInputs` in crud-form-island/submit-pipeline.ts),
 * so the two halves of the same rule read identically to the user.
 */
const findBlankRequiredFields = <
  F extends { readonly name: string; readonly type: string; readonly required?: boolean },
>(
  tableFields: readonly F[],
  fields: Record<string, unknown>
): readonly FieldErrorDetail[] =>
  tableFields
    .filter(
      (field) =>
        field.required &&
        field.type === 'single-line-text' &&
        field.name in fields &&
        typeof fields[field.name] === 'string' &&
        (fields[field.name] as string).trim().length === 0
    )
    .map((field) => ({ field: field.name, message: 'This field is required' }))

/**
 * Validate required fields are present
 */
export function validateRequiredFields(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)

    if (!table) return

    // The rule itself (key presence, primary-key and `default` exemptions) is
    // the single shared one — the upsert route asks the same question of the
    // same config and must get the same answer. Only the error ENVELOPE differs
    // between the routes, and that stays here.
    const missingRequiredFields = findMissingRequiredFieldNames(table, fields).map((name) => ({
      field: name,
      message: `Missing required field '${name}'`,
    }))

    // The complete list was always computed here; only the envelope discarded
    // it. The top-level `message` stays the generic 'Missing required fields'
    // ([internal ref] pins it), while `errors` names each one
    //.
    const firstMissing = missingRequiredFields[0]
    if (firstMissing) {
      return yield* Effect.fail(
        new FieldValidationError(
          'Missing required fields',
          firstMissing.field,
          missingRequiredFields
        )
      )
    }

    const blankRequiredFields = findBlankRequiredFields(table.fields, fields)

    const firstBlank = blankRequiredFields[0]
    if (firstBlank) {
      return yield* Effect.fail(
        new FieldValidationError(firstBlank.message, firstBlank.field, blankRequiredFields)
      )
    }
  })
}

/**
 * Check if a field permission restricts writing based on user role
 */
function hasWriteRoleRestriction(
  fieldPermission: { write?: 'all' | 'authenticated' | readonly string[] } | null | undefined,
  userRole: string
): boolean {
  const writePermission = fieldPermission?.write
  if (writePermission === undefined) return false
  return !hasPermission(writePermission, userRole)
}

/**
 * Filter fields based on write permissions
 * Returns only fields the user is allowed to write
 */
export function filterAllowedFields(
  fields: Record<string, unknown>
): Effect.Effect<
  { allowedData: Record<string, unknown>; forbiddenFields: readonly string[] },
  never,
  ValidationContext
> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)

    // Admin-equivalent roles (the app's resolved top role + the built-in `admin`
    // when it is not out-ranked) are unrestricted: they bypass field-level WRITE
    // permissions. A field marked `write: ['engineer']` restricts LOWER roles —
    // the engineer/admin OWNS every field. Uses the same canonical
    // `isAdminEquivalent` predicate as the read-side (`filterReadableFields`) and
    // row-level (`row-level-guard` isUnrestricted) bypass, so an engineer/admin
    // writing an engineer-only field via the records-API no longer 404s — and a
    // role bypasses writes exactly when it bypasses reads and row-level access.
    const isUnrestricted = isAdminEquivalent(ctx.userRole, ctx.app)

    // Get forbidden fields based on field-level permissions (functional filter pattern)
    const forbiddenFields: readonly string[] = isUnrestricted
      ? []
      : Object.keys(fields).filter((fieldName) => {
          const field = table?.fields?.find((f) => f.name === fieldName)
          if (!field) return false

          const fieldPermission = table?.permissions?.fields?.find((fp) => fp.field === fieldName)
          return hasWriteRoleRestriction(fieldPermission, ctx.userRole)
        })

    // Filter out forbidden fields. Reservation is TYPE-driven, never NAME-driven:
    // the genuinely readonly fields (`id`, and the computed/system-managed field
    // TYPES) are rejected LOUDLY upstream by `validateReadonlyIdField` /
    // `validateReadonlyComputedFields`. A name-based strip here would instead drop
    // the column silently and still report 201/200 — which is data loss, not
    // protection. Tenant isolation is by SCHEMA (`auth.*` / `system.*`), so an
    // app-declared column may use any name.
    const allowedData = Object.fromEntries(
      Object.entries(fields).filter(([fieldName]) => !forbiddenFields.includes(fieldName))
    )

    return { allowedData, forbiddenFields }
  })
}

/**
 * Developer-facing copy for each format violation, keyed by column type. The
 * `url` wording is spec-pinned byte-for-byte by [internal ref] /
 * -024 / -025; `email` mirrors its shape. Copy lives HERE rather than in the
 * shared domain rule because the public-form path phrases the same violation for
 * a stranger filling in a contact form, not for an API client.
 */
const FORMAT_MESSAGES: Readonly<Record<FormatConstrainedFieldType, (field: string) => string>> = {
  url: (field) => `Invalid URL format for field '${field}'`,
  email: (field) => `Invalid email format for field '${field}'`,
}

/**
 * Validate format-carrying column types (`email`, `url`) on the records path.
 *
 * The rule itself is {@link findColumnFormatViolations} in
 * `domain/validators/column-formats.ts`, shared with the form-submission path.
 * This function previously validated `url` and NOT `email`, while the forms path
 * validated `email` and NOT `url` — so `POST /api/tables/:id/records` with
 * `{ email: 'not-an-email' }` returned 201 and persisted the value (verified by
 * execution). Neither type compiles to a CHECK constraint, so nothing
 * downstream refused it.
 *
 * Every offender is reported, in table field-declaration order:
 * [internal ref] pins the absence of the row, not merely the
 * presence of an error, and CREATE-024 pins that all offenders are named.
 */
export function validateFieldFormats(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldFormatError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return

    const malformed = findColumnFormatViolations(table.fields, fields).map((violation) => ({
      field: violation.field,
      message: FORMAT_MESSAGES[violation.type](violation.field),
    }))

    const firstMalformed = malformed[0]
    if (firstMalformed) {
      return yield* Effect.fail(
        new FieldFormatError(firstMalformed.message, firstMalformed.field, malformed)
      )
    }
  })
}

// ---------------------------------------------------------------------------
// Attachment columns — thin wiring over the application programs
// ---------------------------------------------------------------------------

/**
 * Translate an attachment program's refusal into this seam's wire vocabulary.
 *
 * The two application errors and the two wire errors are the same distinction
 * seen from two sides: a verdict about the payload (400) versus a storage
 * operation that never produced one (503). The mapping is total and is the only
 * place the two vocabularies meet, so `VALIDATION_ERROR_ENVELOPES` keeps
 * deciding every status and this file decides none.
 */
const toFieldError = (
  error: AttachmentRuleViolation | AttachmentStorageUnavailable
): FieldValidationError | FieldStorageError =>
  error._tag === 'AttachmentRuleViolation'
    ? new FieldValidationError(error.message, error.field)
    : new FieldStorageError(error.message, error.field, error.cause)

/** {@link toFieldError} for the two programs that can only fail on storage. */
const toFieldStorageError = (error: AttachmentStorageUnavailable): FieldStorageError =>
  new FieldStorageError(error.message, error.field, error.cause)

/** The scope the attachment programs validate against, read off the request. */
const scopeOf = (ctx: { readonly app: App; readonly tableName: string }): AttachmentScope => ({
  app: ctx.app,
  tableName: ctx.tableName,
})

/**
 * Validate attachment field type constraints (`allowedFileTypes`, `maxFiles`,
 * `maxFileSize`).
 *
 * `allowedFileTypes` and `maxFiles` are decided from the storage key alone and
 * so stay enforceable while storage is down; `maxFileSize` needs the bytes, and
 * fails closed with {@link FieldStorageError} (503) when they cannot be read.
 */
export function validateAttachmentConstraints(
  fields: Record<string, unknown>
): Effect.Effect<
  void,
  FieldValidationError | FieldStorageError,
  ValidationContext | StorageService
> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    yield* checkAttachmentConstraints({ scope: scopeOf(ctx), fields }).pipe(
      Effect.mapError(toFieldError)
    )
  })
}

/**
 * Persist inline `{ name, content }` attachment payloads from a record-create
 * request and replace them with the canonical `{ key, name, mimeType, size }`
 * JSONB shape.
 */
export function uploadInlineAttachmentContent(
  fields: Record<string, unknown>
): Effect.Effect<Record<string, unknown>, FieldStorageError, ValidationContext | StorageService> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    return yield* persistInlineAttachments({ scope: scopeOf(ctx), fields }).pipe(
      Effect.mapError(toFieldStorageError)
    )
  })
}

/**
 * Enrich `single-attachment` columns declaring `storeMetadata: true`, replacing
 * the raw storage key with `{ filename, mimeType, size, url }`.
 *
 * Called as the final storage-touching step of record-creation validation.
 */
export function enrichAttachmentMetadata(
  fields: Record<string, unknown>
): Effect.Effect<Record<string, unknown>, FieldStorageError, ValidationContext | StorageService> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    return yield* writeAttachmentMetadata({ scope: scopeOf(ctx), fields }).pipe(
      Effect.mapError(toFieldStorageError)
    )
  })
}

/**
 * Validate field write permissions - fails if any forbidden fields found
 */
export function validateFieldWritePermissions(
  forbiddenFields: readonly string[]
): Effect.Effect<void, FieldPermissionError, never> {
  if (forbiddenFields.length > 0) {
    const firstForbiddenField = forbiddenFields[0]
    return Effect.fail(
      new FieldPermissionError(
        `Cannot write to field '${firstForbiddenField}': insufficient permissions`,
        firstForbiddenField
      )
    )
  }
  return Effect.void
}
