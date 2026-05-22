/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import path from 'node:path'

export const formatPathForDisplay = (absPath: string, cwd: string = process.cwd()): string => {
  if (!path.isAbsolute(absPath)) return absPath
  const rel = path.relative(cwd, absPath)
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return absPath
  return `./${rel}`
}
