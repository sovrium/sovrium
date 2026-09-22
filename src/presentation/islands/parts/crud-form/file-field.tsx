/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   The file-upload field wires fresh onChange / onClick handlers per render
   because the upload state lives in component-local useState. Lifting these
   out requires a state-model refactor covered by the crud-form refactor. */

import { useState } from 'react'
import {
  computeAttachmentRemoveButtonClasses,
  computeAttachmentTileClasses,
  computeAttachmentTileFileIconClasses,
  computeAttachmentTileFilenameClasses,
  computeAttachmentTileImageClasses,
} from '../../../design/field-affordances-default-classes'
import { type FieldDef, labelOf } from './field-def'

/**
 * Canonical file metadata stored in the form value for an attachment field.
 * Serialised to JSON and submitted as the field's string value, so the
 * record API writes `{ url, name, size, mimeType }` into the column.
 */
export interface UploadedFile {
  readonly url: string
  readonly name: string
  readonly size: number
  readonly mimeType: string
}

interface BucketUploadResponse {
  readonly success?: boolean
  readonly key?: string
  readonly size?: number
  readonly mimeType?: string
  readonly filename?: string
}

/** An uploaded file paired with the storage key persisted into the record column. */
interface StoredFile {
  readonly meta: UploadedFile
  readonly key: string
}

/**
 * Reject a file whose MIME type is not in `allowedFileTypes` or whose size
 * exceeds `maxFileSize`. Returns a human-readable error or `undefined`.
 */
function validateFile(file: File, field: FieldDef): string | undefined {
  const types = field.allowedFileTypes
  if (types !== undefined && types.length > 0 && !types.includes(file.type)) {
    return 'File type not allowed. Please choose a valid file.'
  }
  if (field.maxFileSize !== undefined && field.maxFileSize > 0 && file.size > field.maxFileSize) {
    const mb = Math.round(field.maxFileSize / (1024 * 1024))
    return `File size exceeds the maximum of ${mb} MB.`
  }
  return undefined
}

/** Find the first MIME-type / size validation error in a list of selected files. */
function firstFileError(files: readonly File[], field: FieldDef): string | undefined {
  return files.map((file) => validateFile(file, field)).find((error) => error !== undefined)
}

/**
 * Implicit bucket used when the bound column declares no `bucket` binding.
 * Mirrors the records read path's fallback — deliberately NOT the
 * app's first declared bucket, which is the form-upload path's fallback.
 */
const DEFAULT_BUCKET = 'default'

/** Resolve the bucket a file field uploads to and previews from. */
function bucketOf(field: FieldDef): string {
  return field.bucket ?? DEFAULT_BUCKET
}

/** Upload a single file to the field's declared storage bucket; returns the stored file. */
async function uploadFile(file: File, bucket: string): Promise<StoredFile> {
  const body = new FormData()
  body.set('file', file)
  const res = await fetch(`/api/buckets/${bucket}/files`, { method: 'POST', body })
  if (!res.ok) {
    // eslint-disable-next-line functional/no-throw-statements -- caller catches and surfaces the error
    throw new Error(`Upload failed for ${file.name}`)
  }
  const json = (await res.json()) as BucketUploadResponse
  const key = json.key ?? ''
  return {
    key,
    meta: {
      url: `/api/buckets/${bucket}/files/${key}`,
      name: json.filename ?? file.name,
      size: json.size ?? file.size,
      mimeType: json.mimeType ?? file.type,
    },
  }
}

/**
 * Serialise the stored-file list into the form value.
 *
 * `single-attachment` columns are `VARCHAR` and store a single storage key
 * string. `multiple-attachments` columns are `JSONB` and store a JSON array
 * of storage keys. Both shapes are what the record-creation attachment
 * validator (`extractAttachmentKeys`) expects.
 */
function serializeValue(files: readonly StoredFile[], multiple: boolean): string {
  if (files.length === 0) return ''
  if (multiple) return JSON.stringify(files.map((f) => f.key))
  return files[0]!.key
}

/**
 * Recover the original filename from a storage key (`<uuid>-<filename>`).
 * Returns the key unchanged when it carries no uuid prefix.
 */
function filenameFromKey(key: string): string {
  return (
    key.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i)?.[1] ?? key
  )
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'])

/** Best-effort MIME inference from a filename extension (used for edit-mode previews). */
function mimeFromName(name: string): string {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  return ext !== undefined && IMAGE_EXTENSIONS.has(ext)
    ? `image/${ext}`
    : 'application/octet-stream'
}

/** Build a StoredFile from a plain storage key string. */
function storedFromKey(key: string, bucket: string): StoredFile {
  const name = filenameFromKey(key)
  return {
    key,
    meta: {
      url: `/api/buckets/${bucket}/files/${key}`,
      name,
      size: 0,
      mimeType: mimeFromName(name),
    },
  }
}

