/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * F-11 (file-uploads): server-side multipart-to-canonical-metadata pipeline.
 *
 * The standalone `/api/forms/:name/submissions` endpoint accepts both JSON
 * and multipart bodies. When the body is multipart, individual `File`
 * entries arrive in the parsed payload — this module handles uploading
 * each File to the form's resolved storage bucket and replacing the raw
 * File with canonical `{ url, name, size, mimeType }` metadata that the
 * downstream `submitFormProgram` writes into `submitTo.table` (now JSONB
 * for form-referenced single-attachment columns — see `schema-initializer
 * .upgradeFormReferencedAttachments`) and the form-trigger envelope.
 *
 * Indexed array keys (`attachments[0]`, `attachments[1]`) coming from the
 * inline runtime's multipart body are normalized to a single
 * `attachments` array of metadata. Bare repeated keys (`attachments`,
 * `attachments`) parsed by Hono's `parseBody({ all: true })` are also
 * collapsed to the same array shape so the column write stays uniform.
 */

export interface FileMetadata {
  readonly url: string
  readonly name: string
  readonly size: number
  readonly mimeType: string
}

export class FormUploadError extends Data.TaggedError('FormUploadError')<{
  readonly message: string
}> {}

/**
 * Resolve the storage bucket for a specific form field. Precedence:
 *   1. Column-level `bucket` declared on the bound `single-attachment` /
 *      `multiple-attachments` column (single source of truth — the same
 *      binding that `attachment-upload-integration` uses for direct
 *      uploads).
 *   2. App-level fallback when the column did not declare one:
 *      a. The single bucket if `app.buckets` has exactly one entry.
 *      b. The first declared bucket.
 *      c. The implicit private 'default' bucket name when no buckets
 *         are declared at all.
 *
 * Note: `BucketSchema` does not expose a `default: true` flag — apps
 * that want a default at multi-bucket scope set the column-level
 * `bucket` on each attachment column instead. The precedence above
 * keeps form file uploads aligned with that contract.
 *
 * Returns the bucket NAME (string) so the caller can compose a
 * `/api/buckets/:name/files/<key>` URL straight into the canonical
 * metadata `url` field. `fieldName` is optional so the function still
 * works when callers do not yet know which field is being uploaded
 * (used by the GET-side rendering hook in a future tier).
 */
export const resolveFormBucket = (
  app: Readonly<App>,
  form: Readonly<Form>,
  fieldName?: string
): string => {
  const columnBucket = resolveColumnBucket(app, form, fieldName)
  if (columnBucket !== undefined) return columnBucket
  const buckets = app.buckets ?? []
  if (buckets[0]) return buckets[0].name
  return 'default'
}

/**
 * Locate the bound table column for a given form-field name. Returns
 * `undefined` when the form is standalone (no `submitTo.table`), the
 * field is not a `table-field`, or the table / column lookup fails.
 */
const findBoundColumn = (
  app: Readonly<App>,
  form: Readonly<Form>,
  fieldName: string
): { readonly type: string; readonly bucket?: string } | undefined => {
  const tableName = form.submitTo.table
  if (typeof tableName !== 'string') return undefined
  const formField = form.fields.find(
    (f): f is typeof f & { readonly kind: 'table-field'; readonly column: string } =>
      f.kind === 'table-field' && f.column === fieldName
  )
  if (!formField) return undefined
  const table = app.tables?.find((t) => t.name === tableName)
  return table?.fields.find((c) => c.name === formField.column) as
    | { readonly type: string; readonly bucket?: string }
    | undefined
}

/**
 * Read the column-level `bucket` binding for a form's table-bound
 * attachment field. Returns `undefined` when the column is not an
 * attachment or omitted the `bucket` prop.
 */
