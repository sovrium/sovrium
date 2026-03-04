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
 * Generates a merged OpenAPI specification from the app API routes and
 * Better Auth endpoints, then saves it to schemas/{version}/app.openapi.json
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
import { getOpenAPIDocument } from '../src/infrastructure/server/route-setup/openapi-schema'

/**
 * Dynamically import auth module after ensuring DATABASE_URL is set.
 * The Drizzle connection is lazy (no queries run), but the env var must exist at import time.
 */
async function getAuthOpenAPISchema(): Promise<Record<string, unknown> | null> {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://dummy:dummy@localhost:5432/dummy'
  }
  try {
    const { auth } = await import('../src/infrastructure/auth/better-auth/auth')
    return (await auth.api.generateOpenAPISchema()) as Record<string, unknown>
  } catch (error) {
    console.warn('\u26A0\uFE0F  Could not generate Better Auth schema:', error)
    return null
  }
}

/**
 * Merge two OpenAPI 3.x documents into one.
 *
 * Combines paths, component schemas, and tags from both documents.
 * The primary document's info block is used as-is.
 */
function mergeOpenAPISchemas(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>
): Record<string, unknown> {
  const primaryPaths = (primary.paths ?? {}) as Record<string, unknown>
  const rawSecondaryPaths = (secondary.paths ?? {}) as Record<string, unknown>

  // Prefix auth paths with /api/auth (Better Auth generates relative paths)
  const secondaryPaths = Object.fromEntries(
    Object.entries(rawSecondaryPaths).map(([path, value]) => [
      path.startsWith('/api/') ? path : `/api/auth${path}`,
      value,
    ])
  )

  const primaryComponents = (primary.components ?? {}) as Record<string, unknown>
  const secondaryComponents = (secondary.components ?? {}) as Record<string, unknown>

  const primarySchemas = (primaryComponents.schemas ?? {}) as Record<string, unknown>
  const secondarySchemas = (secondaryComponents.schemas ?? {}) as Record<string, unknown>

  const primaryTags = (primary.tags ?? []) as readonly Record<string, unknown>[]
  const secondaryTags = (secondary.tags ?? []) as readonly Record<string, unknown>[]

  // Merge tags, deduplicating by name
  const existingTagNames = new Set(primaryTags.map((t) => t.name as string))
  const mergedTags = [
    ...primaryTags,
    ...secondaryTags.filter((t) => !existingTagNames.has(t.name as string)),
  ]

  return {
    ...primary,
    paths: { ...primaryPaths, ...secondaryPaths },
    components: {
      ...primaryComponents,
      ...secondaryComponents,
      schemas: { ...primarySchemas, ...secondarySchemas },
    },
    tags: mergedTags,
  }
}

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

/**
 * Derive a human-readable summary from a description or path + method.
 *
 * 1. If description exists, take its first sentence (capped at ~60 chars)
 * 2. Otherwise, humanize the path segments after /api/auth/
 */
function deriveSummary(_method: string, path: string, description?: string): string {
  if (description) {
    const firstSentence = description.split(/\.\s/)[0] ?? description
    const trimmed = firstSentence.replace(/\.$/, '')
    return trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}...`
  }

  // Fallback: humanize path segments
  const raw = path
    .replace(/^\/api\/auth\/?/, '')
    .replace(/\{[^}]+\}/g, '') // strip path params
    .replace(/\/+$/, '') // trailing slashes

  if (!raw) return 'Auth'

  const words = raw.split(/[/-]/).filter(Boolean)
  const label = words.join(' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Generate an operationId from method + path for auth endpoints.
 *
 * Pattern: "auth" + camelCase path segments after /api/auth/
 * e.g. POST /api/auth/revoke-session → "authRevokeSession"
 * e.g. GET /api/auth/list-sessions → "authListSessions"
 * e.g. GET /api/auth/callback/{id} → "authCallbackId"
 */
function deriveOperationId(method: string, path: string): string {
  const prefix = method.toLowerCase()
  const segments = path
    .replace(/^\/api\/auth\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/[{}]/g, ''))
    .flatMap((s) => s.split('-'))

  if (segments.length === 0) return `${prefix}Auth`

  const camelCase = segments
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('')

  return `${prefix}Auth${camelCase}`
}

type OpenAPIOperation = Record<string, unknown>
type OpenAPIPaths = Record<string, Record<string, OpenAPIOperation>>
type OpenAPITag = { name: string; description?: string }
type OpenAPIDoc = Record<string, unknown> & {
  paths?: OpenAPIPaths
  tags?: OpenAPITag[]
}

/**
 * Normalize auth endpoints in the merged OpenAPI document.
 *
 * 1. Rename "Default" tag → "auth"
 * 2. Add missing summaries
 * 3. Generate missing operationIds
 * 4. Strip empty parameters arrays
 */
function normalizeAuthEndpoints(doc: OpenAPIDoc): OpenAPIDoc {
  const tags = (doc.tags ?? []) as OpenAPITag[]
  const paths = (doc.paths ?? {}) as OpenAPIPaths

  // 1. Rename "Default" tag → "auth"
  const normalizedTags = tags.map((tag) =>
    tag.name === 'Default'
      ? { name: 'auth', description: 'Authentication and session management' }
      : tag
  )

  // 2-4. Normalize each auth endpoint operation
  const normalizedPaths: OpenAPIPaths = {}
  for (const [path, methods] of Object.entries(paths)) {
    const isAuthPath = path.startsWith('/api/auth/')

    if (!isAuthPath) {
      normalizedPaths[path] = methods
      continue
    }

    const normalizedMethods: Record<string, OpenAPIOperation> = {}
    for (const [method, operation] of Object.entries(methods)) {
      const op = { ...operation }

      // 1. Replace "Default" tag with "auth"
      const opTags = op.tags as string[] | undefined
      if (opTags) {
        op.tags = opTags.map((t) => (t === 'Default' ? 'auth' : t))
      }

      // 2. Add summary if missing
      if (!op.summary) {
        op.summary = deriveSummary(method, path, op.description as string | undefined)
      }

      // 3. Generate operationId if missing
      if (!op.operationId) {
        op.operationId = deriveOperationId(method, path)
      }

      // 4. Strip empty parameters array
      if (Array.isArray(op.parameters) && op.parameters.length === 0) {
        delete op.parameters
      }

      normalizedMethods[method] = op
    }
    normalizedPaths[path] = normalizedMethods
  }

  return { ...doc, tags: normalizedTags, paths: normalizedPaths }
}

const version = await getVersion()

// Generate app OpenAPI document
const appDoc = getOpenAPIDocument()

// Generate Better Auth OpenAPI document and merge
const authDoc = await getAuthOpenAPISchema()
const merged = authDoc
  ? mergeOpenAPISchemas(appDoc as unknown as Record<string, unknown>, authDoc)
  : (appDoc as unknown as Record<string, unknown>)
if (authDoc) {
  console.log('\u2705 Merged Better Auth endpoints into OpenAPI schema')
}

// Normalize auth endpoints (tags, summaries, operationIds)
const openapiDoc = normalizeAuthEndpoints(merged as OpenAPIDoc)

// Output path
const outputPath = join('schemas', version, 'app.openapi.json')

// Ensure directory exists
await mkdir(dirname(outputPath), { recursive: true })

// Write formatted JSON
await writeFile(outputPath, JSON.stringify(openapiDoc, null, 2) + '\n')

console.log(`✅ Exported OpenAPI schema to ${outputPath}`)
