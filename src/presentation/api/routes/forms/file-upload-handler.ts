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


export interface FileMetadata {
  readonly url: string
  readonly name: string
  readonly size: number
  readonly mimeType: string
}

export class FormUploadError extends Data.TaggedError('FormUploadError')<{
  readonly message: string
}> {}

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
    { readonly type: string; readonly bucket?: string } | undefined
}

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

export const transformMultipartFiles = (
  app: Readonly<App>,
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Effect.Effect<Record<string, unknown>, FormUploadError, StorageService> =>
  Effect.gen(function* () {
    const grouped = groupFilesByField(body)
    if (grouped.length === 0) return { ...body }

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

    const survivingEntries = Object.entries(body).filter(([key]) => {
      const indexed = parseIndexedKey(key)
      if (indexed && fileFieldNames.has(indexed.field)) return false
      if (fileFieldNames.has(key)) return false
      return true
    })

    const replacementEntries = uploaded.map(([field, metas]): readonly [string, unknown] => {
      const isMulti = isMultiFileField(app, form, field, metas.length)
      return [field, isMulti ? metas : (metas[0] ?? null)]
    })

    return Object.fromEntries([...survivingEntries, ...replacementEntries])
  })
