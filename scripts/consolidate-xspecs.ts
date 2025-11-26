/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Consolidate orphaned property x-specs into parent field schemas
 *
 * This script:
 * 1. Finds all property schema files (depth 3+ in field-types/)
 * 2. Extracts their x-specs arrays
 * 3. Merges them into the parent field schema's x-specs
 * 4. Removes x-specs from child files (keeps schema for $ref)
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'

const FIELD_TYPES_DIR = 'specs/app/tables/field-types'
const DRY_RUN = process.argv.includes('--dry-run')

interface SchemaFile {
  path: string
  content: Record<string, unknown>
  xSpecs: unknown[]
}

async function findOrphanedSchemas(): Promise<string[]> {
  const orphaned: string[] = []

  async function walkDir(dir: string, depth: number): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        await walkDir(fullPath, depth + 1)
      } else if (entry.name.endsWith('.schema.json') && depth >= 2) {
        // Depth 2+ means it's inside a subdirectory of a field-type
        // e.g., field-types/email-field/default/default.schema.json (depth 2)
        const parentDir = dirname(fullPath)

        // Check if this is a property schema (not the main field schema)
        const parentDirName = basename(parentDir)

        // If parent dir name doesn't end with '-field', it's a property schema
        if (!parentDirName.endsWith('-field')) {
          orphaned.push(fullPath)
        }
      }
    }
  }

  await walkDir(FIELD_TYPES_DIR, 0)
  return orphaned.sort()
}

async function readSchemaFile(path: string): Promise<SchemaFile | null> {
  try {
    const content = await readFile(path, 'utf-8')
    const parsed = JSON.parse(content) as Record<string, unknown>
    const xSpecs = (parsed['x-specs'] as unknown[]) || []
    return { path, content: parsed, xSpecs }
  } catch (error) {
    console.error(`Error reading ${path}:`, error)
    return null
  }
}

function findParentSchemaPath(orphanedPath: string): string {
  // e.g., specs/app/tables/field-types/email-field/default/default.schema.json
  // -> specs/app/tables/field-types/email-field/email-field.schema.json
  const parts = orphanedPath.split('/')
  const fieldTypeIndex = parts.findIndex((p) => p === 'field-types') + 1

  if (fieldTypeIndex === 0 || fieldTypeIndex >= parts.length) {
    throw new Error(`Cannot find field-type in path: ${orphanedPath}`)
  }

  const fieldTypeName = parts[fieldTypeIndex] // e.g., 'email-field'
  const parentPath = parts.slice(0, fieldTypeIndex + 1).join('/')
  return `${parentPath}/${fieldTypeName}.schema.json`
}

async function consolidateXSpecs(): Promise<void> {
  console.log('Finding orphaned property schema files...\n')

  const orphanedPaths = await findOrphanedSchemas()
  console.log(`Found ${orphanedPaths.length} orphaned schema files\n`)

  // Group by parent schema
  const parentToChildren = new Map<string, string[]>()

  for (const orphanedPath of orphanedPaths) {
    const parentPath = findParentSchemaPath(orphanedPath)
    const children = parentToChildren.get(parentPath) || []
    children.push(orphanedPath)
    parentToChildren.set(parentPath, children)
  }

  console.log(`Grouped into ${parentToChildren.size} parent schemas\n`)

  let totalMerged = 0
  let totalRemoved = 0

  for (const [parentPath, childPaths] of parentToChildren) {
    const parentSchema = await readSchemaFile(parentPath)
    if (!parentSchema) {
      console.log(`⚠️  Parent schema not found: ${parentPath}`)
      continue
    }

    console.log(`\n📁 ${parentPath}`)
    console.log(`   Current x-specs: ${parentSchema.xSpecs.length}`)

    const childXSpecs: unknown[] = []

    for (const childPath of childPaths) {
      const childSchema = await readSchemaFile(childPath)
      if (!childSchema || childSchema.xSpecs.length === 0) {
        continue
      }

      console.log(`   ├─ ${basename(dirname(childPath))}/${basename(childPath)}: ${childSchema.xSpecs.length} x-specs`)
      childXSpecs.push(...childSchema.xSpecs)

      // Remove x-specs from child file
      if (!DRY_RUN) {
        delete childSchema.content['x-specs']
        await writeFile(childPath, JSON.stringify(childSchema.content, null, 2) + '\n')
        totalRemoved += 1
      }
    }

    if (childXSpecs.length > 0) {
      // Merge into parent
      const mergedXSpecs = [...parentSchema.xSpecs, ...childXSpecs]
      parentSchema.content['x-specs'] = mergedXSpecs

      console.log(`   └─ Merged: ${parentSchema.xSpecs.length} + ${childXSpecs.length} = ${mergedXSpecs.length} x-specs`)

      if (!DRY_RUN) {
        await writeFile(parentPath, JSON.stringify(parentSchema.content, null, 2) + '\n')
        totalMerged += childXSpecs.length
      }
    }
  }

  console.log('\n' + '─'.repeat(60))
  if (DRY_RUN) {
    console.log('🔍 DRY RUN - No files were modified')
    console.log(`   Would merge ${totalMerged} x-specs`)
    console.log(`   Would update ${totalRemoved} child files`)
  } else {
    console.log(`✅ Merged ${totalMerged} x-specs into parent schemas`)
    console.log(`✅ Removed x-specs from ${totalRemoved} child files`)
  }
}

// Run
consolidateXSpecs().catch(console.error)
