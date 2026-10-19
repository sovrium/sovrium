/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An attachment in an editable record sheet: a drop zone (shadcn/ui's file
 * upload, base-nova's `Empty` with a dashed edge) saying "Drop files or
 * browse" and what the column's bucket takes, in words — never the browser's
 * own file input, which stays in the zone, hidden, for the "browse" button to
 * open. A file dropped or chosen uploads to the bucket as the form's picker
 * does (`useFileField`), and the sheet holds the stored file the records API
 * takes; the files held are listed under the zone, each with its Remove.
 */

import { useRef, useState, type DragEvent, type ReactElement } from 'react'
import {
  computeFileUploadDropzoneClasses,
  computeFileUploadDropzoneHintClasses,
  computeFileUploadDropzoneTextClasses,
  computeFileUploadErrorClasses,
  computeFileUploadFileNameClasses,
  computeFileUploadFileRowClasses,
  computeFileUploadListClasses,
} from '@/presentation/design/file-upload-default-classes'
import { RequiredMark } from '../parts/crud-form/field-label'
import { useFileField } from '../parts/crud-form/use-file-field'
import { trackUpload } from './record-drawer-uploads'
import type { DrawerTypedEntry, TypedFieldProps } from './record-drawer-typed-input'
import type { FieldDef } from '../parts/crud-form/field-def'

/** The English words, for a host that resolved none. */
const ENGLISH = { prompt: 'Drop files or {browse}', browse: 'browse' }

/** The form's field definition for an attachment, as its upload reads it. */
const toFileFieldDef = (field: DrawerTypedEntry, label: string, disabled: boolean): FieldDef => ({
  name: field.name,
  type: field.type as FieldDef['type'],
  displayLabel: label,
  ...(disabled ? { disabled: true } : {}),
  ...(field.bucket === undefined ? {} : { bucket: field.bucket }),
  ...(field.allowedFileTypes === undefined ? {} : { allowedFileTypes: field.allowedFileTypes }),
  ...(field.maxFileSize === undefined ? {} : { maxFileSize: field.maxFileSize }),
})

/** The prompt, its "browse" drawn as the button that opens the file chooser. */
function Prompt({
  words,
  disabled,
  onBrowse,
}: {
  readonly words: { readonly prompt: string; readonly browse: string }
  readonly disabled: boolean
  readonly onBrowse: () => void
}): ReactElement {
  const [before = '', after = ''] = words.prompt.split('{browse}')
  return (
    <p className={computeFileUploadDropzoneTextClasses()}>
      {before}
      <button
        type="button"
        disabled={disabled}
        onClick={onBrowse}
        className="text-primary underline underline-offset-4 disabled:cursor-not-allowed"
      >
        {words.browse}
      </button>
      {after}
    </p>
  )
}

/** Why a file was refused, then the files the field holds, each with its Remove. */
function HeldFiles({
  files,
  error,
  disabled,
  onRemove,
}: {
  readonly files: ReturnType<typeof useFileField>['files']
  readonly error: string | undefined
  readonly disabled: boolean
  readonly onRemove: (index: number) => void
}): ReactElement {
  return (
    <>
      {error === undefined ? undefined : (
        <span
          role="alert"
          className={computeFileUploadErrorClasses()}
        >
          {error}
        </span>
      )}
      {files.length === 0 ? undefined : (
        <ul className={computeFileUploadListClasses()}>
          {files.map((file, index) => (
            <li
              key={`${file.key}-${String(index)}`}
              data-file-name={file.meta.name}
              className={computeFileUploadFileRowClasses()}
            >
              <span className={computeFileUploadFileNameClasses()}>{file.meta.name}</span>
              <button
                type="button"
                aria-label={`Remove ${file.meta.name}`}
                disabled={disabled}
                onClick={() => onRemove(index)}
                className="text-muted-foreground hover:text-foreground ml-auto text-sm"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/** The drop zone — see the module note. */
function AttachmentZone(props: TypedFieldProps): ReactElement {
  const { field, label, value, disabled, onChange } = props
  const multiple = field.type === 'multiple-attachments'
  const upload = useFileField({
    field: toFileFieldDef(field, label, disabled),
    multiple,
    value,
    onChange,
  })
  const input = useRef<HTMLInputElement | null>(null)
  const [over, setOver] = useState(false)
  const words = field.dropZone ?? ENGLISH
  const hold = (event: DragEvent<HTMLDivElement>, holding: boolean) => {
    event.preventDefault()
    setOver(holding && !disabled)
  }
  const state = disabled ? 'disabled' : over ? 'hover' : 'default'
  return (
    <>
      <div
        data-slot="file-drop-zone"
        className={computeFileUploadDropzoneClasses({ state })}
        onDragOver={(event) => hold(event, true)}
        onDragLeave={(event) => hold(event, false)}
        onDrop={(event) => {
          hold(event, false)
          if (!disabled) void trackUpload(upload.handleFiles(Array.from(event.dataTransfer.files)))
        }}
      >
        <Prompt
          words={words}
          disabled={disabled}
          onBrowse={() => input.current?.click()}
        />
        {field.dropZone?.hint === undefined ? undefined : (
          <p className={computeFileUploadDropzoneHintClasses()}>{field.dropZone.hint}</p>
        )}
        <input
          key={upload.inputKey}
          ref={input}
          type="file"
          data-component-type="file-upload"
          hidden
          name={field.name}
          aria-label={label}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => void trackUpload(upload.handleChange(event))}
        />
      </div>
      <HeldFiles
        files={upload.files}
        error={upload.error}
        disabled={disabled}
        onRemove={upload.removeAt}
      />
    </>
  )
}

/**
 * An attachment's entry: its heading and its drop zone. The zone reads its
 * value once, so it is drawn afresh when the record lands or its files first
 * arrive (`key`) rather than keeping the empty value it was first drawn with.
 */
export function AttachmentField(props: TypedFieldProps): ReactElement {
  const { field, label, disabled, children } = props
  return (
    <div
      data-field={field.name}
      className="text-md flex flex-col gap-1"
    >
      <span className="text-muted-foreground">
        {label}
        <RequiredMark marked={field.requiredMark} />
      </span>
      <AttachmentZone
        key={disabled ? 'pending' : props.value === '' ? 'empty' : 'held'}
        {...props}
      />
      {children}
    </div>
  )
}
