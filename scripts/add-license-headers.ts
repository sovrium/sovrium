#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { relative } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import {
  FileSystemService,
  FileSystemServiceLive,
  LoggerServicePretty,
  progress,
  success,
  section,
} from './lib/effect'

const LICENSE_HEADER = `/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

`

const SHEBANG_PATTERN = /^#!\/usr\/bin\/env bun\n/

const ROOT_DIR = process.cwd()
const INCLUDE_DIRS = ['src', 'scripts', 'specs']

/**
 * Check if content has license header
 */
const hasLicenseHeader = (content: string): boolean => {
  const normalizedContent = content.replace(/\r\n/g, '\n')
  const normalizedHeader = LICENSE_HEADER.replace(/\r\n/g, '\n')

  // Check if content starts with shebang
  if (SHEBANG_PATTERN.test(normalizedContent)) {
    // Check if license header comes after shebang
    const afterShebang = normalizedContent.replace(SHEBANG_PATTERN, '')
    return afterShebang.trim().startsWith(normalizedHeader.trim())
  }

  // Check if content starts with license header
  return normalizedContent.trim().startsWith(normalizedHeader.trim())
}

/**
 * Add license header to a single file
 * Returns true if header was added, false if already present
 */
const addLicenseHeaderToFile = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService

    const content = yield* fs.readFile(filePath)

    // Skip if already has license header
    if (hasLicenseHeader(content)) {
      return { filePath, added: false }
    }

    let newContent: string

    // Preserve shebang if present
    if (SHEBANG_PATTERN.test(content)) {
      const shebang = content.match(SHEBANG_PATTERN)![0]
      const afterShebang = content.replace(SHEBANG_PATTERN, '')
      newContent = shebang + LICENSE_HEADER + afterShebang
    } else {
      newContent = LICENSE_HEADER + content
    }

    yield* fs.writeFile(filePath, newContent)

    return { filePath, added: true }
  })

/**
 * Main license header addition program
 */
const main = Effect.gen(function* () {
  const fs = yield* FileSystemService

  yield* section('Adding license headers to source files')

  // Find all TypeScript files in included directories
  yield* progress('Finding TypeScript files...')

  const allFiles = yield* Effect.all(
    INCLUDE_DIRS.map((dir) =>
      fs
        .glob(`${dir}/**/*.{ts,tsx}`)
        .pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))
    ),
    { concurrency: 'unbounded' }
  )

  const files = allFiles.flat()
  yield* success(`Found ${files.length} TypeScript files`)

  // Process all files in parallel
  yield* Effect.log('')
  yield* progress('Processing files in parallel...')

  const results = yield* Effect.all(
    files.map((file) =>
      addLicenseHeaderToFile(file).pipe(
        Effect.catchAll((error) => {
          // Log error but continue processing other files
          return Effect.succeed({ filePath: file, added: false, error: String(error) })
        })
      )
    ),
    { concurrency: 10 } // Process 10 files at a time
  )

  // Calculate statistics
  const processed = results.filter((r) => r.added).length
  const skipped = results.filter((r) => !r.added && !('error' in r)).length
  const errors = results.filter((r) => 'error' in r).length

  // Log processed files
  for (const result of results) {
    if (result.added) {
      const relativePath = relative(ROOT_DIR, result.filePath)
      yield* success(`Added header to: ${relativePath}`)
    }
  }

  // Display summary
  yield* Effect.log('')
  yield* Effect.log('='.repeat(50))
  yield* Effect.log(`Total files processed: ${processed}`)
  yield* Effect.log(`Files already with headers: ${skipped}`)
  if (errors > 0) {
    yield* Effect.log(`Files with errors: ${errors}`)
  }
  yield* Effect.log('='.repeat(50))
  yield* Effect.log('')
  yield* success('License headers added successfully!')
})

// Main layer combining all services
const MainLayer = Layer.mergeAll(FileSystemServiceLive, LoggerServicePretty())

// Run the script
const program = main.pipe(Effect.provide(MainLayer))

Effect.runPromise(program)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error adding license headers:', error)
    process.exit(1)
  })
