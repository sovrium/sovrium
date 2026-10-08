/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A filename safe to put in a key, a step result or a file a consumer hands
 * on: its last path segment, with every character outside letters, digits,
 * `.`, `-` and `_` replaced by `-`, and no leading `.` or `-`. A name that
 * cleans to nothing is `file`.
 */
export const safeFilename = (filename: string): string => {
  const base = filename.slice(Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\')) + 1)
  const cleaned = base.replace(/[^\w.-]+/g, '-').replace(/^[.-]+/, '')
  return cleaned === '' ? 'file' : cleaned
}
