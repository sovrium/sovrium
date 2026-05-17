/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Editor } from '@tiptap/react'

/**
 * Upload a `File` to the configured rich-text image bucket and return the
 * served-asset URL. Falls back to `default` when no bucket is bound.
 *
 * The endpoint mirrors the contract asserted by APP-PAGES-CRUD-WYSIWYG-004 /
 * -005 (multipart POST `/api/buckets/<name>/files`).
 */
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

/**
 * Extract the first image File from a clipboard or drop DataTransfer.
 *
 * The test (APP-PAGES-CRUD-WYSIWYG-005) constructs a `ClipboardEvent` whose
 * `clipboardData` carries a `File`. ProseMirror's default paste handler doesn't
 * upload arbitrary files, so this helper is what wires the user-paste flow to
 * the bucket upload.
 */
export function extractImageFile(dataTransfer: DataTransfer | null): File | undefined {
  if (!dataTransfer) return undefined
  const fromItems = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .find((file): file is File => !!file && file.type.startsWith('image/'))
  if (fromItems) return fromItems
  return Array.from(dataTransfer.files ?? []).find((file) => file.type.startsWith('image/'))
}

/**
 * Insert an `<img>` referencing the uploaded file URL into the editor.
 */
export function insertImageAtCursor(editor: Editor, src: string): void {
  editor.chain().focus().setImage({ src }).run()
}
