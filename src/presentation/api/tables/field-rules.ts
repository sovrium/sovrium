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
import { validateAttachmentReferences as checkAttachmentReferences } from '@/application/use-cases/attachments/validate-attachment-references'
import { findColumnFormatViolations } from '@/domain/models/app/tables/column-formats-validation'
import { forbiddenWriteFields } from '@/domain/models/app/tables/field-write-permission-service'
import { isReadonlyComputedFieldType } from '@/domain/models/app/tables/fields'
import { findMissingRequiredFieldNames } from '@/domain/models/app/tables/required-fields-validation'
import { resolveStoragePublicAccess } from '@/domain/models/process-env/storage/storage-public-access'
import {
  FieldValidationError,
  FieldPermissionError,
  FieldFormatError,
  FieldStorageError,
  ValidationContext,
} from '../middleware/validation'
import type { FieldErrorDetail } from '../middleware/validation'
import type { StorageService } from '@/application/ports/services/storage-service'
import type {
  AttachmentRuleViolation,
  AttachmentStorageUnavailable,
} from '@/application/use-cases/attachments/errors'
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
 * Read-only-ness is TYPE-driven, NOT `default`-driven: a user-declared
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
    // (an API tables records create spec pins it), while `errors` names each one
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

    // The one field write rule every door asks (`forbiddenWriteFields`): an
    // admin-equivalent role owns every field; a field whose `write` rule names
    // an audience is the role's only when the rule names it; and a field with no
    // `write` rule is writable exactly when the caller may READ it, groups
    // included. A field the table does not declare is left to the existence
    // checks.
    const forbiddenFields = forbiddenWriteFields(
      ctx.app,
      ctx.tableName,
      { role: ctx.userRole, groups: ctx.userGroups },
      Object.fromEntries(
        Object.entries(fields).filter(([name]) => table?.fields?.some((f) => f.name === name))
      )
    )

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
 * `url` wording is spec-pinned byte-for-byte by an API tables records create spec /
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
 * An API tables records create spec pins the absence of the row, not merely the
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
 * operation that never produced one (503). The only place the two vocabularies
 * meet, so `VALIDATION_ERROR_ENVELOPES` decides every status and this file none.
 */
const toFieldError = (
  error: AttachmentRuleViolation | AttachmentStorageUnavailable
): FieldValidationError | FieldStorageError =>
  error._tag === 'AttachmentRuleViolation'
    ? new FieldValidationError(error.message, error.field)
    : new FieldStorageError(error.message, error.field, error.cause)

/** {@link toFieldError} for the program that can only fail on storage. */
const toFieldStorageError = (error: AttachmentStorageUnavailable): FieldStorageError =>
  new FieldStorageError(error.message, error.field, error.cause)

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
    yield* checkAttachmentConstraints({ scope: ctx, fields }).pipe(Effect.mapError(toFieldError))
  })
}

/**
 * Refuse a record write whose attachment columns reference a file outside the
 * column's bucket or outside the writer's reach (catalog row, catalog bucket,
 * bucket `download` permission — all three, one message).
 *
 * The refusal is a `FieldValidationError`, so it renders through the shared
 * field-scoped 400 envelope: the body names the column and never says which of
 * the three conditions failed. A visitor who is not signed in — the session's
 * identity says so, whatever her role is called — is treated as anonymous. A
 * catalog that cannot be read at all
 * is not a verdict and renders as the storage-unavailable 503.
 */
export function validateAttachmentReferences(
  fields: Record<string, unknown>
): Effect.Effect<
  void,
  FieldValidationError | FieldStorageError,
  ValidationContext | StorageService
> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    yield* checkAttachmentReferences({
      scope: ctx,
      fields,
      writer: ctx.signedOut
        ? { authenticated: false }
        : { authenticated: true, role: ctx.userRole },
      publicAccess: resolveStoragePublicAccess(),
    }).pipe(
      Effect.mapError((error) =>
        error._tag === 'AttachmentReferenceRefused'
          ? new FieldValidationError(error.message, error.field)
          : new FieldStorageError(error.message, error.field, error.cause)
      )
    )
  })
}

/** Store inline `{ name, content }` values in their column's bucket; non-base64 content is a 400. */
export function uploadInlineAttachmentContent(
  fields: Record<string, unknown>
): Effect.Effect<
  Record<string, unknown>,
  FieldValidationError | FieldStorageError,
  ValidationContext | StorageService
> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    return yield* persistInlineAttachments({ scope: ctx, fields }).pipe(
      Effect.mapError(toFieldError)
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
    return yield* writeAttachmentMetadata({ scope: ctx, fields }).pipe(
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
