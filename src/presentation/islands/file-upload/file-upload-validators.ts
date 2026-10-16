/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * File-upload client-side validators. Pure functions returning a
 * human-readable error message — in the page language when the host sent the
 * `fileUpload.*` words, else English — or `undefined` when the file selection
 * passes the constraint.
 */

type UploadStrings = Readonly<Record<string, string>> | undefined

export function validateMaxFiles(
  files: FileList,
  maxFiles: number | undefined,
  strings?: UploadStrings
): string | undefined {
  if (typeof maxFiles !== 'number') return undefined
  if (files.length <= maxFiles) return undefined
  return (strings?.['fileUpload.tooMany'] ?? 'Too many files (max {count})').replace(
    '{count}',
    String(maxFiles)
  )
}

export function validateMaxFileSize(
  files: FileList,
  maxFileSize: number | undefined,
  strings?: UploadStrings
): string | undefined {
  if (typeof maxFileSize !== 'number') return undefined
  const oversized = Array.from(files).find((file) => file.size > maxFileSize)
  if (!oversized) return undefined
  const limitMb = (maxFileSize / 1_048_576).toFixed(1)
  return (
    strings?.['fileUpload.tooLarge'] ?? 'File "{name}" is too large — size limit is {limit}MB'
  )
    .replace('{name}', () => oversized.name)
    .replace('{limit}', limitMb)
}

/**
 * Composes the file-upload validators. Returns the first failing
 * constraint's error message, or `undefined` when all pass (including
 * the empty/no-files case which is treated as a no-op upstream).
 */
export function validateFiles(
  files: FileList | undefined | null,
  limits: { readonly maxFiles: number | undefined; readonly maxFileSize: number | undefined },
  strings?: UploadStrings
): string | undefined {
  if (!files || files.length === 0) return undefined
  return (
    validateMaxFiles(files, limits.maxFiles, strings) ??
    validateMaxFileSize(files, limits.maxFileSize, strings)
  )
}
