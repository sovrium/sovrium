#!/usr/bin/env bun
/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { computeChangeDate, stampReleaseMetadata } from './lib/release-metadata'


const args = process.argv.slice(2)

const dryRun = args.includes('--dry-run')
const messageIndex = args.indexOf('--message')
const customMessage =
  messageIndex !== -1 && args[messageIndex + 1] ? args[messageIndex + 1] : undefined
const closesIndex = args.indexOf('--closes')
const closesArg = closesIndex !== -1 && args[closesIndex + 1] ? args[closesIndex + 1] : undefined

const positionalArgs = args.filter(
  (arg, i) =>
    arg !== '--dry-run' &&
    arg !== '--message' &&
    arg !== '--closes' &&
    (i === 0 || (args[i - 1] !== '--message' && args[i - 1] !== '--closes'))
)
const bumpArg = positionalArgs[0]

if (!bumpArg) {
  console.error(
    'Usage: bun run release <patch|minor|major|X.Y.Z> [--dry-run] [--message "…"] [--closes "7,12"]'
  )
  process.exit(1)
}


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


const currentBranch = run('git rev-parse --abbrev-ref HEAD')
if (currentBranch !== 'main') {
  console.error(`Must be on main branch (currently on "${currentBranch}")`)
  process.exit(1)
}

const gitStatus = run('git status --porcelain')
if (gitStatus) {
  console.error('Working tree is not clean. Commit or stash changes first.')
  console.error(gitStatus)
  process.exit(1)
}

const packageJsonPath = 'package.json'
const packageJsonRaw = await readFile(packageJsonPath, 'utf-8')
const packageJson = JSON.parse(packageJsonRaw) as { version: string; [key: string]: unknown }
const currentVersion = packageJson.version

const newVersion = bumpVersion(currentVersion, bumpArg)

try {
  run(`git rev-parse v${newVersion}`)
  console.error(`Tag v${newVersion} already exists. Choose a different version.`)
  process.exit(1)
} catch {
}

const isGreater = (a: string, b: string): boolean => {
  const [aMaj, aMin, aPat] = a.split('.').map(Number) as [number, number, number]
  const [bMaj, bMin, bPat] = b.split('.').map(Number) as [number, number, number]
  return aMaj > bMaj || (aMaj === bMaj && (aMin > bMin || (aMin === bMin && aPat > bPat)))
}

if (!isGreater(newVersion, currentVersion)) {
  console.error(`New version ${newVersion} is not greater than current version ${currentVersion}`)
  process.exit(1)
}


const releaseMessage = customMessage ?? `Release ${newVersion}`
const today = new Date().toISOString().split('T')[0]
const repoUrl = 'https://git.sovrium.com/sovrium/sovrium'

console.log('')
console.log(`  Version:   ${currentVersion} → ${newVersion}`)
console.log(`  Message:   ${releaseMessage}`)
if (closesArg) {
  console.log(
    `  Closes:    GitHub issues ${closesArg
      .split(',')
      .map((n: string) => `#${n.trim()}`)
      .join(', ')}`
  )
}
console.log(`  Date:      ${today}`)
console.log(`  Dry run:   ${dryRun}`)
console.log('')

if (dryRun) {
  console.log('Dry run — no changes will be made.')
  console.log('')
  console.log('Would:')
  console.log('  1. Run pre-publish checks')
  console.log(`  2. Update package.json version to ${newVersion}`)
  console.log('     - Regenerate bun.lock')
  console.log('  3. Prepend CHANGELOG.md entry')
  console.log('  4. Stamp version + Change Date (LICENSE.md, README.md, CLAUDE.md)')
  console.log('  5. Refresh license-header copyright years')
  console.log(`  6. Commit: "release: ${newVersion}"`)
  console.log(`  7. Tag: v${newVersion}`)
  console.log('')
  console.log('Then you would run:')
  console.log('  git push origin main --follow-tags')
  process.exit(0)
}


console.log(`1. Updating package.json version to ${newVersion}...`)
packageJson.version = newVersion
await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')

const typesPackageJsonPath = 'packages/types/package.json'
let typesPackageSynced = false
try {
  const typesRaw = await readFile(typesPackageJsonPath, 'utf-8')
  const typesJson = JSON.parse(typesRaw) as { version: string; [key: string]: unknown }
  typesJson.version = newVersion
  await writeFile(typesPackageJsonPath, JSON.stringify(typesJson, null, 2) + '\n')
  typesPackageSynced = true
  console.log(`   Synced @sovrium/types version to ${newVersion}`)
} catch {
  console.log('   (skipped @sovrium/types — packages/types/package.json not found)')
}

console.log('   Regenerating bun.lock...')
run('bun install --lockfile-only')


console.log('2. Updating CHANGELOG.md...')
const changelogPath = 'CHANGELOG.md'
let changelog = ''
try {
  changelog = await readFile(changelogPath, 'utf-8')
} catch {
}

const newEntry = `## [${newVersion}](${repoUrl}/compare/v${currentVersion}...v${newVersion}) (${today})\n\n${releaseMessage}\n\n`
await writeFile(changelogPath, newEntry + changelog)


console.log('3. Stamping version + Change Date and refreshing license headers...')
const changeDate = computeChangeDate(new Date(`${today}T00:00:00Z`))
await stampReleaseMetadata({ version: newVersion, changeDate })
run('bun run license')


console.log(`4. Committing release: ${newVersion}...`)
const filesToStage = [
  'package.json',
  'CHANGELOG.md',
  'LICENSE.md',
  'README.md',
  'CLAUDE.md',
  'src',
  'scripts',
  'specs',
  'eslint',
  'eslint.config.ts',
]
if (typesPackageSynced) filesToStage.push('packages/types/package.json')
if (existsSync('bun.lock')) filesToStage.push('bun.lock')
run(`git add ${filesToStage.join(' ')}`)

const closesFooter = closesArg
  ? closesArg
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => `Closes #${n}`)
      .join('\n')
  : ''
const commitBody = closesFooter ? `\n\n${closesFooter}` : ''
run(`git commit -m "release: ${newVersion}${commitBody}"`)


console.log(`5. Tagging v${newVersion}...`)
run(`git tag -a v${newVersion} -m "v${newVersion}"`)


console.log('')
console.log(`✅ Release ${newVersion} prepared successfully!`)
console.log('')
console.log('Push to publish:')
console.log('  git push origin main --follow-tags')
console.log('')
