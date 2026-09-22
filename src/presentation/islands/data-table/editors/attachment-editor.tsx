/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable unicorn/no-null --
   `null` is the value that CLEARS a column: it is SQL NULL on the wire, while
   `undefined` is dropped by JSON.stringify and reaches the endpoint as "leave
   this field alone". The two are not interchangeable here — swapping them turns
   every clear gesture into a silent no-op. */

/* eslint-disable react-perf/jsx-no-new-function-as-prop --
   Cell-level editor: mounted per open cell, torn down on commit or cancel, and
   its handlers close over the upload state. */

import { useRef, useState } from 'react'
import {
  computeTableAddRowInputClasses,
  computeTableEditorLabelClasses,
} from '@/presentation/design/table-default-classes'
import { readsAsList } from '../../runtime/cell-value-semantics'
import { uploadToBucket, type BucketUpload } from './bucket-upload'
import { editMetaOf, type CellEditorProps } from './editor-contract'
import { EditorPopover } from './editor-popover'
import type { FieldWriteValue } from '../../hooks/use-inline-editing'
import type { ReactElement } from 'react'

/**
 * The attachment cell editor, for `single-attachment` and
 * `multiple-attachments`.
 *
 * ## The column-shape trap
 *
 * `single-attachment` is `VARCHAR(255)` **unless** `storeMetadata: true`, which
 * promotes it to `JSONB`. One hard-coded write shape therefore breaks one of the
 * two variants: a `{ key, name, size, mimeType }` object written into the
 * `VARCHAR(255)` column is a type error on PostgreSQL, and a bare key written
 * into the `JSONB` one throws away everything that column exists to hold. The
 * editor reads `storeMetadata` and writes what the column actually accepts.
 *
 * ## No thumbnail
 *
 * `generateThumbnail` / `generateThumbnails` do NOT exist in AppSchema — they
 * are declared on no media schema, and a config carrying them FAILS
 * `sovrium validate`. Rendering one here would render a subsystem that does
 * not exist, so the editor shows a filename,
 * exactly as the read-only renderer does. If images ever land in this cell,
 * ecoconception R1 governs: AVIF, `loading="lazy"`, never inline base64.
 */

/** The bucket an attachment field uploads to when it declares none. */
const DEFAULT_BUCKET = 'default'

/** What one upload becomes in the column, given the column's shape. */
function toColumnValue(upload: BucketUpload, storeMetadata: boolean): FieldWriteValue {
  if (!storeMetadata) return upload.key
  return {
    key: upload.key,
    name: upload.filename,
    size: upload.size,
    mimeType: upload.mimeType,
  }
}

export function AttachmentEditor(
  props: CellEditorProps & { readonly multiple: boolean }
): ReactElement {
  const { value, commit, cancel, tabNext, fieldMeta, fieldName, multiple } = props
  const { bucket, storeMetadata, allowedFileTypes } = editMetaOf(fieldMeta)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'failed'>('idle')
  // The last committed value, so Tab can carry the upload out of the cell even
  // when it lands after the keystroke that leaves.
  const committedRef = useRef<FieldWriteValue>(
    multiple ? readsAsList(value) : ((value as FieldWriteValue) ?? null)
  )

  const handleFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return
    setStatus('uploading')
    try {
      const uploads = await Promise.all(
        Array.from(files).map((file) => uploadToBucket(file, bucket ?? DEFAULT_BUCKET))
      )
      const written = uploads.map((upload) => toColumnValue(upload, storeMetadata === true))
      const next: FieldWriteValue = multiple ? written : (written[0] ?? null)
      // eslint-disable-next-line functional/immutable-data -- Ref carries the committed value to a Tab that may fire before the state settles.
      committedRef.current = next
      setStatus('idle')
      commit(next)
    } catch {
      setStatus('failed')
    }
  }

  return (
    <EditorPopover
      label={`Edit ${fieldName ?? 'attachment'}`}
      cancel={cancel}
      tabValue={() => committedRef.current}
      {...(tabNext && { tabNext })}
    >
      <input
        type="file"
        name={fieldName}
        multiple={multiple}
        {...(allowedFileTypes &&
          allowedFileTypes.length > 0 && {
            accept: allowedFileTypes.join(','),
          })}
        onChange={(e) => void handleFiles(e.target.files)}
        className={computeTableAddRowInputClasses()}
      />
      {status !== 'idle' && (
        <p
          className={computeTableEditorLabelClasses()}
          {...(status === 'failed' && { role: 'alert' })}
        >
          {status === 'uploading' ? 'Uploading…' : 'Upload failed'}
        </p>
      )}
    </EditorPopover>
  )
}
