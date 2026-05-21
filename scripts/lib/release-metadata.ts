/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const CHANGE_DATE_OFFSET_YEARS = 4

export interface ChangeDate {
  readonly iso: string
  readonly prose: string
}

export type MetadataFile = 'LICENSE.md' | 'README.md' | 'CLAUDE.md'

export interface StampOptions {
  readonly version: string
  readonly changeDate: ChangeDate
  readonly repoRoot?: string
  readonly dryRun?: boolean
}

export interface StampResult {
  readonly file: MetadataFile
  readonly changed: boolean
  readonly replacements: number
}

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

export function computeChangeDate(releaseDate: Date): ChangeDate {
  const year = releaseDate.getUTCFullYear()
  const month = releaseDate.getUTCMonth()
  const day = releaseDate.getUTCDate()

  const targetYear = year + CHANGE_DATE_OFFSET_YEARS
  const safeDay = month === 1 && day === 29 && !isLeapYear(targetYear) ? 28 : day
  const target = new Date(Date.UTC(targetYear, month, safeDay))

  return {
    iso: target.toISOString().slice(0, 10),
    prose: target.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  }
}

const EXPECTED_REPLACEMENTS: Record<MetadataFile, number> = {
  'LICENSE.md': 3,
  'README.md': 1,
  'CLAUDE.md': 3,
}

function stampLicense(content: string, cd: ChangeDate): { content: string; count: number } {
  let count = 0
  const out = content
    .replace(/(\*\*Change Date\*\*:\s*)\d{4}-\d{2}-\d{2}\s*\([^)]*\)/, (_match, label: string) => {
      count += 1
      return `${label}${cd.iso} (Four years from this version's release date)`
    })
    .replace(
      /(On \*\*)[A-Z][a-z]+ \d{1,2}, \d{4}(\*\* \()[^)]*(\))/,
      (_match, lead: string, mid: string, close: string) => {
        count += 1
        return `${lead}${cd.prose}${mid}four years after this version's release${close}`
      }
    )
    .replace(
      /(wait until the Change Date \()\d{4}-\d{2}-\d{2}(\))/,
      (_match, lead: string, close: string) => {
        count += 1
        return `${lead}${cd.iso}${close}`
      }
    )
  return { content: out, count }
}

function stampReadme(content: string, cd: ChangeDate): { content: string; count: number } {
  let count = 0
  const out = content.replace(
    /(\*\*Apache 2\.0\*\* on )[A-Z][a-z]+ \d{1,2}, (?:\*\*)?\d{4}(?:\*\*)?/,
    (_match, lead: string) => {
      count += 1
      return `${lead}**${cd.prose}**`
    }
  )
  return { content: out, count }
}

function stampClaude(
  content: string,
  version: string,
  cd: ChangeDate
): { content: string; count: number } {
  let count = 0
  const out = content
    .replace(/(\*\*Version\*\*:\s*)\d+\.\d+\.\d+/, (_match, label: string) => {
      count += 1
      return `${label}${version}`
    })
    .replace(/(\*\*Change Date\*\*:\s*)\d{4}-\d{2}-\d{2}/, (_match, label: string) => {
      count += 1
      return `${label}${cd.iso}`
    })
    .replace(
      /(Change Date )\d{4}-\d{2}-\d{2}( → Apache 2\.0)/,
      (_match, lead: string, tail: string) => {
        count += 1
        return `${lead}${cd.iso}${tail}`
      }
    )
  return { content: out, count }
}

export function stampFileContent(
  fileName: MetadataFile,
  content: string,
  opts: { version: string; changeDate: ChangeDate }
): { content: string; replacements: number } {
  const stamped =
    fileName === 'LICENSE.md'
      ? stampLicense(content, opts.changeDate)
      : fileName === 'README.md'
        ? stampReadme(content, opts.changeDate)
        : stampClaude(content, opts.version, opts.changeDate)

  const expected = EXPECTED_REPLACEMENTS[fileName]
  if (stamped.count !== expected) {
    throw new Error(
      `release-metadata: expected ${expected} replacement(s) in ${fileName}, made ${stamped.count}. ` +
        'An anchored heading or wording likely changed — update the patterns in scripts/lib/release-metadata.ts.'
    )
  }
  return { content: stamped.content, replacements: stamped.count }
}

export async function stampReleaseMetadata(opts: StampOptions): Promise<readonly StampResult[]> {
  const root = opts.repoRoot ?? process.cwd()
  const files: readonly MetadataFile[] = ['LICENSE.md', 'README.md', 'CLAUDE.md']
  const results: StampResult[] = []

  for (const file of files) {
    const path = join(root, file)
    const original = await readFile(path, 'utf8')
    const { content, replacements } = stampFileContent(file, original, {
      version: opts.version,
      changeDate: opts.changeDate,
    })
    const changed = content !== original
    if (changed && opts.dryRun !== true) {
      await writeFile(path, content)
    }
    results.push({ file, changed, replacements })
  }

  return results
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const versionIndex = argv.indexOf('--version')
  const version = versionIndex !== -1 ? argv[versionIndex + 1] : undefined
  const dateIndex = argv.indexOf('--date')
  const date = dateIndex !== -1 ? argv[dateIndex + 1] : undefined
  const dryRun = argv.includes('--dry-run')

  if (version === undefined || version === '') {
    console.error(
      'Usage: bun run scripts/lib/release-metadata.ts --version X.Y.Z [--date YYYY-MM-DD] [--dry-run]'
    )
    process.exit(1)
  }

  const releaseDate = date !== undefined ? new Date(`${date}T00:00:00Z`) : new Date()
  const changeDate = computeChangeDate(releaseDate)
  const results = await stampReleaseMetadata({ version, changeDate, dryRun })

  console.log(
    `release-metadata: version ${version}, Change Date ${changeDate.iso}${dryRun ? ' (dry run)' : ''}`
  )
  for (const result of results) {
    console.log(
      `  ${result.changed ? 'updated  ' : 'unchanged'} ${result.file} (${result.replacements} fields)`
    )
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
