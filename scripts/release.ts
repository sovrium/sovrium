#!/usr/bin/env bun
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Release Script — Manual version management for Sovrium
 *
 * Replaces semantic-release with explicit version control.
 * Bumps version, updates changelog, exports schemas, commits, and tags.
 * Does NOT push or publish — CI handles that.
 *
 * Usage:
 *   bun run release patch                          # 0.0.2 → 0.0.3
 *   bun run release minor                          # 0.0.2 → 0.1.0
 *   bun run release major                          # 0.0.2 → 1.0.0
 *   bun run release 1.2.3                          # Explicit version
 *
 * Options:
 *   --dry-run       Show what would happen without making changes
 *   --message "…"   Release summary for CHANGELOG (default: "Release X.Y.Z")
 *
 * After running:
 *   git push origin main --follow-tags
 */

import { execSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'

// ─── Argument Parsing ──────────────────────────────────────────────

const args = process.argv.slice(2)

const dryRun = args.includes('--dry-run')
const messageIndex = args.indexOf('--message')
const customMessage =
  messageIndex !== -1 && args[messageIndex + 1] ? args[messageIndex + 1] : undefined

// Filter out flags to get the bump argument
const positionalArgs = args.filter(
  (arg, i) => arg !== '--dry-run' && arg !== '--message' && (i === 0 || args[i - 1] !== '--message')
)
const bumpArg = positionalArgs[0]

if (!bumpArg) {
  console.error('Usage: bun run release <patch|minor|major|X.Y.Z> [--dry-run] [--message "…"]')
  process.exit(1)
}

// ─── Helpers ───────────────────────────────────────────────────────

const run = (cmd: string): string => execSync(cmd, { encoding: 'utf-8' }).trim()

const semverPattern = /^\d+\.\d+\.\d+$/

const bumpVersion = (current: string, bump: string): string => {
  if (semverPattern.test(bump)) return bump

  const [major, minor, patch] = current.split('.').map(Number) as [number, number, number]

  switch (bump) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'major':
      return `${major + 1}.0.0`
    default:
      console.error(`Invalid bump type: "${bump}". Use patch, minor, major, or X.Y.Z`)
      process.exit(1)
  }
}

// ─── Validation ────────────────────────────────────────────────────

// Must be on main branch
const currentBranch = run('git rev-parse --abbrev-ref HEAD')
if (currentBranch !== 'main') {
  console.error(`Must be on main branch (currently on "${currentBranch}")`)
  process.exit(1)
}

// Must have clean working tree
const gitStatus = run('git status --porcelain')
if (gitStatus) {
  console.error('Working tree is not clean. Commit or stash changes first.')
  console.error(gitStatus)
  process.exit(1)
}

// Read current version
const packageJsonPath = 'package.json'
const packageJsonRaw = await readFile(packageJsonPath, 'utf-8')
const packageJson = JSON.parse(packageJsonRaw) as { version: string; [key: string]: unknown }
const currentVersion = packageJson.version

// Calculate new version
const newVersion = bumpVersion(currentVersion, bumpArg)

// Ensure tag doesn't already exist
try {
  run(`git rev-parse v${newVersion}`)
  console.error(`Tag v${newVersion} already exists. Choose a different version.`)
  process.exit(1)
} catch {
  // Tag doesn't exist — good
}

// Validate new version is greater than current
const isGreater = (a: string, b: string): boolean => {
  const [aMaj, aMin, aPat] = a.split('.').map(Number) as [number, number, number]
  const [bMaj, bMin, bPat] = b.split('.').map(Number) as [number, number, number]
  return aMaj > bMaj || (aMaj === bMaj && (aMin > bMin || (aMin === bMin && aPat > bPat)))
}

if (!isGreater(newVersion, currentVersion)) {
  console.error(`New version ${newVersion} is not greater than current version ${currentVersion}`)
  process.exit(1)
}

// ─── Summary ───────────────────────────────────────────────────────

const releaseMessage = customMessage ?? `Release ${newVersion}`
const today = new Date().toISOString().split('T')[0]
const repoUrl = 'https://github.com/sovrium/sovrium'

console.log('')
console.log(`  Version:   ${currentVersion} → ${newVersion}`)
console.log(`  Message:   ${releaseMessage}`)
console.log(`  Date:      ${today}`)
console.log(`  Dry run:   ${dryRun}`)
console.log('')

if (dryRun) {
  console.log('Dry run — no changes will be made.')
  console.log('')
  console.log('Would:')
  console.log('  1. Run pre-publish checks')
  console.log(`  2. Update package.json version to ${newVersion}`)
  console.log(`  3. Export schemas to schemas/${newVersion}/`)
  console.log('  4. Prepend CHANGELOG.md entry')
  console.log(`  5. Commit: "release: ${newVersion}"`)
  console.log(`  6. Tag: v${newVersion}`)
  console.log('')
  console.log('Then you would run:')
  console.log('  git push origin main --follow-tags')
  process.exit(0)
}

// ─── Step 1: Pre-publish validation ──────────────────────────────

console.log('1. Running pre-publish checks...')
run('bun run prepublish-check')

// ─── Step 2: Update package.json ───────────────────────────────────

console.log(`2. Updating package.json version to ${newVersion}...`)
packageJson.version = newVersion
await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')

// ─── Step 3: Export schemas ────────────────────────────────────────

console.log(`3. Exporting schemas to schemas/${newVersion}/...`)
run(`bun run export:schema --version ${newVersion}`)
run(`bun run export:openapi --version ${newVersion}`)

// ─── Step 4: Update CHANGELOG.md ───────────────────────────────────

console.log('4. Updating CHANGELOG.md...')
const changelogPath = 'CHANGELOG.md'
let changelog = ''
try {
  changelog = await readFile(changelogPath, 'utf-8')
} catch {
  // CHANGELOG.md doesn't exist yet — start fresh
}

const newEntry = `## [${newVersion}](${repoUrl}/compare/v${currentVersion}...v${newVersion}) (${today})\n\n${releaseMessage}\n\n`
await writeFile(changelogPath, newEntry + changelog)

// ─── Step 5: Git commit ────────────────────────────────────────────

console.log(`5. Committing release: ${newVersion}...`)
run(`git add package.json CHANGELOG.md "schemas/${newVersion}"`)
run(`git commit -m "release: ${newVersion}"`)

// ─── Step 6: Git tag ───────────────────────────────────────────────

console.log(`6. Tagging v${newVersion}...`)
run(`git tag -a v${newVersion} -m "v${newVersion}"`)

// ─── Done ──────────────────────────────────────────────────────────

console.log('')
console.log(`✅ Release ${newVersion} prepared successfully!`)
console.log('')
console.log('Push to publish:')
console.log('  git push origin main --follow-tags')
console.log('')
