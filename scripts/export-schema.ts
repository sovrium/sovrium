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
 * Usage: bun run export:schema
 */

import { JSONSchema } from 'effect'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { AppSchema } from '../src/domain/models/app'

// Get version from package.json
const packageJson = await Bun.file('package.json').json()
const version = packageJson.version as string

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
