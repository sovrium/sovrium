/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Editor } from '@tiptap/react'

export async function uploadImageToBucket(file: File, bucket: string): Promise<string | undefined> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`/api/buckets/${encodeURIComponent(bucket)}/files`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    return undefined
  }
  const result = (await response.json()) as { readonly success?: boolean; readonly key?: string }
  if (!result.success || !result.key) {
    return undefined
  }
  return `/api/buckets/${encodeURIComponent(bucket)}/files/${encodeURIComponent(result.key)}`
}

export function extractImageFile(dataTransfer: DataTransfer | null): File | undefined {
  if (!dataTransfer) return undefined
  const fromItems = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .find((file): file is File => !!file && file.type.startsWith('image/'))
  if (fromItems) return fromItems
  return Array.from(dataTransfer.files ?? []).find((file) => file.type.startsWith('image/'))
}

export function insertImageAtCursor(editor: Editor, src: string): void {
  editor.chain().focus().setImage({ src }).run()
}
