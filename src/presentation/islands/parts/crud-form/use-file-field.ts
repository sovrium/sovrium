/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import {
  bucketOf,
  uploadFile,
  serializeValue,
  parseInitialValue,
  planSelection,
} from './file-field-values'
import type { FieldDef } from './field-def'
import type { StoredFile, Words } from './file-field-values'

export interface FileFieldProps {
  readonly field: FieldDef
  readonly multiple: boolean
  readonly value: string
  readonly onChange: (name: string, value: string) => void
  /** The form's interface strings in the page language (`form.upload*`). */
  readonly strings?: Words
}

/**
 * Encapsulate the file-field's upload/validation state and handlers so the
 * `FileField` component stays a thin presentational shell.
 */
export function useFileField(props: FileFieldProps) {
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
      setError(props.strings?.['form.uploadFailed'] ?? 'File upload failed. Please try again.')
    } finally {
      setUploading(false)
      setInputKey((k) => k + 1)
    }
  }

  // Files chosen in the browser's chooser, or dropped on a drop zone.
  const handleFiles = async (selected: readonly File[]) => {
    if (selected.length === 0) return
    const plan = planSelection(selected, field, multiple, {
      count: files.length,
      strings: props.strings,
    })
    setError(plan.error)
    if (plan.accepted.length === 0) {
      setInputKey((k) => k + 1)
      return
    }
    await uploadAccepted(plan.accepted)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    handleFiles(Array.from(e.target.files ?? []))

  const removeAt = (index: number) => commit(files.filter((_, i) => i !== index))

  return { files, error, uploading, inputKey, handleChange, handleFiles, removeAt }
}
