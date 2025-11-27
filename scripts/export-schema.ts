#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Export Effect Schema to JSON Schema
 *
 * Converts the AppSchema from Effect Schema format to JSON Schema format
 * and saves it to schemas/{version}/app.schema.json
 *
 * Usage:
 *   bun run export:schema                     # Uses "development" folder
 *   bun run export:schema --version 1.0.0    # Uses specified version folder
 *   bun run export:schema --release          # Uses version from package.json
 *
 * In release context (CI), use --version to specify the release version.
 * In development context, schemas go to schemas/development/ (gitignored).
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { JSONSchema } from 'effect'
import { AppSchema } from '../src/domain/models/app'

/**
 * Determine the version folder based on CLI arguments
 *
 * Priority:
 * 1. --version X.Y.Z → use specified version
 * 2. --release → use version from package.json
 * 3. default → use "development"
 */
const getVersion = async (): Promise<string> => {
  const args = process.argv.slice(2)

  // Check for --version flag
  const versionIndex = args.indexOf('--version')
  if (versionIndex !== -1 && args[versionIndex + 1]) {
    return args[versionIndex + 1]
  }

  // Check for --release flag (use package.json version)
  if (args.includes('--release')) {
    const packageJson = await Bun.file('package.json').json()
    return packageJson.version as string
  }

  // Default to development
  return 'development'
}

const version = await getVersion()

// Generate JSON Schema from Effect Schema
const jsonSchema = JSONSchema.make(AppSchema)

// Add JSON Schema metadata
const schemaWithMetadata = {
  $id: `https://sovrium.com/schemas/${version}/app.schema.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  ...jsonSchema,
}

// Output path
const outputPath = join('schemas', version, 'app.schema.json')

// Ensure directory exists
await mkdir(dirname(outputPath), { recursive: true })

// Write formatted JSON
await writeFile(outputPath, JSON.stringify(schemaWithMetadata, null, 2) + '\n')

console.log(`✅ Exported Effect Schema to ${outputPath}`)
