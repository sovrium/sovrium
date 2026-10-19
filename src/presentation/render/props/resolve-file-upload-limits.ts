/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a `file-upload` takes, and how its drop zone says so.
 *
 * Two things are resolved here, where the app's buckets and its languages are
 * known, so the island only prints them:
 *
 * - **The bucket's own rule, when the control states none.** A control
 *   uploading to a declared bucket (`/api/buckets/<name>/files`, or its
 *   operator twin under `/api/admin/`) that declares neither `accept` nor
 *   `maxFileSize` takes the bucket's: the server refuses anything else, so the
 *   picker and the drop zone should say so before a file is sent. A control
 *   that declares either keeps exactly what it declares.
 * - **The types in words.** `application/pdf` is a PDF, `image/*` is images:
 *   the drop zone names the types the way a person knows them, never the MIME
 *   type the server checks. An extension (`.pdf`) is already a word and stays.
 */

import { fileKindOf } from '@/domain/kernel/format/file-kind'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Languages } from '@/domain/models/app/languages'

/** What the control declares, and where it uploads. */
export interface FileUploadLimitsInput {
  readonly accept?: string
  readonly maxFileSize?: number
  readonly uploadAction?: string
  readonly buckets?: Buckets
  readonly currentLang?: string
  readonly languages?: Languages
}

/** What the control takes, with the accepted types in words for its drop zone. */
export interface FileUploadLimits {
  readonly accept?: string
  readonly maxFileSize?: number
  readonly acceptLabel?: string
}

/** A bucket's file routes: the public one and the operator's. */
const BUCKET_UPLOAD_URL = /^\/api\/(?:admin\/)?buckets\/([^/?#]+)\/files\/?(?:[?#].*)?$/

/** The declared bucket `uploadAction` posts to, when it posts to one. */
function targetBucket(uploadAction: string | undefined, buckets: Buckets | undefined) {
  const name = uploadAction === undefined ? undefined : BUCKET_UPLOAD_URL.exec(uploadAction)?.[1]
  return name === undefined ? undefined : buckets?.find((bucket) => bucket.name === name)
}

/** `image/png,application/pdf,image/*` as `PNG, PDF, images`, in the page language. */
export function acceptInWords(
  accept: string,
  currentLang: string | undefined,
  languages: Languages | undefined
): string | undefined {
  const words = accept
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((entry) => {
      const kind = fileKindOf(entry)
      return 'word' in kind
        ? kind.word
        : resolveInterpreterString(`fileKind.${kind.family}`, currentLang, languages)
    })
  return words.length === 0 ? undefined : [...new Set(words)].join(', ')
}

/** The rule the control states, else the one its bucket declares when it states none. */
function declaredRule(
  input: FileUploadLimitsInput
): Pick<FileUploadLimits, 'accept' | 'maxFileSize'> {
  if (input.accept !== undefined || input.maxFileSize !== undefined) {
    return { accept: input.accept, maxFileSize: input.maxFileSize }
  }
  const bucket = targetBucket(input.uploadAction, input.buckets)
  const types = bucket?.allowedMimeTypes ?? []
  return {
    accept: types.length > 0 ? types.join(',') : undefined,
    maxFileSize: bucket?.maxFileSize,
  }
}

/** The control's `accept` and size cap — its own, else its bucket's — and the types in words. */
export function resolveFileUploadLimits(input: FileUploadLimitsInput): FileUploadLimits {
  const { accept, maxFileSize } = declaredRule(input)
  const acceptLabel =
    accept === undefined ? undefined : acceptInWords(accept, input.currentLang, input.languages)
  return {
    ...(accept === undefined ? {} : { accept }),
    ...(maxFileSize === undefined ? {} : { maxFileSize }),
    ...(acceptLabel === undefined ? {} : { acceptLabel }),
  }
}
