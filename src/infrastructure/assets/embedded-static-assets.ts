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
  TEMPLATE_FILES as RAW_TEMPLATES,
  DASHBOARD_FILES as RAW_DASHBOARD,
} from './embedded-static-assets.generated'

export type EmbeddedDialect = 'pg' | 'sqlite'

interface MigrationSet {
  readonly journal: string
  readonly migrations: Readonly<Record<string, string>>
}

const MIGRATIONS = RAW_MIGRATIONS as unknown as Readonly<Record<EmbeddedDialect, MigrationSet>>
const AGENTS = RAW_AGENTS as unknown as Readonly<Record<string, string>>
const TEMPLATES = RAW_TEMPLATES as unknown as Readonly<Record<string, string>>
const DASHBOARD = RAW_DASHBOARD as unknown as Readonly<Record<string, string>>

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

export const embeddedTemplateDir = (name: string): Readonly<Record<string, string>> => {
  const prefix = `${name}/`
  const entries: ReadonlyArray<readonly [string, string]> = Object.entries(TEMPLATES).flatMap(
    ([key, path]) => (key.startsWith(prefix) ? [[key.slice(prefix.length), path] as const] : [])
  )
  return Object.fromEntries(entries)
}

export const readEmbeddedDashboardConfig = async (): Promise<string | undefined> => {
  const embeddedPath = DASHBOARD['dashboard-app.yaml']
  if (embeddedPath === undefined) return undefined
  try {
    return await Bun.file(embeddedPath).text()
  } catch {
    return undefined
  }
}
