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
 * Usage: bun run export:openapi
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getOpenAPIDocument } from '../src/presentation/api/openapi-schema'

// Get version from package.json
const packageJson = await Bun.file('package.json').json()
const version = packageJson.version as string

// Generate OpenAPI document
const openapiDoc = getOpenAPIDocument()

// Output path
const outputPath = join('schemas', version, 'app.openapi.json')

// Ensure directory exists
await mkdir(dirname(outputPath), { recursive: true })

// Write formatted JSON
await writeFile(outputPath, JSON.stringify(openapiDoc, null, 2) + '\n')

console.log(`✅ Exported OpenAPI schema to ${outputPath}`)
