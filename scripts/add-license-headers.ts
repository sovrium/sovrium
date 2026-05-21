#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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

const COPYRIGHT_START_YEAR = 2025
const currentYear = new Date().getFullYear()
const COPYRIGHT_SPAN =
  currentYear > COPYRIGHT_START_YEAR
    ? `${COPYRIGHT_START_YEAR}-${currentYear}`
    : `${COPYRIGHT_START_YEAR}`

const LICENSE_HEADER = `/**
 * Copyright (c) ${COPYRIGHT_SPAN} ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

`

const EXISTING_HEADER_PATTERN =
  /^\/\*\*\n \* Copyright \(c\) \d{4}(?:-\d{4})? ESSENTIAL SERVICES\n \*\n \* This source code is licensed under the Business Source License 1\.1\n \* found in the LICENSE\.md file in the root directory of this source tree\.\n \*\/\n\n/

const SHEBANG_PATTERN = /^#!\/usr\/bin\/env bun\n/

const ROOT_DIR = process.cwd()

const INCLUDE_PATTERNS = [
  'src/**/*.{ts,tsx,js,jsx}',
  'scripts/**/*.{ts,tsx}',
  'specs/**/*.{ts,tsx}',
  'eslint/**/*.{ts,tsx}',
  'eslint.config.ts',
]

const splitShebang = (content: string): { shebang: string; body: string } => {
  const match = content.match(SHEBANG_PATTERN)
  if (!match) return { shebang: '', body: content }
  return { shebang: match[0], body: content.slice(match[0].length) }
}

const inspectHeader = (
  content: string
): { state: 'current' | 'stale' | 'missing'; staleHeader?: string } => {
  const { body } = splitShebang(content.replace(/\r\n/g, '\n'))

  if (body.startsWith(LICENSE_HEADER)) return { state: 'current' }

  const stale = body.match(EXISTING_HEADER_PATTERN)
  if (stale) return { state: 'stale', staleHeader: stale[0] }

  return { state: 'missing' }
}

const addLicenseHeaderToFile = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystemService

    const content = yield* fs.readFile(filePath)
    const { shebang, body } = splitShebang(content)
    const inspection = inspectHeader(content)

    if (inspection.state === 'current') {
      return { filePath, added: false, updated: false }
    }

    const newBody =
      inspection.state === 'stale'
        ? LICENSE_HEADER + body.slice(inspection.staleHeader!.length)
        : LICENSE_HEADER + body

    yield* fs.writeFile(filePath, shebang + newBody)

    return {
      filePath,
      added: inspection.state === 'missing',
      updated: inspection.state === 'stale',
    }
  })

const main = Effect.gen(function* () {
  const fs = yield* FileSystemService

  yield* section('Adding license headers to source files')

  yield* progress('Finding source files...')

  const allFiles = yield* Effect.all(
    INCLUDE_PATTERNS.map((pattern) =>
      fs.glob(pattern).pipe(Effect.catchAll(() => Effect.succeed([] as readonly string[])))
    ),
    { concurrency: 'unbounded' }
  )

  const files = Array.from(new Set(allFiles.flat()))
  yield* success(`Found ${files.length} source files`)

  yield* Effect.log('')
  yield* progress('Processing files in parallel...')

  const results = yield* Effect.all(
    files.map((file) =>
      addLicenseHeaderToFile(file).pipe(
        Effect.catchAll((error) =>
          Effect.succeed({
            filePath: file,
            added: false,
            updated: false,
            error: String(error),
          })
        )
      )
    ),
    { concurrency: 10 }
  )

  const added = results.filter((r) => r.added).length
  const updated = results.filter((r) => 'updated' in r && r.updated).length
  const skipped = results.filter(
    (r) => !r.added && !('error' in r) && !('updated' in r && r.updated)
  ).length
  const errors = results.filter((r) => 'error' in r).length

  for (const result of results) {
    const relativePath = relative(ROOT_DIR, result.filePath)
    if (result.added) {
      yield* success(`Added header to: ${relativePath}`)
    } else if ('updated' in result && result.updated) {
      yield* success(`Updated header in: ${relativePath}`)
    }
  }

  yield* Effect.log('')
  yield* Effect.log('='.repeat(50))
  yield* Effect.log(`Headers added:   ${added}`)
  yield* Effect.log(`Headers updated: ${updated}`)
  yield* Effect.log(`Already current: ${skipped}`)
  if (errors > 0) {
    yield* Effect.log(`Errors:          ${errors}`)
  }
  yield* Effect.log('='.repeat(50))
  yield* Effect.log('')
  yield* success('License headers processed successfully!')
})

const MainLayer = Layer.mergeAll(FileSystemServiceLive, LoggerServicePretty())

const program = main.pipe(Effect.provide(MainLayer))

Effect.runPromise(program)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error adding license headers:', error)
    process.exit(1)
  })
