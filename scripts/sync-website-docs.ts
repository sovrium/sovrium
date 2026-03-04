/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sync Website Documentation
 *
 * Deterministic script that updates version numbers and counts in website files.
 * Replaces the Claude Code sync-docs job ($8/run, 11 min) with a ~5 second script.
 *
 * What it syncs:
 * 1. Version references (package.json → website files)
 * 2. Field type count (counted from source → website files)
 * 3. Component type count (counted from source → website files)
 * 4. Schema file copies (schemas/{version}/ → website/assets/schemas/)
 *
 * Usage:
 *   bun run scripts/sync-website-docs.ts          # Apply changes
 *   bun run scripts/sync-website-docs.ts --dry-run # Show what would change
 *   bun run sync:website                           # Via package.json script
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exit } from 'node:process'
import { Glob } from 'bun'

const ROOT = join(import.meta.dir, '..')
const dryRun = process.argv.includes('--dry-run')

// ── Terminal colors ─────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
}

const info = (msg: string) => console.log(`${c.blue}ℹ${c.reset} ${msg}`)
const ok = (msg: string) => console.log(`${c.green}✓${c.reset} ${msg}`)
const warn = (msg: string) => console.log(`${c.yellow}⚠${c.reset} ${msg}`)
const fail = (msg: string) => console.error(`${c.red}✗${c.reset} ${msg}`)

// ── Helpers ─────────────────────────────────────────────────────────────

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const read = (relPath: string): string => readFileSync(join(ROOT, relPath), 'utf-8')

// ── Step 1: Read new version from package.json ──────────────────────────

const pkg = JSON.parse(read('package.json'))
const newVersion: string = pkg.version
info(`Package version: ${c.bold}${newVersion}${c.reset}`)

// ── Step 2: Detect old version from website banner ──────────────────────

function detectOldVersion(): string {
  const content = read('website/i18n/en/docs.ts')
  const match = content.match(/Sovrium v(\d+\.\d+\.\d+)/)
  if (!match?.[1]) {
    fail('Could not detect old version from website/i18n/en/docs.ts')
    return exit(1) as never
  }
  return match[1]
}

const oldVersion = detectOldVersion()
info(`Website version: ${c.bold}${oldVersion}${c.reset}`)

// ── Step 3: Count field types from source ───────────────────────────────
//
// Reads each field-type schema file and counts Schema.Literal string values.
// DateFieldSchema has 3 values ('date', 'datetime', 'time'), all others have 1.
// Excludes base-field.ts (abstract), unknown-field.ts (catch-all), and index.ts.

async function countFieldTypes(): Promise<number> {
  const glob = new Glob('**/*.ts')
  const dir = join(ROOT, 'src/domain/models/app/table/field-types')
  let count = 0

  for await (const file of glob.scan({ cwd: dir })) {
    if (file.includes('base-field') || file.includes('unknown-field') || file === 'index.ts') {
      continue
    }
    const content = readFileSync(join(dir, file), 'utf-8')
    const match = content.match(/type:\s*Schema\.Literal\(([^)]+)\)/)
    if (match?.[1]) {
      const literals = match[1].match(/'[^']+'/g)
      if (literals) count += literals.length
    }
  }

  return count
}

// ── Step 4: Count component types from source ───────────────────────────
//
// Reads the ComponentTypeSchema in sections.ts and counts Schema.Literal values.

function countComponentTypes(): number {
  const content = read('src/domain/models/app/page/sections.ts')
  const match = content.match(
    /export const ComponentTypeSchema = Schema\.Literal\(([\s\S]*?)\)\.annotations/
  )
  if (!match?.[1]) {
    fail('Could not parse ComponentTypeSchema from sections.ts')
    return exit(1) as never
  }
  const literals = match[1].match(/'[^']+'/g)
  return literals ? literals.length : 0
}

const newFieldCount = await countFieldTypes()
const newComponentCount = countComponentTypes()
info(`Field types: ${c.bold}${newFieldCount}${c.reset}`)
info(`Component types: ${c.bold}${newComponentCount}${c.reset}`)

// ── Step 5: Build replacement rules ─────────────────────────────────────

interface Replacement {
  readonly pattern: RegExp
  readonly replacement: string
  readonly description: string
}

