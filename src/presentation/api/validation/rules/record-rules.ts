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
  validateReadonlyComputedFields,
  validateRequiredFields,
  filterAllowedFields,
  validateFieldWritePermissions,
  validateFieldFormats,
  validateAttachmentConstraints,
  enrichAttachmentMetadata,
  uploadInlineAttachmentContent,
} from './field-rules'
import type { FieldValidationError, FieldPermissionError } from '../../middleware/validation'
import type { StorageService } from '@/application/ports/services/storage-service'

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

export function validateRecordCreation(
  requestedFields: Record<string, unknown>
): Effect.Effect<
  Record<string, unknown>,
  FieldValidationError | FieldPermissionError | FieldFormatError,
  ValidationContext | StorageService
> {
  return Effect.gen(function* () {
    yield* validateReadonlyIdField(requestedFields)

    yield* validateReadonlyComputedFields(requestedFields)

    const { allowedData, forbiddenFields } = yield* filterAllowedFields(requestedFields)

    yield* validateFieldWritePermissions(forbiddenFields)

    yield* validateSlugFormat(allowedData)

    const slugAppliedData = yield* applySlugAutoDerive(allowedData)

    yield* validateRequiredFields(slugAppliedData)

    yield* validateFieldFormats(slugAppliedData)

    yield* validateAttachmentConstraints(slugAppliedData)

    const persistedData = yield* uploadInlineAttachmentContent(slugAppliedData)

    const enrichedData = yield* enrichAttachmentMetadata(persistedData)

    const sanitizedData = yield* sanitizeRichTextFields(enrichedData)

    return sanitizedData
  })
}

export function validateRecordUpdate(
  requestedFields: Record<string, unknown>
): Effect.Effect<
  Record<string, unknown>,
  FieldValidationError | FieldPermissionError | FieldFormatError,
  ValidationContext
> {
  return Effect.gen(function* () {
    yield* validateReadonlyIdField(requestedFields)

    yield* validateReadonlyComputedFields(requestedFields)

    const { allowedData, forbiddenFields } = yield* filterAllowedFields(requestedFields)

    yield* validateFieldWritePermissions(forbiddenFields)

    yield* validateSlugFormat(allowedData)


    const sanitizedData = yield* sanitizeRichTextFields(allowedData)

    return sanitizedData
  })
}
