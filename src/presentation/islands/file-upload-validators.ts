/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export function validateMaxFiles(
  files: FileList,
  maxFiles: number | undefined
): string | undefined {
  if (typeof maxFiles !== 'number') return undefined
  if (files.length <= maxFiles) return undefined
  return `Too many files (max ${maxFiles})`
}

export function validateMaxFileSize(
  files: FileList,
  maxFileSize: number | undefined
): string | undefined {
  if (typeof maxFileSize !== 'number') return undefined
  const oversized = Array.from(files).find((file) => file.size > maxFileSize)
  if (!oversized) return undefined
  const limitMb = (maxFileSize / 1_048_576).toFixed(1)
  return `File "${oversized.name}" is too large — size limit is ${limitMb}MB`
}

export function validateFiles(
  files: FileList | undefined | null,
  maxFiles: number | undefined,
  maxFileSize: number | undefined
): string | undefined {
  if (!files || files.length === 0) return undefined
  return validateMaxFiles(files, maxFiles) ?? validateMaxFileSize(files, maxFileSize)
}
