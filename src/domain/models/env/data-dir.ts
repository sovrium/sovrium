/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as path from 'node:path'

export const DEFAULT_DATA_DIR = './.sovrium'

export const parseDataDir = (): string =>
  path.resolve(process.env.SOVRIUM_DATA_DIR || DEFAULT_DATA_DIR)

export const defaultSqliteDbPath = (): string => path.join(parseDataDir(), 'database.db')

export const defaultLockDir = (): string => parseDataDir()

export const defaultUploadsDir = (): string => path.join(parseDataDir(), 'storage')
