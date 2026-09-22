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
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import {
  BRAND_MARK_FILES as RAW_BRAND_MARKS,
  DESIGN_SYSTEM_SAMPLE_FILES as RAW_SAMPLES,
  MIGRATION_FILES as RAW_MIGRATIONS,
  TEMPLATE_FILES as RAW_TEMPLATES,
} from './embedded-static-assets.generated'

export type EmbeddedDialect = 'pg' | 'sqlite'

/**
 * One dialect's embedded migration set.
 *
 * There is deliberately NO `journal` field. Drizzle v1 reads a migration set as
 * one directory per migration and **throws** the moment it finds a
 * `meta/_journal.json` ("We detected that you have old drizzle-kit migration
 * folders"). Removing the field from the type is what makes writing that file
 * impossible rather than merely discouraged: {@link materializeMigrations} has
 * nothing to write it from, so a materialized root cannot be born unreadable.
 * Snapshots are not embedded either — the runtime migrator never reads them.
 */
interface MigrationSet {
  /** `<YYYYMMDDHHMMSS>_<name>` folder name → embedded `migration.sql` path. */
  readonly migrations: Readonly<Record<string, string>>
}

// `with { type: 'file' }` imports return a path string at runtime, but TS types
// them as the imported module's content (JSON/config shape). Cast through
// `unknown` to recover the true runtime type.
const MIGRATIONS = RAW_MIGRATIONS as unknown as Readonly<Record<EmbeddedDialect, MigrationSet>>
const TEMPLATES = RAW_TEMPLATES as unknown as Readonly<Record<string, string>>
const SAMPLES = RAW_SAMPLES as unknown as Readonly<Record<string, string>>
const BRAND_MARKS = RAW_BRAND_MARKS as unknown as Readonly<Record<string, string>>

/**
 * Materialize a dialect's embedded migration files into a fresh temp directory
 * laid out as drizzle's runtime migrator expects — one `<dir>/<folder>/migration.sql`
 * per migration, and NOTHING else — and return that directory path.
 *
 * Required because drizzle's migrator reads the folder via `node:fs` with
 * string-concatenated paths, which cannot target `$bunfs` embedded files
 * directly.
 *
 * The root is left with no `meta/` directory at all. That is the whole contract:
 * drizzle's reader refuses a folder holding `meta/_journal.json` outright, so a
 * materialized root that grew one would turn every compiled-binary boot into a
 * migration failure — on a path no dev-mode run exercises.
 */
export const materializeMigrations = async (dialect: EmbeddedDialect): Promise<string> => {
  const set = MIGRATIONS[dialect]
  const root = await mkdtemp(join(tmpdir(), `sovrium-migrations-${dialect}-`))

  await Promise.all(
    Object.entries(set.migrations).map(async ([folder, embeddedPath]) => {
      // eslint-disable-next-line functional/no-expression-statements -- fs side-effect
      await mkdir(join(root, folder), { recursive: true })
      return writeFile(join(root, folder, 'migration.sql'), await Bun.file(embeddedPath).bytes())
    })
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

/** One embedded file, ready to become a `Response` body. */
export interface EmbeddedAsset {
  /**
   * The file's bytes, verbatim — no encoding round-trip sits in this path.
   *
   * Narrowed to the `ArrayBuffer`-backed view rather than left at the default
   * `ArrayBufferLike`, because that is what `BodyInit` accepts: a
   * `SharedArrayBuffer`-backed view cannot become a `Response` body, and the
   * bare `Uint8Array` spelling admits one. `Bun.file().bytes()` already
   * returns the narrow type, so nothing is asserted to get here.
   */
  readonly bytes: Uint8Array<ArrayBuffer>
  /** MIME type inferred from the basename's extension. */
  readonly contentType: string
}

/**
 * Read one of the design-system console's sample media files, or `undefined`
 * when the name is not one of them.
 *
 * `name` is a bare basename (`sample-still.avif`), which is also the manifest
 * key and the last segment of the serving route. An unknown name returns
 * `undefined` rather than throwing, so the route answers 404 instead of 500 —
 * and, because the lookup is a plain property read on a frozen map rather than
 * a path join, a traversal attempt (`../../.env`) is simply a miss.
 *
 * WHY THIS IS NOT A FILESYSTEM READ WHERE IT COUNTS. In the compiled binary the
 * manifest's paths are `$bunfs/...` — Bun's virtual mount over bytes already
 * inside the executable — so `Bun.file()` resolves them out of the binary image
 * with no disk involved and no dependency on the checkout still existing. In
 * dev the very same call reads the real file off disk. That one mechanism
 * covering both modes is the entire point of the generated manifest, and it is
 * why the bytes are embedded verbatim rather than base64-encoded: there is no
 * decode step to pay for.
 *
 * The content type comes from {@link inferMimeFromKey} rather than from a map
 * kept here, so the console's samples and the bucket/public-directory routes
 * cannot disagree about what a `.webm` is. Note the consequence while the
 * extension map is still being extended: an extension absent from it resolves
 * to `application/octet-stream`, which a browser will refuse to play. Adding a
 * sample in a new format means adding its extension there, not here.
 *
 * @public Awaiting its consumer — the `/assets/design-system/<file>` route.
 */
export const readEmbeddedSample = async (name: string): Promise<EmbeddedAsset | undefined> => {
  const embeddedPath = SAMPLES[name]
  if (embeddedPath === undefined) return undefined
  return { bytes: await Bun.file(embeddedPath).bytes(), contentType: inferMimeFromKey(name) }
}

/**
 * Read one of the brand marks the console draws itself with, or `undefined`
 * when the key names nothing embedded.
 *
 * `key` is UNIT-QUALIFIED — `sovrium/mark-light-outline.svg` — which is both
 * the manifest key and the whole remainder of the serving path after
 * `/assets/brand/`. It carries a separator where {@link readEmbeddedSample}'s
 * name does not, and for a reason that is structural rather than stylistic:
 * `assets/logo/` holds one directory per business unit and all four hold files
 * of the same names, so the directory is what says which mark this is.
 *
 * THE SEPARATOR IS NOT A PATH. Nothing here joins, resolves or normalizes — the
 * lookup is a property read on a frozen map, so `../../../.env` and
 * `sovrium/nested/mark-light-outline.svg` are ordinary misses that answer 404
 * rather than reads that have to be defended against. That is the same property
 * the flat sample lookup has; the key shape widened, the mechanism did not.
 *
 * A miss is `undefined` rather than a throw, so an unknown name is a 404 and
 * not a 500 — including for the live-text siblings (`mark-light.svg`), which
 * are deliberately absent from the family: loaded through an `<img>` they reach
 * no webfont and draw the mark in a fallback typeface.
 *
 * Content type comes from {@link inferMimeFromKey}, which reads the extension
 * and is indifferent to the leading directory. It resolves `.svg` to
 * `image/svg+xml` and is deliberately NOT filtered through
 * `isInlineSafeImageKey`: that guard forces `attachment` on UNTRUSTED uploads,
 * where an SVG is a stored-XSS vector. These bytes are committed repository
 * assets embedded at build time and served from a map that admits nothing else.
 */
export const readEmbeddedBrandMark = async (key: string): Promise<EmbeddedAsset | undefined> => {
  const embeddedPath = BRAND_MARKS[key]
  if (embeddedPath === undefined) return undefined
  return { bytes: await Bun.file(embeddedPath).bytes(), contentType: inferMimeFromKey(key) }
}