/** Build a StoredFile from a metadata object (edit-mode seeded JSON). */
function storedFromMeta(entry: Record<string, unknown>): StoredFile | undefined {
  const { name } = entry
  if (typeof name !== 'string') return undefined
  const url = typeof entry['url'] === 'string' ? entry['url'] : ''
  return {
    key: url.split('/').at(-1) ?? name,
    meta: {
      url,
      name,
      size: typeof entry['size'] === 'number' ? entry['size'] : 0,
      mimeType: typeof entry['mimeType'] === 'string' ? entry['mimeType'] : mimeFromName(name),
    },
  }
}

/** Parse a JSON string, returning `undefined` when the input is not valid JSON. */
function tryParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

/**
 * Parse an existing form value (edit mode) back into a stored-file list.
 *
 * Accepts three shapes for backward compatibility:
 *   - a plain storage key string,
 *   - a JSON metadata object (`{ name, url, size, ... }`),
 *   - a JSON array of either of the above.
 */
function parseInitialValue(value: string, bucket: string): readonly StoredFile[] {
  if (!value.trim()) return []
  const parsed = tryParseJson(value)
  // Not JSON — treat as a single bare storage key.
  if (parsed === undefined) return [storedFromKey(value, bucket)]
  const list = Array.isArray(parsed) ? parsed : [parsed]
  return list.flatMap((entry): readonly StoredFile[] => {
    if (typeof entry === 'string') return [storedFromKey(entry, bucket)]
    if (typeof entry === 'object' && entry !== null) {
      const stored = storedFromMeta(entry as Record<string, unknown>)
      return stored ? [stored] : []
    }
    return []
  })
}

interface FilePreviewProps {
  readonly file: UploadedFile
  readonly onRemove: () => void
}

