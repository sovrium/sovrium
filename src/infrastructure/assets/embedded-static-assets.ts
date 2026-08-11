/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Typed accessors over the generated embedded-asset manifest.
 *
 * The generated module ({@link ./embedded-static-assets.generated}) is
 * `@ts-nocheck` because the `with { type: 'file' }` imports have no static
 * type. This module re-types the raw maps and provides helpers that work
 * identically in dev (paths point to real files) and in the compiled binary
 * (paths point to `$bunfs/...` embedded files).
 */

import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  MIGRATION_FILES as RAW_MIGRATIONS,
  TEMPLATE_FILES as RAW_TEMPLATES,
  DASHBOARD_FILES as RAW_DASHBOARD,
} from './embedded-static-assets.generated'

export type EmbeddedDialect = 'pg' | 'sqlite'

interface MigrationSet {
  /** Embedded path of `meta/_journal.json`. */
  readonly journal: string
  /** `<tag>.sql` filename → embedded path. */
  readonly migrations: Readonly<Record<string, string>>
}

// `with { type: 'file' }` imports return a path string at runtime, but TS types
// them as the imported module's content (JSON/config shape). Cast through
// `unknown` to recover the true runtime type.
const MIGRATIONS = RAW_MIGRATIONS as unknown as Readonly<Record<EmbeddedDialect, MigrationSet>>
const TEMPLATES = RAW_TEMPLATES as unknown as Readonly<Record<string, string>>
const DASHBOARD = RAW_DASHBOARD as unknown as Readonly<Record<string, string>>

/**
 * Materialize a dialect's embedded migration files into a fresh temp directory
 * laid out as drizzle's runtime migrator expects (`<dir>/meta/_journal.json`
 * plus each `<dir>/<tag>.sql`), and return that directory path.
 *
 * Required because drizzle's migrator reads the folder via `node:fs` with
 * string-concatenated paths, which cannot target `$bunfs` embedded files
 * directly.
 */
export const materializeMigrations = async (dialect: EmbeddedDialect): Promise<string> => {
  const set = MIGRATIONS[dialect]
  const root = await mkdtemp(join(tmpdir(), `sovrium-migrations-${dialect}-`))
  const metaDir = join(root, 'meta')
  // eslint-disable-next-line functional/no-expression-statements -- fs side-effect
  await mkdir(metaDir, { recursive: true })

  await writeFile(join(metaDir, '_journal.json'), await Bun.file(set.journal).bytes())
  await Promise.all(
    Object.entries(set.migrations).map(async ([filename, embeddedPath]) =>
      writeFile(join(root, filename), await Bun.file(embeddedPath).bytes())
    )
  )

  return root
}

/**
 * Embedded entries for a template's directory tree, keyed by path relative to
 * the template root (e.g. `app.yaml`, `config/tables/contacts.yaml`).
 *
 * Templates ship as directory trees (`templates/<name>/**`) — the generator
 * walks `templates/` recursively and uses paths relative to `templates/` as
 * keys. This helper filters the manifest to entries under `<name>/` and
 * strips the `<name>/` prefix from each key so callers see paths rooted at
 * the template directory.
 *
 * Returns an empty record (not `undefined`) when no entries match, so callers
 * can branch on emptiness without optional chaining. Bun's `Bun.file()` reads
 * either a real on-disk path (dev mode) or a `$bunfs/...` path (compiled
 * binary) — both are returned verbatim from this map.
 */
export const embeddedTemplateDir = (name: string): Readonly<Record<string, string>> => {
  const prefix = `${name}/`
  const entries: ReadonlyArray<readonly [string, string]> = Object.entries(TEMPLATES).flatMap(
    ([key, path]) => (key.startsWith(prefix) ? [[key.slice(prefix.length), path] as const] : [])
  )
  return Object.fromEntries(entries)
}

/**
 * Read the embedded Native Admin Dashboard system app config as raw
 * YAML text.
 *
 * The dashboard config is embedded via the `with { type: 'file' }` manifest, so
 * `Bun.file()` reads it from a real on-disk path in dev/bundled mode and from a
 * `$bunfs/...` path in the compiled binary — the SAME mechanism `materializeMigrations`
 * uses. The compiled-mode branch is `isCompiled` (the manifest import resolves
 * to `$bunfs/...` there); never branch on `isBundled` (it is `false` in the
 * compiled binary and would mis-route compiled mode — the binary-embedded-assets
 * gotcha).
 *
 * Returns `undefined` only if the embedded artifact is somehow missing (it is
 * always present in a correctly-built binary), so the caller can fail safe.
 */
export const readEmbeddedDashboardConfig = async (): Promise<string | undefined> => {
  const embeddedPath = DASHBOARD['dashboard-app.yaml']
  if (embeddedPath === undefined) return undefined
  try {
    return await Bun.file(embeddedPath).text()
  } catch {
    return undefined
  }
}