function buildReplacements(): readonly Replacement[] {
  const rules: Replacement[] = []

  // Version replacements (only if version actually changed)
  if (oldVersion !== newVersion) {
    rules.push({
      pattern: new RegExp(escapeRegex(oldVersion), 'g'),
      replacement: newVersion,
      description: `version ${oldVersion} → ${newVersion}`,
    })
  }

  // Field type count replacements
  rules.push(
    {
      pattern: /\b(\d+) field types\b/g,
      replacement: `${newFieldCount} field types`,
      description: `field type count → ${newFieldCount}`,
    },
    {
      pattern: /\b(\d+) Field Types\b/g,
      replacement: `${newFieldCount} Field Types`,
      description: `Field Types title → ${newFieldCount}`,
    },
    {
      pattern: /\b(\d+) types de champs\b/g,
      replacement: `${newFieldCount} types de champs`,
      description: `field type count (FR) → ${newFieldCount}`,
    }
  )

  // Component type count replacements
  rules.push(
    {
      pattern: /\b(\d+) component types\b/g,
      replacement: `${newComponentCount} component types`,
      description: `component type count → ${newComponentCount}`,
    },
    {
      pattern: /\b(\d+) Component Types\b/g,
      replacement: `${newComponentCount} Component Types`,
      description: `Component Types title → ${newComponentCount}`,
    },
    {
      pattern: /\b(\d+) types de composants\b/g,
      replacement: `${newComponentCount} types de composants`,
      description: `component type count (FR) → ${newComponentCount}`,
    }
  )

  return rules
}

// ── Step 6: Apply replacements to target files ──────────────────────────

const TARGET_FILES = [
  'website/assets/llms.txt',
  'website/assets/llms-full.txt',
  'website/i18n/en/docs.ts',
  'website/i18n/en/home.ts',
  'website/i18n/fr/docs.ts',
  'website/i18n/fr/home.ts',
  'website/pages/docs/overview.ts',
  'website/assets/docs/openapi.json',
]

const replacements = buildReplacements()
let totalChanges = 0

for (const relPath of TARGET_FILES) {
  const absPath = join(ROOT, relPath)
  if (!existsSync(absPath)) {
    warn(`File not found: ${relPath}`)
    continue
  }

  const original = readFileSync(absPath, 'utf-8')
  let content = original
  const fileChanges: readonly string[] = replacements
    .filter((r) => {
      const before = content
      content = content.replace(r.pattern, r.replacement)
      return content !== before
    })
    .map((r) => r.description)

  if (fileChanges.length > 0) {
    if (dryRun) {
      console.log(`${c.yellow}Would update${c.reset} ${relPath}:`)
      for (const change of fileChanges) {
        console.log(`  ${c.dim}→${c.reset} ${change}`)
      }
    } else {
      writeFileSync(absPath, content, 'utf-8')
      ok(`Updated ${relPath} (${fileChanges.length} changes)`)
    }
    totalChanges += fileChanges.length
  }
}

// ── Step 7: Copy schema files ───────────────────────────────────────────

const schemaSource = join(ROOT, `schemas/${newVersion}/app.schema.json`)

if (existsSync(schemaSource)) {
  const targets = [
    `website/assets/schemas/${newVersion}/app.schema.json`,
    'website/assets/schemas/latest/app.schema.json',
  ]

  for (const target of targets) {
    const absTarget = join(ROOT, target)
    const targetDir = join(absTarget, '..')

    // Check if copy is needed (compare contents)
    const sourceContent = readFileSync(schemaSource, 'utf-8')
    const targetExists = existsSync(absTarget)
    const targetContent = targetExists ? readFileSync(absTarget, 'utf-8') : ''

    if (sourceContent === targetContent) continue

    if (dryRun) {
      console.log(
        `${c.yellow}Would copy${c.reset} schemas/${newVersion}/app.schema.json → ${target}`
      )
    } else {
      mkdirSync(targetDir, { recursive: true })
      copyFileSync(schemaSource, absTarget)
      ok(`Copied schema → ${target}`)
    }
    totalChanges++
  }
} else {
  warn(`Schema source not found: schemas/${newVersion}/app.schema.json`)
}

// ── Summary ─────────────────────────────────────────────────────────────

console.log('')
if (totalChanges === 0) {
  ok('Everything is up to date — no changes needed.')
} else if (dryRun) {
  info(`${c.bold}${totalChanges}${c.reset} changes would be made. Run without --dry-run to apply.`)
} else {
  ok(`${c.bold}${totalChanges}${c.reset} changes applied.`)
}