const resolveColumnBucket = (
  app: Readonly<App>,
  form: Readonly<Form>,
  fieldName: string | undefined
): string | undefined => {
  if (fieldName === undefined) return undefined
  const column = findBoundColumn(app, form, fieldName)
  if (!column) return undefined
  if (column.type !== 'single-attachment' && column.type !== 'multiple-attachments') {
    return undefined
  }
  const { bucket } = column
  return typeof bucket === 'string' && bucket.length > 0 ? bucket : undefined
}

/**
 * Detect indexed-array key like `attachments[0]` and split into
 * `{ field: 'attachments', index: 0 }`. Returns undefined when the key is
 * a plain field name.
 */
const parseIndexedKey = (
  key: string
): { readonly field: string; readonly index: number } | undefined => {
  const match = /^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\]$/.exec(key)
  if (!match) return undefined
  const fieldRaw = match[1]
  const idxRaw = match[2]
  if (fieldRaw === undefined || idxRaw === undefined) return undefined
  return { field: fieldRaw, index: parseInt(idxRaw, 10) }
}

/**
 * Convert the parsed body into per-field-name file groups.
 *
 * Three sources are merged:
 *   - Plain `name -> File` entries.
 *   - Repeated `name -> File[]` arrays produced by Hono's
 *     `parseBody({ all: true })`.
 *   - Indexed `name[index] -> File` entries from the inline runtime's
 *     multipart submission.
 *
 * Built functionally with `flatMap` + `Object.entries(...).reduce` so the
 * helper stays free of mutable Maps (matches the project's
 * `eslint-plugin-functional` policy).
 */
type FileGroup = readonly [field: string, files: readonly File[]]

const flatFileEntries = (body: Readonly<Record<string, unknown>>): readonly FileGroup[] =>
  Object.entries(body).flatMap(([key, value]): readonly FileGroup[] => {
    if (parseIndexedKey(key) !== undefined) return []
    if (value instanceof File) return [[key, [value]]]
    if (Array.isArray(value)) {
      const files = value.filter((v): v is File => v instanceof File)
      return files.length > 0 ? [[key, files]] : []
    }
    return []
  })

const indexedFileEntries = (body: Readonly<Record<string, unknown>>): readonly FileGroup[] => {
  const sortedByField = Object.entries(body).flatMap(
    ([key, value]): ReadonlyArray<{
      readonly field: string
      readonly index: number
      readonly file: File
    }> => {
      const indexed = parseIndexedKey(key)
      if (!indexed || !(value instanceof File)) return []
      return [{ field: indexed.field, index: indexed.index, file: value }]
    }
  )
  // Group by field, sort each group by index (immutable `toSorted`), return as FileGroup[].
  const fieldNames = Array.from(new Set(sortedByField.map((e) => e.field)))
  return fieldNames.map((field): FileGroup => {
    const entries = sortedByField
      .filter((e) => e.field === field)
      .toSorted((a, b) => a.index - b.index)
    return [field, entries.map((e) => e.file)]
  })
}

const mergeGroups = (
  flat: readonly FileGroup[],
  indexed: readonly FileGroup[]
): readonly FileGroup[] => {
  const fieldNames = Array.from(new Set([...flat, ...indexed].map(([field]) => field)))
  return fieldNames.map((field): FileGroup => {
    const flatFiles = flat.find(([f]) => f === field)?.[1] ?? []
    const indexedFiles = indexed.find(([f]) => f === field)?.[1] ?? []
    return [field, [...flatFiles, ...indexedFiles]]
  })
}

const groupFilesByField = (body: Readonly<Record<string, unknown>>): readonly FileGroup[] =>
  mergeGroups(flatFileEntries(body), indexedFileEntries(body))

/**
 * Decide whether a file field on the submission body should produce an
 * array (multi-attachment) or a single object (single-attachment).
 * Resolution:
 *   - When the field maps to a bound `multiple-attachments` column,
 *     always produce an array.
 *   - When it maps to a bound `single-attachment` column, always
 *     produce a single object (or null when no file was uploaded).
 *   - Standalone-only forms (`submitTo.table === undefined`) and form
 *     fields that did NOT match a bound column fall back to "array
 *     when more than one File arrived" so the runtime contract still
 *     works for free-form attachment groups.
 */
