/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useRef, type ChangeEventHandler, type ReactElement, type Ref } from 'react'
import {
  fileUploadDropzoneHint,
  computeFileUploadErrorClasses,
  computeFileUploadTriggerClasses,
} from '@/presentation/design/file-upload-default-classes'
import { FileNameList } from './file-name-list'
import { DropZone } from './file-upload-dropzone'
import { useFileUploadState } from './use-file-upload-state'
import type {
  FetchSuccessResponse,
  FetchToastResponse,
} from '@/domain/models/app/pages/components/action'

interface FileUploadIslandProps {
  readonly accept?: string
  readonly maxFiles?: number
  readonly maxFileSize?: number
  readonly dropZone?: boolean
  readonly disabled?: boolean
  readonly label?: string
  // `id` is the host wrapper's id (used to build a stable input id) — we do
  // NOT re-emit it on our own wrapper because the SSR placeholder host carries
  // the same id already. See the comment near the JSX wrapper.
  readonly id?: string
  /** Destination URL for the multipart upload (resolved from `uploadAction`). */
  readonly uploadAction?: string
  /** Success effects (status badge + sibling refetch) run on a 2xx upload. */
  readonly onSuccess?: FetchSuccessResponse
  /** Failure toast dispatched when the upload resolves non-2xx. */
  readonly onError?: FetchToastResponse
}

interface UploadInputProps {
  readonly inputRef: Ref<HTMLInputElement>
  readonly inputId: string | undefined
  readonly accept: string | undefined
  readonly allowMultiple: boolean
  readonly disabled: boolean
  readonly buttonText: string
  /** Hidden from the paint, kept for the keyboard and assistive technology. */
  readonly hidden: boolean
  readonly onChange: ChangeEventHandler<HTMLInputElement>
}

/**
 * The native file input. Beside a drop zone it is `sr-only`: the zone's own
 * Browse files button opens it, and its browser-drawn label, in the browser's
 * language, never shows. Beside a plain button it stays as drawn.
 */
function UploadInput({
  inputRef,
  inputId,
  accept,
  allowMultiple,
  disabled,
  buttonText,
  hidden,
  onChange,
}: UploadInputProps): ReactElement {
  return (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept={accept}
      multiple={allowMultiple}
      disabled={disabled}
      aria-label={buttonText}
      className={hidden ? 'sr-only' : undefined}
      onChange={onChange}
    />
  )
}

/** Without a drop zone: the input's label, drawn as an outline button. */
function ButtonLabel({
  inputId,
  disabled,
  text,
}: {
  readonly inputId: string | undefined
  readonly disabled: boolean
  readonly text: string
}): ReactElement {
  return (
    <label
      htmlFor={inputId}
      data-slot="button"
      data-variant="outline"
      className={computeFileUploadTriggerClasses({ disabled })}
      aria-disabled={disabled ? 'true' : undefined}
    >
      {text}
    </label>
  )
}

interface FileUploadFeedbackProps {
  readonly error: string | undefined
  readonly fileNames: readonly string[]
}

/** The inline validation-error / picked-filename region below the control. */
function FileUploadFeedback({
  error,
  fileNames,
}: FileUploadFeedbackProps): ReactElement | undefined {
  if (error) {
    return (
      <p
        role="alert"
        className={computeFileUploadErrorClasses()}
      >
        {error}
      </p>
    )
  }
  if (fileNames.length > 0) return <FileNameList fileNames={fileNames} />
  return undefined
}

/**
 * File-upload island — adds client-side file selection + size validation on
 * top of the SSR placeholder rendered by `renderFileUpload`. When the user
 * picks a file (via the browse button or drag-and-drop into the dropzone),
 * we validate each file against `maxFileSize`/`maxFiles` and surface a human
 * readable error message inline (matching the spec phrases "too large",
 * "exceeds", "size limit"). When the schema wires an `uploadAction`, picking a
 * file additionally POSTs it as `multipart/form-data` and runs the configured
 * `onSuccess` effects (persistent `role="status"` badge + sibling `refetch`) /
 * `onError` toast via the shipped action-effects mechanism.
 *
 * Two notes about the wrapper it returns. It deliberately does NOT re-emit
 * `id` / `className` / `data-testid`: the island's HOST element — the SSR
 * placeholder in `renderFileUploadIsland` — already carries those, and
 * repeating them on a child causes duplicate-`id` strict-mode violations on
 * `page.locator('#x')`. And the control is disabled while a multipart upload
 * is in flight, which is the island's whole progress affordance; it re-enables
 * when the request settles.
 */
export default function FileUploadIsland({
  accept,
  maxFiles,
  maxFileSize,
  dropZone = false,
  disabled = false,
  label,
  id,
  uploadAction,
  onSuccess,
  onError,
}: FileUploadIslandProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useFileUploadState({ maxFiles, maxFileSize, uploadAction, onSuccess, onError })
  const browse = useCallback(() => inputRef.current?.click(), [])
  const allowMultiple = typeof maxFiles === 'number' ? maxFiles > 1 : false
  const inputId = id ? `${id}-input` : undefined
  const buttonText = label ?? 'Upload file'
  const controlsDisabled = disabled || upload.submitting

  return (
    <div
      className="flex flex-col gap-2"
      data-component="file-upload-island"
      data-dropzone={dropZone ? 'true' : undefined}
      data-island-mounted="true"
    >
      {dropZone ? (
        <DropZone
          disabled={controlsDisabled}
          hint={fileUploadDropzoneHint({ accept, maxFiles, maxFileSize })}
          onBrowse={browse}
          onDropFiles={upload.handleFiles}
        />
      ) : (
        <ButtonLabel
          inputId={inputId}
          disabled={controlsDisabled}
          text={buttonText}
        />
      )}
      <UploadInput
        inputRef={inputRef}
        inputId={inputId}
        accept={accept}
        allowMultiple={allowMultiple}
        disabled={controlsDisabled}
        buttonText={buttonText}
        hidden={dropZone}
        onChange={upload.handleChange}
      />
      <FileUploadFeedback
        error={upload.error}
        fileNames={upload.fileNames}
      />
    </div>
  )
}
