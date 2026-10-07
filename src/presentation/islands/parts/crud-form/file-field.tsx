/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import {
  computeFormFieldLabelClasses,
  computeFormHelpTextClasses,
} from '@/presentation/design/form-layout-classes'
import {
  computeAttachmentRemoveButtonClasses,
  computeAttachmentTileClasses,
  computeAttachmentTileFileIconClasses,
  computeAttachmentTileFilenameClasses,
  computeAttachmentTileImageClasses,
} from '../../../design/field-affordances-default-classes'
import { type FieldDef, labelOf } from './field-def'
import {
  bucketOf,
  uploadFile,
  serializeValue,
  parseInitialValue,
  planSelection,
} from './file-field-values'
import type { UploadedFile, StoredFile } from './file-field-values'

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

interface FileUploadProgressProps {
  readonly uploading: boolean
}

/** Upload progress indicator: in-flight spinner or completed state. */
function FileUploadProgress({ uploading }: FileUploadProgressProps) {
  return (
    <div
      role="progressbar"
      data-testid="upload-progress"
      className={computeFormHelpTextClasses()}
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

/** Native `<input type="file">` with the field's required / disabled attrs. */
function FileInput({ field, multiple, inputKey, onChange }: FileInputProps) {
  return (
    <input
      key={inputKey}
      id={`file-${field.name}`}
      type="file"
      data-component-type="file-upload"
      name={field.name}
      multiple={multiple}
      onChange={onChange}
      {...(field.required && { 'data-required': 'true' })}
      {...(field.disabled && { disabled: true })}
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

/** Presentational body: label, input, progress, error, previews. */
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
      <label
        htmlFor={`file-${field.name}`}
        className={computeFormFieldLabelClasses()}
      >
        {labelOf(field)}
      </label>
      {fileInput}
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
 *   back to the built-in `system` bucket) and shows an upload progress
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
