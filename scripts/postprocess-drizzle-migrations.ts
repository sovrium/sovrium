/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const MIGRATIONS_DIR = join(import.meta.dir, '..', 'drizzle')

const addIfNotExistsToSchemas = (sql: string): string =>
  sql.replace(/CREATE SCHEMA (?!IF NOT EXISTS )("[^"]+")/g, 'CREATE SCHEMA IF NOT EXISTS $1')

const main = async (): Promise<void> => {
  const entries = await readdir(MIGRATIONS_DIR)
  const sqlFiles = entries.filter((name) => name.endsWith('.sql'))

  const results = await Promise.all(
    sqlFiles.map(async (file) => {
      const path = join(MIGRATIONS_DIR, file)
      const original = await readFile(path, 'utf8')
      const patched = addIfNotExistsToSchemas(original)
      if (patched === original) return false
      await writeFile(path, patched, 'utf8')
      console.log(`Patched CREATE SCHEMA statements in drizzle/${file}`)
      return true
    })
  )

  if (!results.some(Boolean)) {
    console.log('postprocess-drizzle-migrations: no CREATE SCHEMA statements needed patching.')
  }
}

await main()