/** Render a single uploaded file: thumbnail for images, filename for others. */
function FilePreview({ file, onRemove }: FilePreviewProps) {
  const isImage = file.mimeType.startsWith('image/')
  return (
    <div
      data-file-name={file.name}
      className={computeAttachmentTileClasses()}
    >
      {isImage ? (
        <img
          src={file.url}
          alt={file.name}
          data-preview="true"
          width={64}
          height={64}
          className={computeAttachmentTileImageClasses()}
        />
      ) : (
        <span
          aria-hidden="true"
          className={computeAttachmentTileFileIconClasses()}
        >
          📄
        </span>
      )}
      <span className={computeAttachmentTileFilenameClasses()}>{file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className={computeAttachmentRemoveButtonClasses()}
      >
        ×
      </button>
    </div>
  )
}

/**
 * Result of validating a fresh file selection: `error` carries a blocking
 * (type / size) error or a non-blocking overflow warning, and `accepted`
 * is the truncated list of files cleared to upload.
 */
interface SelectionPlan {
  readonly error: string | undefined
  readonly accepted: readonly File[]
}

/**
 * Validate and truncate a fresh file selection against the field's
 * MIME-type / size / maxFiles constraints.
 *
 * - A type / size violation rejects the whole selection (`accepted` empty).
 * - A maxFiles overflow keeps the files that fit and warns about the rest.
 */
function planSelection(
  selected: readonly File[],
  field: FieldDef,
  multiple: boolean,
  existingCount: number
): SelectionPlan {
  const blocking = firstFileError(selected, field)
  if (blocking !== undefined) return { error: blocking, accepted: [] }

  const limit = multiple ? field.maxFiles : 1
  if (limit === undefined) return { error: undefined, accepted: selected }

  const overLimit = existingCount + selected.length > limit
  const accepted = selected.slice(0, Math.max(0, limit - existingCount))
  return {
    error: overLimit ? `Too many files — the maximum allowed is ${String(limit)}.` : undefined,
    accepted,
  }
}

interface FileUploadProgressProps {
  readonly uploading: boolean
}

/** Upload progress indicator: in-flight spinner or completed state. */
function FileUploadProgress({ uploading }: FileUploadProgressProps) {
  return (
    <div
      role="progressbar"
      data-testid="upload-progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={uploading ? 50 : 100}
    >
      {uploading ? 'Uploading...' : 'Upload complete'}
    </div>
  )
}

interface FilePreviewListProps {
  readonly files: readonly StoredFile[]
  readonly onRemove: (index: number) => void
}

/** Render the list of selected/uploaded files with per-file remove controls. */
function FilePreviewList({ files, onRemove }: FilePreviewListProps) {
  return (
    <ul data-file-list>
      {files.map((file, index) => (
        <li key={`${file.key}-${index}`}>
          <FilePreview
            file={file.meta}
            onRemove={() => onRemove(index)}
          />
        </li>
      ))}
    </ul>
  )
}

interface FileInputProps {
  readonly field: FieldDef
  readonly multiple: boolean
  readonly inputKey: number
  readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

/** Native `<input type="file">` with the field's accept / required / disabled attrs. */
function FileInput({ field, multiple, inputKey, onChange }: FileInputProps) {
  return (
    <input
      key={inputKey}
      id={`file-${field.name}`}
      type="file"
      name={field.name}
      multiple={multiple}
      onChange={onChange}
      {...(field.required && { 'data-required': 'true' })}
      {...(field.disabled && { disabled: true })}
      {...(field.accept !== undefined && { accept: field.accept })}
    />
  )
}

interface FileFieldBodyProps {
  readonly field: FieldDef
  readonly fileInput: React.ReactElement
  readonly uploading: boolean
  readonly error: string | undefined
  readonly files: readonly StoredFile[]
  readonly onRemove: (index: number) => void
}

/** Presentational body: label, input / drop-zone, progress, error, previews. */
function FileFieldBody({
  field,
  fileInput,
  uploading,
  error,
  files,
  onRemove,
}: FileFieldBodyProps) {
  return (
    <div>
      <label htmlFor={`file-${field.name}`}>{labelOf(field)}</label>
      {field.dropZone === true ? (
        <div data-dropzone="true">
          <span>Drag and drop or browse to choose a file</span>
          {fileInput}
        </div>
      ) : (
        fileInput
      )}
      {(uploading || files.length > 0) && <FileUploadProgress uploading={uploading} />}
      {error !== undefined && <span role="alert">{error}</span>}
      {files.length > 0 && (
        <FilePreviewList
          files={files}
          onRemove={onRemove}
        />
      )}
    </div>
  )
}

interface FileFieldProps {
  readonly field: FieldDef
  readonly multiple: boolean
  readonly value: string
  readonly onChange: (name: string, value: string) => void
}

/**
 * Encapsulate the file-field's upload/validation state and handlers so the
 * `FileField` component stays a thin presentational shell.
 */
function useFileField(props: FileFieldProps) {
  const { field, multiple, value, onChange } = props
  const bucket = bucketOf(field)
  // Edit mode: the initial form value (a storage key, JSON metadata object, or
  // array of either) is parsed once into the displayed stored-file list.
  const [files, setFiles] = useState<readonly StoredFile[]>(() => parseInitialValue(value, bucket))
  const [error, setError] = useState<string | undefined>(undefined)
  const [uploading, setUploading] = useState(false)
  const [inputKey, setInputKey] = useState(0)

  const commit = (next: readonly StoredFile[]) => {
    setFiles(next)
    onChange(field.name, serializeValue(next, multiple))
  }

  const uploadAccepted = async (accepted: readonly File[]) => {
    setUploading(true)
    try {
      const uploaded = await Promise.all(accepted.map((file) => uploadFile(file, bucket)))
      commit(multiple ? [...files, ...uploaded] : uploaded)
    } catch {
      setError('File upload failed. Please try again.')
    } finally {
      setUploading(false)
      setInputKey((k) => k + 1)
    }
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return
    const plan = planSelection(selected, field, multiple, files.length)
    setError(plan.error)
    if (plan.accepted.length === 0) {
      setInputKey((k) => k + 1)
      return
    }
    await uploadAccepted(plan.accepted)
  }

  const removeAt = (index: number) => commit(files.filter((_, i) => i !== index))

  return { files, error, uploading, inputKey, handleChange, removeAt }
}

/**
 * File-upload field for `single-attachment` / `multiple-attachments` columns.
 *
 * - Validates MIME type, size, and (multi) file count on selection.
 * - Uploads valid files to the bucket declared on the bound column (falling
 *   back to the implicit 'default' bucket) and shows an upload progress
 *   indicator while the request is in flight.
 * - Renders a thumbnail preview for images, a filename chip for others, with
 *   a per-file Remove button.
 * - Writes canonical `{ url, name, size, mimeType }` JSON metadata into the
 *   form value so the record API persists the file reference.
 */
export function FileField(props: FileFieldProps) {
  const { field, multiple } = props
  const { files, error, uploading, inputKey, handleChange, removeAt } = useFileField(props)

  const fileInput = (
    <FileInput
      field={field}
      multiple={multiple}
      inputKey={inputKey}
      onChange={(e) => void handleChange(e)}
    />
  )

  return (
    <FileFieldBody
      field={field}
      fileInput={fileInput}
      uploading={uploading}
      error={error}
      files={files}
      onRemove={removeAt}
    />
  )
}
