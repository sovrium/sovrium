/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useState } from 'react'
import type { ChatAttachment } from './types'

/** What a failed upload reads when the server gave no reason. */
const UPLOAD_FAILED = 'The file could not be uploaded'

/**
 * Upload one file to the chat's attachment route and answer the chip's next
 * state: `done` with the stored file's id and type, or `error` with the reason
 * the server gave (a type it does not accept, a size over its limit).
 */
async function uploadFile(chatId: string, file: File): Promise<Partial<ChatAttachment>> {
  const form = new FormData()
  form.append('file', file)
  try {
    const res = await fetch(`/api/ai/chat/attachments?chat=${encodeURIComponent(chatId)}`, {
      method: 'POST',
      body: form,
    })
    const json = (await res.json().catch(() => undefined)) as
      | { readonly attachmentId?: unknown; readonly mimeType?: unknown; readonly error?: unknown }
      | undefined
    if (res.status === 201 && typeof json?.attachmentId === 'string') {
      return {
        state: 'done',
        attachmentId: json.attachmentId,
        ...(typeof json.mimeType === 'string' && { mimeType: json.mimeType }),
      }
    }
    return { state: 'error', error: typeof json?.error === 'string' ? json.error : UPLOAD_FAILED }
  } catch {
    return { state: 'error', error: UPLOAD_FAILED }
  }
}

/**
 * The files picked in the composer, waiting to go with the next turn.
 *
 * With `chatId` (the chat declares an `attachments` block) each file is uploaded
 * as soon as it is picked and its chip follows the upload; without it, the
 * chip stays `idle` and the file never leaves the browser.
 */
export function usePickedFiles(chatId: string | undefined) {
  const [files, setFiles] = useState<readonly ChatAttachment[]>([])

  const handlePick = useCallback(
    (picked: readonly File[]) => {
      const added = picked.map((file): ChatAttachment => ({
        localId: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        state: chatId === undefined ? 'idle' : 'uploading',
      }))
      setFiles((prev) => [...prev, ...added])
      if (chatId === undefined) return
      added.forEach((entry, index) => {
        const file = picked[index]
        if (file === undefined) return
        void uploadFile(chatId, file).then((outcome) =>
          setFiles((prev) =>
            prev.map((f) => (f.localId === entry.localId ? { ...f, ...outcome } : f))
          )
        )
      })
    },
    [chatId]
  )
  const handleRemove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])
  const clear = useCallback(() => setFiles([]), [])
  const isUploading = files.some((file) => file.state === 'uploading')
  // A refused file stays behind: only what reached the server rides on the turn.
  const sendable = useMemo(() => files.filter((file) => file.state !== 'error'), [files])
  return { files, sendable, handlePick, handleRemove, clear, isUploading }
}

/**
 * The `parts` a turn sends for its uploaded files: the question as a text
 * part, then one `file` part per stored document and one `image` part per
 * stored picture. `undefined` when the turn carries no uploaded file, so a
 * plain turn keeps sending its message alone.
 */
export const partsForTurn = (
  text: string,
  attachments: readonly ChatAttachment[]
): readonly Readonly<Record<string, string>>[] | undefined => {
  const sent = attachments.filter((file) => file.attachmentId !== undefined)
  if (sent.length === 0) return undefined
  return [
    { type: 'text', text },
    ...sent.map((file) => ({
      type: file.mimeType?.startsWith('image/') === true ? 'image' : 'file',
      attachmentId: file.attachmentId ?? '',
    })),
  ]
}
