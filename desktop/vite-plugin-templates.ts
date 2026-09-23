/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Bundle the engine's template catalogue into the shell's first-run gallery.
 *
 * `templates/catalog.json` at the repository root is the engine's own
 * description of the 19 templates it ships embedded. The gallery must show
 * exactly those, so the catalogue is a build INPUT rather than a copy: a
 * hand-maintained second list would drift the moment a template is added, and
 * the symptom would be a gallery entry whose `sovrium init --template <slug>`
 * fails for a user who has no idea why.
 *
 * ## Why a virtual module rather than a copied asset
 *
 * A copied `dist/catalog.json` would need a `fetch` at runtime, a dev-server
 * middleware to serve it, an error path for the fetch failing, and a loading
 * state for the first screen the user ever sees. A virtual module is the same
 * data reaching the same place with none of that: it is inlined at build time,
 * it is typed, and a missing or malformed catalogue fails the BUILD rather than
 * the app.
 *
 * ## The cross-check
 *
 * Every slug is validated here against the pattern the Rust deep-link guard
 * enforces (`deeplink.rs`, `TEMPLATE_PATTERN`). If a template were ever added
 * whose slug the guard refuses, the gallery would offer a tile that
 * `create_project` rejects — a dead end with a confusing message. Failing the
 * build instead puts the error in front of whoever added the template.
 *
 * This file is NOT covered by `tsc --noEmit`: `tsconfig.json` includes `src`
 * only, and build-time tooling here runs under Node types the shell's browser
 * tsconfig does not carry. It is checked by being run.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const VIRTUAL_ID = 'virtual:sovrium-templates'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

/** Must stay identical to `TEMPLATE_PATTERN` in `src-tauri/src/deeplink.rs`. */
const SLUG_PATTERN = /^[a-z0-9-]+(\/[a-z0-9._-]+)?$/

interface CatalogEntry {
  readonly name: string
  readonly description: string
  readonly category: string
  readonly topics: readonly string[]
}

const catalogPath = (): string => {
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '..', 'templates', 'catalog.json')
}

const readCatalog = (path: string): Record<string, CatalogEntry> => {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path} is not an object of slug → template.`)
  }
  const entries = Object.entries(parsed as Record<string, unknown>)
  if (entries.length === 0) {
    throw new Error(`${path} lists no templates, so the gallery would be empty.`)
  }
  for (const [slug, value] of entries) {
    if (!SLUG_PATTERN.test(slug)) {
      throw new Error(
        `Template slug "${slug}" does not match the pattern the shell's deep-link guard ` +
          `enforces (${SLUG_PATTERN.source}). The gallery would offer a template the shell refuses to open.`
      )
    }
    const entry = value as Partial<CatalogEntry>
    if (typeof entry.name !== 'string' || typeof entry.description !== 'string') {
      throw new Error(`Template "${slug}" is missing a name or a description.`)
    }
  }
  return parsed as Record<string, CatalogEntry>
}

export const sovriumTemplates = (): Plugin => {
  const path = catalogPath()
  return {
    name: 'sovrium-templates',
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
    load(id) {
      if (id !== RESOLVED_ID) return undefined
      // Watched so that `bun run dev` picks up a template being added without a
      // restart — the loop this whole app exists to make short.
      this.addWatchFile(path)
      const catalog = readCatalog(path)
      return `export const templates = ${JSON.stringify(catalog)}\n`
    },
  }
}
