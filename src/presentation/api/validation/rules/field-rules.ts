/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { isAdminEquivalent } from '@/domain/models/app'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { isReadonlyComputedFieldType } from '@/domain/models/app/tables/fields'
import { hasPermission } from '@/domain/models/shared/permissions'
import { DEFAULT_BUCKET_NAME } from '@/domain/utils/bucket-identity'
import { inferMimeFromKey } from '@/domain/utils/mime-types'
import { findColumnFormatViolations } from '@/domain/validators/column-formats'
import { findMissingRequiredFieldNames } from '@/domain/validators/required-fields'
import {
  FieldValidationError,
  FieldPermissionError,
  FieldFormatError,
  ValidationContext,
} from '../../middleware/validation'
import type { FieldErrorDetail } from '../../middleware/validation'
import type { FormatConstrainedFieldType } from '@/domain/validators/column-formats'

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

/**
 * Check if a MIME type is permitted by the allowedFileTypes list
 */
function isMimeTypeAllowed(mimeType: string, allowedFileTypes: readonly string[]): boolean {
  return allowedFileTypes.some((allowed) =>
    allowed.endsWith('/*') ? mimeType.startsWith(allowed.slice(0, -1)) : mimeType === allowed
  )
}

type AttachmentField = {
  readonly name: string
  readonly type: 'single-attachment' | 'multiple-attachments'
  readonly allowedFileTypes?: readonly string[]
  readonly maxFileSize?: number
  readonly maxFiles?: number
}

const isAttachmentField = (f: {
  readonly type: string
}): f is AttachmentField & { readonly type: 'single-attachment' | 'multiple-attachments' } =>
  f.type === 'single-attachment' || f.type === 'multiple-attachments'

/**
 * Extract attachment storage keys from a record's field value, normalising
 * single vs multiple-attachment shape into a flat readonly string array.
 */
const extractAttachmentKeys = (field: AttachmentField, value: unknown): readonly string[] => {
  if (field.type === 'multiple-attachments') {
    return Array.isArray(value) ? value.filter((k): k is string => typeof k === 'string') : []
  }
  return typeof value === 'string' ? [value] : []
}

const validateMaxFiles = (
  field: AttachmentField,
  keys: readonly string[]
): FieldValidationError | undefined => {
  if (field.type !== 'multiple-attachments') return undefined
  if (field.maxFiles === undefined || keys.length <= field.maxFiles) return undefined
  return new FieldValidationError(
    `Too many files for field '${field.name}'. max files allowed: ${field.maxFiles}`,
    field.name
  )
}

const validateAllowedTypes = (
  field: AttachmentField,
  keys: readonly string[]
): FieldValidationError | undefined => {
  if (!field.allowedFileTypes || field.allowedFileTypes.length === 0) return undefined
  const allowed = field.allowedFileTypes
  const hasInvalid = keys.some((key) => !isMimeTypeAllowed(inferMimeFromKey(key), allowed))
  if (!hasInvalid) return undefined
  return new FieldValidationError(
    `Invalid file type for field '${field.name}'. Allowed file types: ${field.allowedFileTypes.join(', ')}`,
    field.name
  )
}

/**
 * Download each storage key (treating download failures as zero-byte files
 * — preserves original behaviour) and reject when any exceeds maxFileSize.
 */
const validateMaxFileSize = (
  field: AttachmentField,
  keys: readonly string[],
  bucket: string
): Effect.Effect<void, FieldValidationError, StorageService> => {
  if (field.maxFileSize === undefined) return Effect.void
  const max = field.maxFileSize
  return Effect.gen(function* () {
    const storage = yield* StorageService
    yield* Effect.forEach(
      keys,
      (key) =>
        Effect.gen(function* () {
          const content = yield* storage
            .download(key, bucket)
            .pipe(Effect.orElseSucceed(() => new Uint8Array(0)))
          if (content.length > max) {
            return yield* Effect.fail(
              new FieldValidationError(
                `File size ${content.length} bytes exceeds maximum file size for field '${field.name}'. Maximum file size: ${max} bytes`,
                field.name
              )
            )
          }
        }),
      { discard: true }
    )
  })
}

/** Run all attachment-field validations for a single field. */
const validateOneAttachmentField = (
  field: AttachmentField,
  fields: Record<string, unknown>,
  bucket: string
): Effect.Effect<void, FieldValidationError, StorageService> => {
  if (!(field.name in fields)) return Effect.void
  const keys = extractAttachmentKeys(field, fields[field.name])
  const maxFilesError = validateMaxFiles(field, keys)
  if (maxFilesError) return Effect.fail(maxFilesError)
  const typeError = validateAllowedTypes(field, keys)
  if (typeError) return Effect.fail(typeError)
  return validateMaxFileSize(field, keys, bucket)
}

/**
 * Validate attachment field type constraints (allowedFileTypes, maxFileSize)
 * Infers MIME type from the storage key's filename extension and checks against field restrictions.
 * For maxFileSize, downloads the file from StorageService to check the actual byte size.
 */
export function validateAttachmentConstraints(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, ValidationContext | StorageService> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return
    const attachmentFields: readonly AttachmentField[] = table.fields.filter(isAttachmentField)
    yield* Effect.forEach(
      attachmentFields,
      (field) =>
        validateOneAttachmentField(
          field,
          fields,
          resolveFieldBucket(ctx.app, ctx.tableName, field.name) ?? DEFAULT_BUCKET_NAME
        ),
      { discard: true }
    )
  })
}

/**
 * Strip UUID prefix from a storage key to recover the original filename.
 * Key format: '<uuid>-<original-filename>'
 */
