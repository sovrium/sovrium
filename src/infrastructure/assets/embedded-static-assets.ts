/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  MIGRATION_FILES as RAW_MIGRATIONS,
  AGENT_FILES as RAW_AGENTS,
  EXAMPLE_FILES as RAW_EXAMPLES,
} from './embedded-static-assets.generated'

export type EmbeddedDialect = 'pg' | 'sqlite'

interface MigrationSet {
  readonly journal: string
  readonly migrations: Readonly<Record<string, string>>
}

const MIGRATIONS = RAW_MIGRATIONS as unknown as Readonly<Record<EmbeddedDialect, MigrationSet>>
const AGENTS = RAW_AGENTS as unknown as Readonly<Record<string, string>>
const EXAMPLES = RAW_EXAMPLES as unknown as Readonly<Record<string, string>>

export const materializeMigrations = async (dialect: EmbeddedDialect): Promise<string> => {
  const set = MIGRATIONS[dialect]
  const root = await mkdtemp(join(tmpdir(), `sovrium-migrations-${dialect}-`))
  const metaDir = join(root, 'meta')
  await mkdir(metaDir, { recursive: true })

  await writeFile(join(metaDir, '_journal.json'), await Bun.file(set.journal).bytes())
  await Promise.all(
    Object.entries(set.migrations).map(async ([filename, embeddedPath]) =>
      writeFile(join(root, filename), await Bun.file(embeddedPath).bytes())
    )
  )

  return root
}

export const embeddedAgentNames = (): readonly string[] =>
  Object.keys(AGENTS)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .map((f) => f.slice(0, -'.md'.length))
    .toSorted()

export const embeddedAgentPath = (name: string): string | undefined => AGENTS[`${name}.md`]

export const embeddedExamplePath = (filename: string): string | undefined => EXAMPLES[filename]
