/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { hasPermission } from '@/domain/models/app/tables/permissions'
import { inferMimeFromKey } from '@/domain/utils/mime-types'
import {
  FieldValidationError,
  FieldPermissionError,
  FieldFormatError,
  ValidationContext,
} from '../../middleware/validation'

export function validateReadonlyIdField(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, never> {
  if ('id' in fields) {
    return Effect.fail(new FieldValidationError("Cannot write to readonly field 'id'", 'id'))
  }
  return Effect.void
}

export function validateDefaultFields(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)

    const fieldsWithDefaults =
      table?.fields?.filter((f) => 'default' in f && f.default !== undefined) ?? []

    const attemptedDefaultField = fieldsWithDefaults.find((f) => f.name in fields)

    if (attemptedDefaultField) {
      return yield* Effect.fail(
        new FieldValidationError(
          `Cannot write to readonly field '${attemptedDefaultField.name}'`,
          attemptedDefaultField.name
        )
      )
    }
  })
}

export function validateRequiredFields(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)

    if (!table) return

    const primaryKeyFields = new Set(
      table.primaryKey?.fields ?? (table.primaryKey?.field ? [table.primaryKey.field] : [])
    )

    const autoInjectedFields = new Set<string>([])

    const missingRequiredFields = table.fields
      .filter(
        (field) =>
          field.required &&
          !(field.name in fields) &&
          !primaryKeyFields.has(field.name) &&
          !autoInjectedFields.has(field.name)
      )
      .map((field) => field.name)

    if (missingRequiredFields.length > 0) {
      return yield* Effect.fail(
        new FieldValidationError(
          'Missing required fields',
          missingRequiredFields[0]
        )
      )
    }

    const tooShortField = table.fields.find(
      (field) =>
        field.required &&
        field.type === 'single-line-text' &&
        field.name in fields &&
        typeof fields[field.name] === 'string' &&
        (fields[field.name] as string).trim().length < 2
    )

    if (tooShortField) {
      return yield* Effect.fail(
        new FieldValidationError('This field is too short', tooShortField.name)
      )
    }
  })
}

function hasWriteRoleRestriction(
  fieldPermission: { write?: 'all' | 'authenticated' | readonly string[] } | null | undefined,
  userRole: string
): boolean {
  const writePermission = fieldPermission?.write
  if (writePermission === undefined) return false
  return !hasPermission(writePermission, userRole)
}

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

    const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])

    const forbiddenFields: readonly string[] = Object.keys(fields).filter((fieldName) => {
      const field = table?.fields?.find((f) => f.name === fieldName)
      if (!field) return false

      const fieldPermission = table?.permissions?.fields?.find((fp) => fp.field === fieldName)
      return hasWriteRoleRestriction(fieldPermission, ctx.userRole)
    })

    const allowedData = Object.fromEntries(
      Object.entries(fields).filter(
        ([fieldName]) =>
          !forbiddenFields.includes(fieldName) && !SYSTEM_PROTECTED_FIELDS.has(fieldName)
      )
    )

    return { allowedData, forbiddenFields }
  })
}

export function validateFieldFormats(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldFormatError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return

    const urlField = table.fields.find(
      (f) => f.type === 'url' && f.name in fields && typeof fields[f.name] === 'string'
    )

    if (urlField) {
      const value = fields[urlField.name] as string
      const isValidUrl = (() => {
        try {
          const _url = new URL(value)
          return _url.protocol.length > 0
        } catch {
          return false
        }
      })()
      if (!isValidUrl) {
        return yield* Effect.fail(
          new FieldFormatError(`Invalid URL format for field '${urlField.name}'`, urlField.name)
        )
      }
    }
  })
}

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

const validateMaxFileSize = (
  field: AttachmentField,
  keys: readonly string[]
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
            .download(key)
            .pipe(Effect.catchAll(() => Effect.succeed(new Uint8Array(0))))
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

const validateOneAttachmentField = (
  field: AttachmentField,
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, StorageService> => {
  if (!(field.name in fields)) return Effect.void
  const keys = extractAttachmentKeys(field, fields[field.name])
  const maxFilesError = validateMaxFiles(field, keys)
  if (maxFilesError) return Effect.fail(maxFilesError)
  const typeError = validateAllowedTypes(field, keys)
  if (typeError) return Effect.fail(typeError)
  return validateMaxFileSize(field, keys)
}

export function validateAttachmentConstraints(
  fields: Record<string, unknown>
): Effect.Effect<void, FieldValidationError, ValidationContext | StorageService> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)
    if (!table) return
    const attachmentFields: readonly AttachmentField[] = table.fields.filter(isAttachmentField)
    yield* Effect.forEach(attachmentFields, (field) => validateOneAttachmentField(field, fields), {
      discard: true,
    })
  })
}

function stripUuidPrefix(key: string): string {
  return (
    key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)?.[1] ?? key
  )
}

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
      { ...fields } as Record<string, unknown>,
      (acc, f) => {
        if (!(f.name in acc) || typeof acc[f.name] !== 'string') return Effect.succeed(acc)
        const key = acc[f.name] as string
        return storage.download(key).pipe(
          Effect.catchAll(() => Effect.succeed(new Uint8Array(0))),
          Effect.map((content) => ({
            ...acc,
            [f.name]: {
              filename: stripUuidPrefix(key),
              mimeType: inferMimeFromKey(key),
              size: content.length,
              url: `/api/buckets/default/files/${key}`,
            },
          }))
        )
      }
    )
  })
}

const decodeContent = (content: string): Uint8Array => {
  try {
    return Uint8Array.from(Buffer.from(content, 'base64'))
  } catch {
    return new TextEncoder().encode(content)
  }
}

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

const uploadInlinePayload = (payload: {
  readonly name: string
  readonly content: string
  readonly mimeType?: string
}): Effect.Effect<
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
    yield* storage.upload(key, bytes, mimeType).pipe(Effect.catchAll(() => Effect.void))
    return { key, name: payload.name, mimeType, size: bytes.length }
  })

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
      { ...fields } as Record<string, unknown>,
      (acc, f) => {
        const value = acc[f.name]
        if (!isInlineAttachmentPayload(value)) return Effect.succeed(acc)
        return uploadInlinePayload(value).pipe(Effect.map((meta) => ({ ...acc, [f.name]: meta })))
      }
    )
  })
}

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
