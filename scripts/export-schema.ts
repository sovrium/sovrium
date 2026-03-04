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

// Generate JSON Schema from Effect Schema
const jsonSchema = JSONSchema.make(AppSchema)

// ---------------------------------------------------------------------------
// Post-processing: fix patternProperties with empty-string keys
// ---------------------------------------------------------------------------
// Effect Schema's Record({ key, value }) generates:
//   patternProperties: { "": <value schema> }  +  propertyNames: { pattern: "..." }
//
// While semantically correct (empty-string regex matches all, constrained by
// propertyNames), many JSON Schema viewers (json-schema.app, Swagger UI) don't
// handle this well. We transform it into:
//   patternProperties: { "<pattern>": <value schema> }

const fixEmptyPatternProperties = (node: unknown): unknown => {
  if (node === null || typeof node !== 'object') return node

  if (Array.isArray(node)) return node.map(fixEmptyPatternProperties)

  const obj = node as Record<string, unknown>
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    result[key] = fixEmptyPatternProperties(value)
  }

  // Fix: merge propertyNames.pattern into patternProperties key
  const patternProps = result['patternProperties'] as Record<string, unknown> | undefined
  const propertyNames = result['propertyNames'] as Record<string, unknown> | undefined

  if (
    patternProps &&
    typeof patternProps === 'object' &&
    '' in patternProps &&
    propertyNames &&
    typeof propertyNames === 'object' &&
    typeof propertyNames['pattern'] === 'string'
  ) {
    const { pattern } = propertyNames
    const valueSchema = patternProps['']
    const { '': _, ...rest } = patternProps
    result['patternProperties'] = { ...rest, [pattern]: valueSchema }
    // Remove propertyNames since the constraint is now in the patternProperties key
    delete result['propertyNames']
  }

  return result
}

// Add JSON Schema metadata
const schemaWithMetadata = {
  $id: `https://sovrium.com/schemas/${version}/app.schema.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  ...(fixEmptyPatternProperties(jsonSchema) as Record<string, unknown>),
}

// Output path
const outputPath = join('schemas', version, 'app.schema.json')

// Ensure directory exists
await mkdir(dirname(outputPath), { recursive: true })

// Write formatted JSON
await writeFile(outputPath, JSON.stringify(schemaWithMetadata, null, 2) + '\n')

console.log(`✅ Exported Effect Schema to ${outputPath}`)