const isMultiFileField = (
  app: Readonly<App>,
  form: Readonly<Form>,
  fieldName: string,
  fileCount: number
): boolean => {
  const column = findBoundColumn(app, form, fieldName)
  if (!column) return fileCount > 1
  if (column.type === 'multiple-attachments') return true
  if (column.type === 'single-attachment') return false
  return fileCount > 1
}

/**
 * Upload a single File to the resolved bucket and produce canonical
 * metadata. Mirrors the bucket-route upload key convention
 * (`<uuid>-<original-filename>`) so downloads via
 * `GET /api/buckets/:bucket/files/:key` resolve through the same code path.
 */
const uploadOne = (
  bucketName: string,
  file: File
): Effect.Effect<FileMetadata, FormUploadError, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => file.arrayBuffer(),
      catch: (cause) =>
        new FormUploadError({ message: `Could not read ${file.name}: ${String(cause)}` }),
    })
    const bytes = new Uint8Array(arrayBuffer)
    const mimeType = file.type || 'application/octet-stream'
    const key = `${crypto.randomUUID()}-${file.name}`
    yield* storage
      .upload(key, bytes, mimeType)
      .pipe(
        Effect.mapError(
          (cause) =>
            new FormUploadError({ message: `Upload failed for ${file.name}: ${String(cause)}` })
        )
      )
    return {
      url: `/api/buckets/${bucketName}/files/${key}`,
      name: file.name,
      size: bytes.length,
      mimeType,
    }
  })

/**
 * Upload every File found in `body` to the form's resolved bucket and
 * return a new body with the File values replaced by canonical metadata.
 * Plain (non-File) entries pass through untouched. Indexed-array keys
 * (`attachments[0]`, `attachments[1]`) are collapsed to a single
 * `attachments` array.
 *
 * When no Files are present, returns the original body unchanged so the
 * function is safe to call on JSON submissions too.
 */
export const transformMultipartFiles = (
  app: Readonly<App>,
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Effect.Effect<Record<string, unknown>, FormUploadError, StorageService> =>
  Effect.gen(function* () {
    const grouped = groupFilesByField(body)
    if (grouped.length === 0) return { ...body }

    // Upload every file in parallel. Bucket is resolved per-field so
    // each attachment column writes through its declared `bucket`
    // (column-level binding wins over app-level fallback). Field name
    // is paired back with the resulting metadata in insertion order so
    // single-attachment fields get a single object and multi-attachment
    // fields get an array.
    const uploaded = yield* Effect.forEach(
      grouped,
      ([field, files]) => {
        const bucketName = resolveFormBucket(app, form, field)
        return Effect.forEach(files, (file) => uploadOne(bucketName, file)).pipe(
          Effect.map((metas) => [field, metas] as const)
        )
      },
      { concurrency: 'unbounded' }
    )

    const fileFieldNames = new Set(uploaded.map(([field]) => field))

    // Strip every File-bearing key from the body (including indexed
    // variants). The replacement values are spread in immediately after.
    const survivingEntries = Object.entries(body).filter(([key]) => {
      const indexed = parseIndexedKey(key)
      if (indexed && fileFieldNames.has(indexed.field)) return false
      if (fileFieldNames.has(key)) return false
      return true
    })

    const replacementEntries = uploaded.map(([field, metas]): readonly [string, unknown] => {
      const isMulti = isMultiFileField(app, form, field, metas.length)
      // eslint-disable-next-line unicorn/no-null -- single-attachment public contract: null when no file
      return [field, isMulti ? metas : (metas[0] ?? null)]
    })

    return Object.fromEntries([...survivingEntries, ...replacementEntries])
  })
