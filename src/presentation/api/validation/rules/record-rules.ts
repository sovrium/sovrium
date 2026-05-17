/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { deriveSlugFromBody, isValidSlugFormat } from '@/domain/utils/slug'
import { FieldFormatError, ValidationContext } from '../../middleware/validation'
import {
  validateReadonlyIdField,
  validateDefaultFields,
  validateRequiredFields,
  filterAllowedFields,
  validateFieldWritePermissions,
  validateFieldFormats,
  validateAttachmentConstraints,
  enrichAttachmentMetadata,
} from './field-rules'
import type { FieldValidationError, FieldPermissionError } from '../../middleware/validation'
import type { StorageService } from '@/application/ports/services/storage-service'

/**
 * US-PAGES-ACCESS-PUBLISHING-002 (slug-management). Validate any explicit
 * `slug` value on a slug-convention table against the slug format regex.
 *
 * Convention: a `slug: single-line-text` field plus a `title:
 * single-line-text` field declares CMS slug semantics. We deliberately
 * skip the validation when the `slug` field is absent from the table so
 * unrelated rows can still carry a column literally named `slug` without
 * inheriting the constraint.
 *
 * Auto-derived slugs always satisfy the regex by construction (see
 * `slugifyTitle` in domain/utils/slug.ts), so this step only inspects
 * caller-provided values.
 */
function validateSlugFormat(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldFormatError, ValidationContext> {
  return Effect.gen(function* () {
    if (!('slug' in fields)) return
    const value = fields['slug']
    if (typeof value !== 'string') return
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return
    const slugField = table.fields.find((f) => f.name === 'slug' && f.type === 'single-line-text')
    if (!slugField) return
    if (!isValidSlugFormat(value)) {
      return yield* Effect.fail(
        new FieldFormatError(
          `Invalid slug format for field 'slug': must be lowercase letters, digits, and hyphens (e.g. 'my-post')`,
          'slug'
        )
      )
    }
  })
}

/**
 * US-PAGES-ACCESS-PUBLISHING-002 (slug-management). Auto-derive a slug
 * from the `title` field when the body omits an explicit slug and the
 * table participates in the slug convention.
 *
 * Returns the original fields reference unchanged when the convention
 * does not apply, so non-CMS tables pay no overhead.
 */
function applySlugAutoDerive(
  fields: Record<string, unknown>
): Effect.Effect<Record<string, unknown>, never, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return fields
    const derived = deriveSlugFromBody(table.fields, fields)
    return derived === undefined ? fields : { ...fields, slug: derived }
  })
}

/**
 * Walk every `rich-text` field declared on the table schema and pass its HTML
 * value through {@link sanitizeRichTextHTML} (server-side defence in depth).
 *
 * Non-rich-text fields and missing values pass through unchanged.
 *
 * Asserted by APP-PAGES-CRUD-WYSIWYG-007 (script tags, on* attributes, and
 * javascript: URLs are stripped before persistence).
 */
function sanitizeRichTextFields(
  fields: Record<string, unknown>
): Effect.Effect<Record<string, unknown>, never, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return fields
    const richTextNames = new Set(
      table.fields.filter((f) => f.type === 'rich-text').map((f) => f.name)
    )
    const sanitized = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => {
        if (richTextNames.has(key) && typeof value === 'string') {
          return [key, sanitizeRichTextHTML(value)]
        }
        return [key, value]
      })
    )
    return sanitized
  })
}

/**
 * Validate fields for record creation
 * Composes all field-level validations
 */
export function validateRecordCreation(
  requestedFields: Record<string, unknown>
): Effect.Effect<
  Record<string, unknown>,
  FieldValidationError | FieldPermissionError | FieldFormatError,
  ValidationContext | StorageService
> {
  return Effect.gen(function* () {
    // Step 1: Check readonly 'id' field
    yield* validateReadonlyIdField(requestedFields)

    // Step 2: Check fields with default values
    yield* validateDefaultFields(requestedFields)

    // Step 3: Filter fields based on write permissions
    const { allowedData, forbiddenFields } = yield* filterAllowedFields(requestedFields)

    // Step 4: Check for forbidden fields
    yield* validateFieldWritePermissions(forbiddenFields)

    // Step 5: Slug-convention validation BEFORE auto-derive so an invalid
    // explicit slug fails fast with FieldFormatError (HTTP 422), without
    // being overwritten by an auto-derived value (US-PAGES-ACCESS-
    // PUBLISHING-002 / APP-PAGES-PUBLISHING-008).
    yield* validateSlugFormat(allowedData)

    // Step 6: Auto-derive slug from title when missing
    // (APP-PAGES-PUBLISHING-006). Pure transform — leaves the body
    // unchanged for non-CMS tables.
    const slugAppliedData = yield* applySlugAutoDerive(allowedData)

    // Step 7: Validate required fields (on allowed data, post-derive so
    // an auto-derived slug satisfies a `required: true` slug declaration)
    yield* validateRequiredFields(slugAppliedData)

    // Step 8: Validate field formats (URL, etc.)
    yield* validateFieldFormats(slugAppliedData)

    // Step 9: Validate attachment field constraints (allowedFileTypes)
    yield* validateAttachmentConstraints(slugAppliedData)

    // Step 10: Enrich attachment metadata when storeMetadata: true
    const enrichedData = yield* enrichAttachmentMetadata(slugAppliedData)

    // Step 11: Sanitize rich-text HTML before persistence (defence in depth)
    const sanitizedData = yield* sanitizeRichTextFields(enrichedData)

    return sanitizedData
  })
}

/**
 * Validate fields for record update
 * Similar to creation but without required field validation
 * @public
 */
export function validateRecordUpdate(
  requestedFields: Record<string, unknown>
): Effect.Effect<
  Record<string, unknown>,
  FieldValidationError | FieldPermissionError | FieldFormatError,
  ValidationContext
> {
  return Effect.gen(function* () {
    // Step 1: Check readonly 'id' field
    yield* validateReadonlyIdField(requestedFields)

    // Step 2: Check fields with default values
    yield* validateDefaultFields(requestedFields)

    // Step 3: Filter fields based on write permissions
    const { allowedData, forbiddenFields } = yield* filterAllowedFields(requestedFields)

    // Step 4: Check for forbidden fields
    yield* validateFieldWritePermissions(forbiddenFields)

    // Step 5: Slug-convention format validation. No auto-derive on update
    // — partial PATCH semantics, the caller controls the new slug
    // explicitly. (US-PAGES-ACCESS-PUBLISHING-002.)
    yield* validateSlugFormat(allowedData)

    // Note: No required field validation for updates (partial updates allowed)

    // Step 6: Sanitize rich-text HTML before persistence (defence in depth)
    const sanitizedData = yield* sanitizeRichTextFields(allowedData)

    return sanitizedData
  })
}
