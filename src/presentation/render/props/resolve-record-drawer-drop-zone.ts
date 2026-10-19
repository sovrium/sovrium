/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The words an attachment's drop zone draws in a record sheet: "Drop files or
 * browse", and what its bucket takes — `PDF, images · 20 MB each` — in the
 * page language, never the MIME types and byte counts the server checks.
 *
 * Resolved here, where the app's buckets and its languages are known; the
 * island only prints them.
 */

import { formatByteCount } from '@/domain/kernel/format/byte-format'
import { fileKindOf } from '@/domain/kernel/format/file-kind'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Languages } from '@/domain/models/app/languages'

/** What a drop zone says, resolved for the page. */
export interface DropZoneWords {
  /** `Drop files or {browse}`: `{browse}` is where the button sits. */
  readonly prompt: string
  readonly browse: string
  /** What the bucket takes, when it declares any limit. */
  readonly hint?: string
}

const ATTACHMENT_TYPES: ReadonlySet<unknown> = new Set([
  'single-attachment',
  'multiple-attachments',
])

interface DropZoneContext {
  readonly buckets: Buckets | undefined
  readonly currentLang: string | undefined
  readonly languages: Languages | undefined
}

/** The accepted types and the size limit of `bucketName`, in words. */
function limitsHint(bucketName: unknown, context: DropZoneContext): string | undefined {
  const bucket = context.buckets?.find((candidate) => candidate.name === bucketName)
  if (bucket === undefined) return undefined
  const resolve = (key: string) =>
    resolveInterpreterString(key, context.currentLang, context.languages)
  const kinds = (bucket.allowedMimeTypes ?? []).map((mime) => {
    const kind = fileKindOf(mime)
    return 'word' in kind ? kind.word : resolve(`fileKind.${kind.family}`)
  })
  const size =
    bucket.maxFileSize === undefined
      ? undefined
      : resolve('fileUpload.sizeEach').replace(
          '{size}',
          formatByteCount(bucket.maxFileSize, context.currentLang)
        )
  const parts = [kinds.length === 0 ? undefined : [...new Set(kinds)].join(', '), size].filter(
    (part): part is string => part !== undefined
  )
  return parts.length === 0 ? undefined : parts.join(' · ')
}

/**
 * The drawer's entries, each attachment one carrying its drop zone's words;
 * every other entry as it was.
 */
export function withDropZoneWords<E>(entries: E, context: DropZoneContext): E {
  if (!Array.isArray(entries)) return entries
  const resolve = (key: string) =>
    resolveInterpreterString(key, context.currentLang, context.languages)
  return entries.map((entry: Readonly<Record<string, unknown>>) => {
    if (!ATTACHMENT_TYPES.has(entry['type'])) return entry
    const hint = limitsHint(entry['bucket'], context)
    const dropZone: DropZoneWords = {
      prompt: resolve('recordDrawer.dropFiles'),
      browse: resolve('recordDrawer.browse'),
      ...(hint === undefined ? {} : { hint }),
    }
    return { ...entry, dropZone }
  }) as E
}
