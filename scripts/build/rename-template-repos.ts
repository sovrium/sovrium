/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readCatalog, repoName } from './publish-template-repos'

const ORG = 'sovrium'

interface CliOptions {
  readonly dryRun: boolean
  readonly only: string | null
}

export function parseRenameOptions(argv: readonly string[]): CliOptions {
  const onlyIdx = argv.indexOf('--only')
  return {
    dryRun: argv.includes('--dry-run'),
    only: onlyIdx >= 0 ? (argv[onlyIdx + 1] ?? null) : null,
  }
}

const run = (cmd: readonly string[]): string => {
  const proc = Bun.spawnSync([...cmd], { stdout: 'pipe', stderr: 'pipe' })
  if (proc.exitCode !== 0) {
    throw new Error(`command failed (${proc.exitCode}): ${cmd.join(' ')}\n${proc.stderr.toString()}`)
  }
  return proc.stdout.toString().trim()
}

const repoExists = (name: string): boolean =>
  Bun.spawnSync(['gh', 'api', `repos/${ORG}/${name}`, '--jq', '.name'], {
    stdout: 'pipe',
    stderr: 'pipe',
  }).exitCode === 0

type RenameOutcome = 'renamed' | 'already' | 'absent'

export const renameOne = (slug: string, dryRun: boolean): RenameOutcome => {
  const target = repoName(slug)
  if (repoExists(target)) return 'already'
  if (!repoExists(slug)) return 'absent'
  if (!dryRun) {
    run(['gh', 'repo', 'rename', target, '-R', `${ORG}/${slug}`, '--yes'])
  }
  return 'renamed'
}

const main = (): void => {
  const opts = parseRenameOptions(process.argv.slice(2))
  const catalog = readCatalog()
  const slugs = Object.keys(catalog)
    .filter((slug) => opts.only === null || slug === opts.only)
    .toSorted()
  if (slugs.length === 0) throw new Error(`no templates matched --only ${opts.only}`)
  console.log(`Renaming ${slugs.length} template repo(s)${opts.dryRun ? ' [dry-run]' : ''}`)

  const results: string[] = []
  const failures: string[] = []
  for (const slug of slugs) {
    try {
      const outcome = renameOne(slug, opts.dryRun)
      const arrow = `${ORG}/${slug} → ${ORG}/${repoName(slug)}`
      results.push(
        outcome === 'renamed'
          ? `  ${slug}: ${opts.dryRun ? 'would rename' : 'renamed'} (${arrow})`
          : outcome === 'already'
            ? `  ${slug}: already ${ORG}/${repoName(slug)}`
            : `  ${slug}: absent — nothing to rename (publisher will create it)`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(slug)
      results.push(`  ${slug}: FAILED — ${message.split('\n')[0]}`)
    }
  }
  console.log(results.join('\n'))
  const ok = slugs.length - failures.length
  if (failures.length > 0) {
    console.error(`✗ ${ok}/${slugs.length} processed; ${failures.length} FAILED: ${failures.join(', ')}`)
    process.exit(1)
  }
  console.log(`✓ template repo rename complete (${ok}/${slugs.length})`)
}

if (import.meta.main) {
  main()
}
