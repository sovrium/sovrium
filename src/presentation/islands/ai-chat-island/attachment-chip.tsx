/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeAttachmentClasses,
  computeAttachmentContentClasses,
  computeAttachmentDescriptionClasses,
  computeAttachmentMediaClasses,
  computeAttachmentTitleClasses,
} from '@/presentation/design/attachment-default-classes'
import { computeInputGroupIconButtonClasses } from '@/presentation/design/input-group-default-classes'
import type { ChatAttachment } from './types'
import type { ReactElement } from 'react'

/** A byte count the way a file list reads it: `840 B`, `12 KB`, `3.4 MB`. */
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Lucide `file`, inline: one glyph does not justify an icon library in this island. */
const FileGlyph = (): ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
)

/** Lucide `x`, inline, for the remove control. */
const CloseGlyph = (): ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)

interface AttachmentChipProps {
  readonly file: ChatAttachment
  /** The words saying the file does not reach the agent, in the page language. */
  readonly notSentLabel: string
  /** Present in the composer only: takes the file back out before sending. */
  readonly onRemove?: () => void
  /** The chip's own line, in place of the size: a cited source's excerpt. */
  readonly description?: string
  /** The element id a citation in the answer links to. */
  readonly id?: string
}

/** The chip's second line: the size, then what became of the file. */
const describe = (file: ChatAttachment, notSentLabel: string): string => {
  const state = file.state ?? 'idle'
  if (state === 'error') return file.error ?? ''
  if (state === 'idle') return `${formatSize(file.size)} · ${notSentLabel}`
  return formatSize(file.size)
}

/** The file name; once stored, a link that opens the file for its uploader. */
const ChipTitle = ({ file }: { readonly file: ChatAttachment }): ReactElement => (
  <span
    data-slot="attachment-title"
    className={computeAttachmentTitleClasses()}
  >
    {file.attachmentId === undefined ? (
      file.name
    ) : (
      <a
        href={`/api/ai/chat/attachments/${file.attachmentId}`}
        target="_blank"
        rel="noopener"
      >
        {file.name}
      </a>
    )}
  </span>
)

/**
 * One file as the `attachment` type draws it (`sm`, horizontal): the file
 * glyph, the name, a line under it, and in the composer a control to remove it.
 *
 * Its state follows the file. `idle` is a file kept in the browser (a chat with
 * no `attachments` block): the line says the agent does not receive it, on the
 * sent turn too. An uploaded file is `uploading`, then `done` — its name opens
 * the stored file — or `error`, whose line is the reason it was refused.
 */
export function AttachmentChip({
  file,
  notSentLabel,
  onRemove,
  description,
  id,
}: AttachmentChipProps): ReactElement {
  const state = file.state ?? 'idle'
  return (
    <div
      id={id}
      data-slot="attachment"
      data-state={state}
      data-size="sm"
      data-orientation="horizontal"
      data-testid="chat-attachment"
      data-attachment-id={file.attachmentId}
      aria-busy={state === 'uploading' ? true : undefined}
      className={computeAttachmentClasses('sm', 'horizontal')}
    >
      <div
        data-slot="attachment-media"
        data-variant="icon"
        className={computeAttachmentMediaClasses('icon')}
      >
        <FileGlyph />
      </div>
      <div
        data-slot="attachment-content"
        className={computeAttachmentContentClasses()}
      >
        <ChipTitle file={file} />
        <span
          data-slot="attachment-description"
          className={computeAttachmentDescriptionClasses()}
        >
          {description ?? describe(file, notSentLabel)}
        </span>
      </div>
      {onRemove !== undefined && (
        <button
          type="button"
          data-slot="attachment-remove"
          aria-label={`Remove ${file.name}`}
          onClick={onRemove}
          className={computeInputGroupIconButtonClasses()}
        >
          <CloseGlyph />
        </button>
      )}
    </div>
  )
}