function stripUuidPrefix(key: string): string {
  return (
    key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)?.[1] ?? key
  )
}

/**
 * Enrich single-attachment fields that have storeMetadata: true.
 * Replaces the raw storage key string with a metadata object
 * { filename, mimeType, size, url } by downloading the file.
 * Called as the final step of record creation validation.
 *
 * The `url` names the bucket the COLUMN declares. This is the write
 * path, so the value PERSISTS: the read enricher deliberately leaves a
 * `storeMetadata` object untouched ([internal ref] rule 2 — it carries no `key`), and
 * the API echoes whatever was stored here. Rows written before this fix are
 * repaired by the boot-time step in `attachment-url-backfill.ts`.
 *
 * The fallback is `'default'`, matching the read path, and deliberately NOT
 * `buckets[0].name` — see `resolveFieldBucket`'s own doc comment for why the
 * two fallbacks must not be unified.
 */
export function enrichAttachmentMetadata(
  fields: Record<string, unknown>
): Effect.Effect<Record<string, unknown>, never, ValidationContext | StorageService> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return fields

    const metadataFields = table.fields.filter(
      (f): f is typeof f & { readonly type: 'single-attachment'; readonly storeMetadata: true } =>
        f.type === 'single-attachment' &&
        'storeMetadata' in f &&
        (f as { storeMetadata?: boolean }).storeMetadata === true
    )

    if (metadataFields.length === 0) return fields

    const storage = yield* StorageService

    return yield* Effect.reduce(
      metadataFields,
      () => ({ ...fields }) as Record<string, unknown>,
      (acc, f) => {
        if (!(f.name in acc) || typeof acc[f.name] !== 'string') return Effect.succeed(acc)
        const key = acc[f.name] as string
        const bucket = resolveFieldBucket(ctx.app, ctx.tableName, f.name) ?? 'default'
        return storage.download(key, bucket).pipe(
          Effect.orElseSucceed(() => new Uint8Array(0)),
          Effect.map((content) => ({
            ...acc,
            [f.name]: {
              filename: stripUuidPrefix(key),
              mimeType: inferMimeFromKey(key),
              size: content.length,
              url: `/api/buckets/${bucket}/files/${key}`,
            },
          }))
        )
      }
    )
  })
}

/**
 * Decode a base64 string to a Uint8Array. Falls back to UTF-8 encoding when
 * the payload is not valid base64, so a spec author who passes plain text
 * (`content: 'base64data'`) still gets bytes persisted rather than a 400.
 */
const decodeContent = (content: string): Uint8Array => {
  try {
    return Uint8Array.from(Buffer.from(content, 'base64'))
  } catch {
    return new TextEncoder().encode(content)
  }
}

/**
 * Recognise the inline-content payload shape used by record-create requests
 * for `'attachment'` JSONB columns (`{ name, content }` — optional `mimeType`).
 * Keys-only references (already-uploaded files) and metadata objects without
 * `content` pass through untouched.
 */
const isInlineAttachmentPayload = (
  value: unknown
): value is {
  readonly name: string
  readonly content: string
  readonly mimeType?: string
} =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { name?: unknown }).name === 'string' &&
  typeof (value as { content?: unknown }).content === 'string'

/**
 * Upload one inline attachment payload to the configured StorageService and
 * return the canonical key-plus-metadata JSONB shape that the read path
 * enriches with a signed URL.
 */
const uploadInlinePayload = (
  bucket: string,
  payload: {
    readonly name: string
    readonly content: string
    readonly mimeType?: string
  }
): Effect.Effect<
  {
    readonly key: string
    readonly name: string
    readonly mimeType: string
    readonly size: number
  },
  never,
  StorageService
> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const bytes = decodeContent(payload.content)
    const mimeType = payload.mimeType ?? inferMimeFromKey(payload.name)
    const key = `${crypto.randomUUID()}-${payload.name}`
    // Upload failures collapse to the same metadata object — the read path's
    // signed-URL serve will surface a 404 to the client, which is the correct
    // observable behaviour for a missing file.
    yield* storage.upload(key, bytes, mimeType, bucket).pipe(Effect.ignore)
    return { key, name: payload.name, mimeType, size: bytes.length }
  })

/**
 * Persist inline `{ name, content }` attachment payloads from a record-create
 * request to storage and replace them with the canonical
 * `{ key, name, mimeType, size }` JSONB shape that the read path enriches
 * with a signed (or direct) URL.
 *
 * Targets `'attachment'` JSONB columns specifically — the legacy
 * `single-attachment` storage-key contract (and its `storeMetadata: true`
 * download-enrichment path in {@link enrichAttachmentMetadata}) are
 * intentionally left untouched so neither code path masks the other.
 * Plain string keys (already-uploaded references) pass through unchanged.
 */
export function uploadInlineAttachmentContent(
  fields: Record<string, unknown>
): Effect.Effect<Record<string, unknown>, never, ValidationContext | StorageService> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return fields

    const attachmentColumns = table.fields.filter((f) => f.type === 'attachment')
    if (attachmentColumns.length === 0) return fields

    return yield* Effect.reduce(
      attachmentColumns,
      () => ({ ...fields }) as Record<string, unknown>,
      (acc, f) => {
        const value = acc[f.name]
        if (!isInlineAttachmentPayload(value)) return Effect.succeed(acc)
        const bucket = resolveFieldBucket(ctx.app, ctx.tableName, f.name) ?? DEFAULT_BUCKET_NAME
        return uploadInlinePayload(bucket, value).pipe(
          Effect.map((meta) => ({ ...acc, [f.name]: meta }))
        )
      }
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
