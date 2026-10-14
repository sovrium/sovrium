/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useRef } from 'react'
import { computeAiChatComposerButtonClasses } from '@/presentation/design/ai-chat-composition-classes'
import { computeInputGroupAddonClasses } from '@/presentation/design/input-group-default-classes'
import { AttachmentChip } from './attachment-chip'
import type { ChatAttachment, ChatLabels, ComposerLabels } from './types'
import type { ReactElement } from 'react'

/**
 * The composer's files: the Attach control with the picker it opens, and the
 * picked files waiting in a `block-start` addon as removable `attachment`
 * chips.
 */

const ATTACH_BUTTON = computeAiChatComposerButtonClasses('ghost')

/** The attach control and the hidden picker it opens, shown only when `allowAttachments`. */
export function AttachControl({
  labels,
  onPick,
}: {
  readonly labels: ComposerLabels
  readonly onPick: (files: readonly File[]) => void
}): ReactElement {
  const pickerRef = useRef<HTMLInputElement>(null)
  const open = useCallback(() => pickerRef.current?.click(), [])
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onPick([...(e.target.files ?? [])])
      e.target.value = ''
    },
    [onPick]
  )
  return (
    <>
      <input
        ref={pickerRef}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        data-testid="chat-attach-input"
        onChange={handleChange}
      />
      <button
        type="button"
        data-slot="input-group-button"
        data-testid="chat-attach"
        aria-label={labels.attachFile}
        onClick={open}
        className={ATTACH_BUTTON}
      >
        {labels.attach}
      </button>
    </>
  )
}

/** The picked files, waiting in the composer as removable `attachment` chips. */
export function PickedFiles({
  files,
  labels,
  onRemove,
}: {
  readonly files: readonly ChatAttachment[]
  readonly labels: ChatLabels
  readonly onRemove: (index: number) => void
}): ReactElement | undefined {
  if (files.length === 0) return undefined
  return (
    <div
      role="group"
      aria-label={labels.composer.attachedFiles}
      data-slot="input-group-addon"
      data-align="block-start"
      className={`${computeInputGroupAddonClasses({ align: 'block-start' })} flex-wrap`}
    >
      {files.map((file, index) => (
        <AttachmentChip
          key={file.localId ?? `${index}:${file.name}`}
          file={file}
          notSentLabel={labels.notSent}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  )
}
