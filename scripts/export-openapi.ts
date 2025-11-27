#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Export OpenAPI Schema
 *
 * Generates the OpenAPI specification from the runtime API routes
 * and saves it to schemas/{version}/app.openapi.json
 *
 * Usage:
 *   bun run export:openapi                     # Uses "development" folder
 *   bun run export:openapi --version 1.0.0    # Uses specified version folder
 *   bun run export:openapi --release          # Uses version from package.json
 *
 * In release context (CI), use --version to specify the release version.
 * In development context, schemas go to schemas/development/ (gitignored).
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getOpenAPIDocument } from '../src/presentation/api/openapi-schema'

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
  const versionArg = args[versionIndex + 1]
  if (versionIndex !== -1 && versionArg) {
    return versionArg
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

// Generate OpenAPI document
const openapiDoc = getOpenAPIDocument()

// Output path
const outputPath = join('schemas', version, 'app.openapi.json')

// Ensure directory exists
await mkdir(dirname(outputPath), { recursive: true })

// Write formatted JSON
await writeFile(outputPath, JSON.stringify(openapiDoc, null, 2) + '\n')

console.log(`✅ Exported OpenAPI schema to ${outputPath}`)
