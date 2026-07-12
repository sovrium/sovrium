/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRef, type ChangeEventHandler, type ReactElement, type Ref } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
import { FileNameList } from './file-name-list'
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
  readonly id?: string
  readonly uploadAction?: string
  readonly onSuccess?: FetchSuccessResponse
  readonly onError?: FetchToastResponse
}

interface UploadLabelProps {
  readonly inputId: string | undefined
  readonly dropZone: boolean
  readonly disabled: boolean
  readonly buttonText: string
}

interface UploadInputProps {
  readonly inputRef: Ref<HTMLInputElement>
  readonly inputId: string | undefined
  readonly accept: string | undefined
  readonly allowMultiple: boolean
  readonly disabled: boolean
  readonly buttonText: string
  readonly onChange: ChangeEventHandler<HTMLInputElement>
}

function UploadInput({
  inputRef,
  inputId,
  accept,
  allowMultiple,
  disabled,
  buttonText,
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
      onChange={onChange}
    />
  )
}

function UploadLabel({ inputId, dropZone, disabled, buttonText }: UploadLabelProps): ReactElement {
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-colors',
        dropZone &&
          'min-h-[120px] cursor-pointer flex-col justify-center border-dashed text-center',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'border-border bg-background text-foreground hover:bg-background-subtle cursor-pointer'
      )}
      aria-disabled={disabled ? 'true' : undefined}
    >
      <span aria-hidden="true">+</span>
      <span>{dropZone ? `Drag and drop files here or browse — ${buttonText}` : buttonText}</span>
    </label>
  )
}

interface FileUploadFeedbackProps {
  readonly error: string | undefined
  readonly fileNames: readonly string[]
}

function FileUploadFeedback({
  error,
  fileNames,
}: FileUploadFeedbackProps): ReactElement | undefined {
  if (error) {
    return (
      <p
        role="alert"
        className="text-destructive text-sm"
      >
        {error}
      </p>
    )
  }
  if (fileNames.length > 0) return <FileNameList fileNames={fileNames} />
  return undefined
}

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
  const { error, fileNames, submitting, handleChange } = useFileUploadState({
    maxFiles,
    maxFileSize,
    uploadAction,
    onSuccess,
    onError,
  })
  const allowMultiple = typeof maxFiles === 'number' ? maxFiles > 1 : false
  const inputId = id ? `${id}-input` : undefined
  const buttonText = label ?? 'Upload file'
  const controlsDisabled = disabled || submitting

  return (
    <div
      className="flex flex-col gap-2"
      data-component="file-upload-island"
      data-dropzone={dropZone ? 'true' : undefined}
      data-island-mounted="true"
    >
      <UploadLabel
        inputId={inputId}
        dropZone={dropZone}
        disabled={controlsDisabled}
        buttonText={buttonText}
      />
      <UploadInput
        inputRef={inputRef}
        inputId={inputId}
        accept={accept}
        allowMultiple={allowMultiple}
        disabled={controlsDisabled}
        buttonText={buttonText}
        onChange={handleChange}
      />
      <FileUploadFeedback
        error={error}
        fileNames={fileNames}
      />
    </div>
  )
}
