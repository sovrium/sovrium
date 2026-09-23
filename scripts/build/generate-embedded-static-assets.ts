/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Codegen: embed on-disk shipped assets into the compiled binary.
 *
 * `bun build --compile` only embeds the JS module graph. Data files the runtime
 * reads from disk (drizzle migrations, init templates, the design-system
 * console's sample media, the brand marks the console draws itself with) are
 * NOT embedded, so the binary `ENOENT`s when run
 * from a fresh project. This script
 * emits `src/infrastructure/assets/embedded-static-assets.generated.ts`, whose
 * `with { type: 'file' }` imports force Bun to embed each file; the import
 * returns the real path in dev/bundled mode and a `$bunfs/...` path in the
 * compiled binary. `Bun.file()` reads either, so one mechanism covers all modes.
 *
 * That import IS the encoding, and it is why no family here needs base64 or a
 * `Uint8Array` literal: Bun embeds each file's bytes verbatim and hands back a
 * path, so a 24 KB MP3 costs 24 KB in the binary and round-trips byte for byte.
 * A textual encoding would inflate every binary asset by a third and add a
 * decode step to a read path that currently has none.
 *
 * Regenerate after adding a migration, a template or a console sample — note
 * each template's own `[internal ref]` bundle ships too, via the recursive
 * `templates/` walk:
 *   bun run scripts/build/generate-embedded-static-assets.ts
 * (also run automatically by `build` and `build:binary`).
 *
 * Only the files drizzle's runtime migrator actually reads are embedded. Since
 * drizzle v1 that is exactly one file per migration — `<folder>/migration.sql`,
 * where `<folder>` is `<YYYYMMDDHHMMSS>_<name>` and IS the migration's identity
 * (the value stored in `__drizzle_migrations.name`). There is no journal: v1
 * derives order and timestamp from the folder name, and `readMigrationFiles`
 * THROWS if it finds a `meta/_journal.json`, so one must never be embedded or
 * materialized. Each folder's `snapshot.json` is a drizzle-kit generate input
 * and is intentionally excluded.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileImportSpecifier, posixRelative } from '../lib/posix-path'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const OUT_FILE = join(
  PROJECT_ROOT,
  'src',
  'infrastructure',
  'assets',
  'embedded-static-assets.generated.ts'
)
// Import paths in the generated file are relative to its own directory
// (src/infrastructure/assets/ → repo root is three levels up).
const REL_ROOT = '../../..'

interface ImportLine {
  readonly varName: string
  readonly importPath: string
}

/**
 * Migration folder names under `migrationsRoot`, sorted the way drizzle orders
 * them.
 *
 * Since drizzle v1 a migration IS a directory: `<YYYYMMDDHHMMSS>_<name>/`
 * holding `migration.sql`. The folder name is the migration's identity — the
 * value stored in `__drizzle_migrations.name` — so it is the manifest key.
 *
 * Walks recursively for `migration.sql` rather than reading a single level, so
 * a layout change surfaces as an explicit failure instead of a silently short
 * manifest. Two guards keep it honest against drizzle's own reader, which is
 * strictly ONE level deep (`readdirSync(folder)` keeping subdirectories that
 * contain a `migration.sql`):
 *
 * - a `migration.sql` found deeper than `<root>/<folder>/` THROWS. Embedding it
 *   would key it under a folder the runtime migrator never resolves, so the
 *   binary would ship a migration it can never apply — silently.
 * - `excludeDirs` names top-level subdirectories to skip. The pg set passes
 *   `['sqlite']` because `drizzle/sqlite/` is a SIBLING DIALECT that happens to
 *   be nested inside it. drizzle's own pg walk skips it for free (it holds no
 *   `migration.sql` of its own, only subdirectories); a recursive walk does
 *   not, so the exclusion must be explicit. Without it the 14 SQLite migrations
 *   would be absorbed into the pg set and applied to a PostgreSQL database.
 *
 * Sorted by `localeCompare`, matching `readMigrationFiles`, so the manifest key
 * order is the apply order.
 *
 * Exported and root-parameterized so both guards are testable against a
 * synthetic tree without writing the committed manifest — see
 * `generate-embedded-static-assets.test.ts`.
 */
export const collectMigrationFolders = (
  migrationsRoot: string,
  excludeDirs: readonly string[] = []
): readonly string[] => {
  const walk = (abs: string, depth: number): readonly string[] =>
    readdirSync(abs, { withFileTypes: true }).flatMap((entry): readonly string[] => {
      if (entry.isDirectory()) {
        if (depth === 0 && excludeDirs.includes(entry.name)) return []
        return walk(join(abs, entry.name), depth + 1)
      }
      if (!entry.isFile() || entry.name !== 'migration.sql') return []
      // `abs` is the CONTAINING directory; `entry.name` is always migration.sql.
      const folder = posixRelative(migrationsRoot, abs)
      if (folder.includes('/') || folder.length === 0) {
        throw new Error(
          `Migration at an unreadable depth: ${relative(migrationsRoot, join(abs, entry.name))}. ` +
            `drizzle reads only <root>/<folder>/migration.sql, so this file would be ` +
            `embedded under a key the runtime migrator never resolves.`
        )
      }
      return [folder]
    })
  return walk(migrationsRoot, 0).toSorted((a, b) => a.localeCompare(b))
}

/** `collectMigrationFolders` for a dialect directory relative to the repo root. */
const migrationFolders = (dir: string): readonly string[] =>
  collectMigrationFolders(join(PROJECT_ROOT, dir), dir === 'drizzle' ? ['sqlite'] : [])

// ---------------------------------------------------------------------------
// Collect assets
// ---------------------------------------------------------------------------

const imports: ImportLine[] = []
let counter = 0
const nextVar = (): string => `_a${counter++}`

const addImport = (relPath: string): string => {
  const varName = nextVar()
  imports.push({ varName, importPath: fileImportSpecifier(REL_ROOT, relPath) })
  return varName
}

// Migrations — per dialect: one <folder>/migration.sql per migration, keyed by
// folder name. NO journal: v1 has none, and embedding one would let the
// materializer write a meta/ that makes readMigrationFiles throw at boot.
const buildDialect = (dir: string): string => {
  const entries = migrationFolders(dir).map(
    (folder) => `      ${JSON.stringify(folder)}: ${addImport(`${dir}/${folder}/migration.sql`)},`
  )
  return `{
    migrations: {
${entries.join('\n')}
    },
  }`
}

const pgBlock = buildDialect('drizzle')
const sqliteBlock = buildDialect('drizzle/sqlite')

// Templates — recursively walk `templates/`, embedding every non-source file.
// Keys use the path relative to `templates/` (e.g. `crm/app.yaml`,
// `crm/config/tables/contacts.yaml`) so init can enumerate per-template
// directory trees. `.ts` templates are excluded: embedding them pulls them into
// the tsc program, which declaration-emits stray `templates/*.d.ts`. init only
// uses `.yaml`. Top-level non-directory files (README.md, CLAUDE.md.template)
// are kept under their filename key for back-compat.
const TEMPLATES_ROOT = join(PROJECT_ROOT, 'templates')

/** One parsed `.gitignore` line. */
interface IgnoreRule {
  readonly re: RegExp
  readonly negated: boolean
  readonly dirOnly: boolean
}

/** Translate a glob into a regular-expression body. */
const globToRegExpBody = (pattern: string): string =>
  pattern
    .replaceAll(/[.+^$(){}|\\]/g, (c) => `\\${c}`)
    // `**/` spans zero or more directories; a bare `**` spans anything.
    // The sentinels are written as `\u0000` ESCAPES, never as literal NUL
    // bytes. A literal NUL makes git classify this file as binary and makes
    // `rg` skip it without `-a` — so every text search over `scripts/` reads
    // straight past it, including the ones an agent runs to find out whether a
    // capability lives here. The runtime value is identical.
    .replaceAll('**/', '\u0000SLASH\u0000')
    .replaceAll('**', '\u0000ANY\u0000')
    // A single `*` / `?` never crosses a directory separator.
    .replaceAll('*', '[^/]*')
    .replaceAll('?', '[^/]')
    .replaceAll('\u0000SLASH\u0000', '(?:.*/)?')
    .replaceAll('\u0000ANY\u0000', '.*')

/**
 * Parse `.gitignore` text into ordered rules.
 *
 * Covers the subset of the format this repository uses: comments, blank lines,
 * `!` negation, a trailing `/` for directory-only, a leading or embedded `/`
 * for root-anchoring, and `*` / `**` / `?` / `[…]` globs.
 */
const parseGitignore = (contents: string): readonly IgnoreRule[] =>
  contents
    .split('\n')
    .map((line) => line.replace(/\r$/, '').trimEnd())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const negated = line.startsWith('!')
      const withoutBang = negated ? line.slice(1) : line
      const dirOnly = withoutBang.endsWith('/')
      const bare = dirOnly ? withoutBang.slice(0, -1) : withoutBang
      const trimmed = bare.startsWith('/') ? bare.slice(1) : bare
      // Git anchors a pattern to the .gitignore's own directory when it holds a
      // separator anywhere but the end; otherwise it matches at any depth.
      const anchored = bare.startsWith('/') || bare.slice(0, -1).includes('/')
      return {
        re: new RegExp(`^${anchored ? '' : '(?:.*/)?'}${globToRegExpBody(trimmed)}$`),
        negated,
        dirOnly,
      }
    })

/** Whether `relPath` is ignored — last matching rule wins, as in git. */
const isIgnored = (relPath: string, isDir: boolean, rules: readonly IgnoreRule[]): boolean =>
  rules.reduce<boolean>((ignored, rule) => {
    if (rule.dirOnly && !isDir) return ignored
    return rule.re.test(relPath) ? !rule.negated : ignored
  }, false)

/** The repository's own ignore rules. */
const readProjectIgnoreRules = (): readonly IgnoreRule[] => {
  const contents = ((): string => {
    try {
      return readFileSync(join(PROJECT_ROOT, '.gitignore'), 'utf8')
    } catch {
      return ''
    }
  })()
  if (contents.trim().length === 0) {
    // Embedding everything is the exact failure this filter exists to prevent,
    // so an unreadable .gitignore fails the build rather than shipping blind.
    throw new Error(
      'Cannot determine which template files to embed: .gitignore is missing or empty at the project root.'
    )
  }
  return parseGitignore(contents)
}

const walkTemplates = (
  dir: string,
  root: string,
  rules: readonly IgnoreRule[]
): readonly string[] => {
  const entries = readdirSync(dir, { withFileTypes: true }).toSorted((a, b) =>
    a.name.localeCompare(b.name)
  )
  return entries.flatMap((entry): readonly string[] => {
    const abs = join(dir, entry.name)
    // Match on the path relative to the templates root, in POSIX form, so the
    // rules read in `.gitignore`'s own vocabulary on every platform.
    const rel = posixRelative(root, abs)
    if (isIgnored(rel, entry.isDirectory(), rules)) return []
    if (entry.isDirectory()) return walkTemplates(abs, root, rules)
    if (entry.isFile() && !entry.name.endsWith('.ts')) return [abs]
    return []
  })
}

/**
 * Absolute paths of the template files to embed, rooted at `templatesRoot`.
 *
 * Extracted as a pure, root-parameterized function so the exclusion rules are
 * testable against a synthetic tree without writing the committed manifest —
 * see `generate-embedded-static-assets.test.ts`.
 *
 * EXCLUSION RULE: `.gitignore` semantics, evaluated against the repository's own
 * `.gitignore`. Everything collected here is embedded verbatim into a PUBLIC
 * binary, so "should this ship?" is the same question as "is this tracked?" —
 * which git already answers exactly, including the discriminating
 * `.env` / `.env.example` pair that defeats any dotfile-blind rule.
 *
 * This replaced a filter that excluded only `*.ts`. That filter embedded the
 * gitignored `.sovrium/` runtime data directory — a live SQLite database, its
 * WAL/SHM sidecars, and uploaded files — plus `.env`, `.DS_Store` and
 * `node_modules/`, for any developer who had run a template locally before
 * regenerating. It was invisible three ways: the sources are gitignored so
 * review never showed them, the manifest diff is ~500 lines of `_aNNN`
 * renumbering, and CI's clean checkout produced a correct manifest so no gate
 * could fail.
 *
 * The rules are PARSED in-process rather than shelled out to `git check-ignore`
 * or `git ls-files`: this runs during `build`, which must work from a source
 * tarball with no git binary and no `.git` directory. Parsing also keeps the
 * function pure and root-parameterized. An ignored DIRECTORY is not descended
 * into — how git itself behaves, and what stops nested uploads from leaking.
 */
export const collectTemplateFiles = (
  templatesRoot: string,
  rules: readonly IgnoreRule[] = readProjectIgnoreRules()
): readonly string[] => walkTemplates(templatesRoot, templatesRoot, rules)

const templateEntries = collectTemplateFiles(TEMPLATES_ROOT).map((abs) => {
  const key = posixRelative(TEMPLATES_ROOT, abs)
  return `  ${JSON.stringify(key)}: ${addImport(`templates/${key}`)},`
})

// Design-system console sample media — the still, the clip and the chime that
// the `image`, `video` and `audio` specimens draw. Keyed by BASENAME, because
// the folder is flat by design and the serving route is flat too
// (`/assets/design-system/<file>`).
const SAMPLES_ROOT = join(PROJECT_ROOT, 'src', 'admin', 'assets', 'samples')

/**
 * Absolute paths of the design-system sample media to embed, rooted at
 * `samplesRoot`.
 *
 * TWO THINGS THIS WALK GETS RIGHT ON PURPOSE.
 *
 * 1. **It matches the ignore rules against a REPO-ROOT-relative path**, not a
 *    path relative to its own root — which is where {@link collectTemplateFiles}
 *    differs, and the difference is load-bearing rather than stylistic. The
 *    repository ignores `*.mp3` and `*.webm` outright (media recordings are
 *    never committed) and re-includes this one folder with two anchored `!`
 *    lines, `!src/admin/assets/samples/*.webm` and `…/*.mp3`. An anchored rule
 *    is matched from the `.gitignore`'s own directory, so `sample-chime.mp3`
 *    only ever reaches that negation when it is spelled
 *    `src/admin/assets/samples/sample-chime.mp3`. Feed the walk a bare
 *    basename and the unanchored `*.mp3` is the last rule that matches: two of
 *    the three samples vanish from the binary, in a manifest diff that shows
 *    only a shorter list.
 *
 * 2. **An empty result THROWS.** That is the detector for exactly the failure
 *    above, and for the simpler one where someone tidies the `!` lines out of
 *    `.gitignore` because "we don't commit media". Both produce a generator
 *    that succeeds, a manifest that looks plausible, and a console whose three
 *    media specimens 404 — *only in the compiled binary*, because dev serves
 *    the files off disk and never consults this map. Failing the build is the
 *    only place that divergence is cheap to notice.
 *
 * `README.md` is excluded: it documents the ffmpeg graph each file was
 * synthesised from, and is not something the console serves. The rule is a
 * denial rather than a media allow-list so that a fourth sample in a fourth
 * format ships by existing, the same way the template walk denies `.ts` rather
 * than listing the formats `init` writes.
 *
 * Exported and root-parameterized so both properties are testable — see
 * `generate-embedded-static-assets.test.ts`.
 */
export const collectSampleFiles = (
  samplesRoot: string,
  ignoreRoot: string = PROJECT_ROOT,
  rules: readonly IgnoreRule[] = readProjectIgnoreRules()
): readonly string[] => {
  const collected = readdirSync(samplesRoot, { withFileTypes: true })
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry): readonly string[] => {
      if (entry.isDirectory()) {
        throw new Error(
          `Unexpected subdirectory in the sample-media folder: ${entry.name}. ` +
            `Samples are keyed by basename and served from one flat route, so a ` +
            `nested file would be embedded under a key that collides or never resolves.`
        )
      }
      if (!entry.isFile() || entry.name.endsWith('.md')) return []
      const abs = join(samplesRoot, entry.name)
      const rel = posixRelative(ignoreRoot, abs)
      return isIgnored(rel, false, rules) ? [] : [abs]
    })
  if (collected.length === 0) {
    throw new Error(
      `No design-system sample media collected from ${samplesRoot}. The repository ` +
        `ignores *.mp3 and *.webm and re-includes this folder with anchored negation lines, ` +
        `so either those negations were removed from .gitignore or this walk stopped ` +
        `matching them against repo-root-relative paths. Embedding nothing here ships a ` +
        `binary whose console media specimens 404 — silently, since dev reads them off disk.`
    )
  }
  return collected
}

const sampleEntries = collectSampleFiles(SAMPLES_ROOT).map((abs) => {
  const key = posixRelative(SAMPLES_ROOT, abs)
  return `  ${JSON.stringify(key)}: ${addImport(`src/admin/assets/samples/${key}`)},`
})

// Brand marks — the element mark each business unit is drawn with, served to
// console pages at `/assets/brand/<unit>/<file>`.
const BRAND_LOGO_ROOT = join(PROJECT_ROOT, 'assets', 'logo')

/**
 * The two files each unit contributes: one fixed ink per ground, outlined.
 *
 * BOTH ADJECTIVES ARE LOAD-BEARING, and each excludes files sitting right
 * beside these in the same directory.
 *
 * *Outlined*, because an SVG loaded through `<img src>` renders inside its OWN
 * document and reaches neither the console's stylesheet nor its webfonts. The
 * live-text siblings (`mark-{light,dark}.svg`) carry a `<text>` node asking for
 * `'IBM Plex Sans'`, so through an `<img>` they fall back to `system-ui` and
 * draw the mark in the wrong typeface at the wrong width, differently on every
 * platform. The `-outline` files carry the same composition as paths.
 *
 * *Fixed-ink*, because `currentColor` resolves against that same private
 * document rather than the page's. The `mark-outline.svg` master is outlined
 * and would pass the first test, yet it paints black on a dark console — so a
 * unit's mark inverts by SWAPPING these two files under the `dark:` variant,
 * never by inheriting a colour it cannot see.
 */
const BRAND_MARK_FILENAMES: ReadonlySet<string> = new Set([
  'mark-dark-outline.svg',
  'mark-light-outline.svg',
])

/** The marks the console itself draws — their absence is a blank sign-in card. */
const REQUIRED_BRAND_MARKS: readonly string[] = [
  'sovrium/mark-dark-outline.svg',
  'sovrium/mark-light-outline.svg',
]

/**
 * Absolute paths of the brand marks to embed, rooted at `logoRoot`.
 *
 * KEYED UNIT-QUALIFIED (`sovrium/mark-light-outline.svg`), which is the one
 * structural difference from {@link collectSampleFiles} and is forced rather
 * than chosen: `assets/logo/` holds one directory per business unit
 * (`sovrium`, `partner`, `academy`, `cloud`) and all four hold files of the
 * SAME names — the filename says which variant, the directory says which unit.
 * Keying by basename would collide four ways, which is exactly why the sample
 * collector's flat rule throws on a subdirectory. The unit-qualified key adds
 * no traversal surface, because the serving route still does a property read on
 * a frozen map with no path join anywhere.
 *
 * The allow-list is by NAME rather than by a glob or a denial, so the two
 * hazardous shapes in the same directory — live text and `currentColor` — are
 * excluded by construction rather than by a filter someone could relax. Adding
 * a variant is an edit here, deliberately.
 *
 * MISSING REQUIRED MARKS THROW. The console's own sign-in card names the
 * `sovrium` pair by absolute path, so a rename or a move that emptied the
 * family would ship a binary whose brand is a broken-image box — and only in
 * the compiled binary, since a checkout serves the same bytes from the same
 * manifest either way. The build is the cheap place to notice.
 *
 * Exported and root-parameterized so the rules are testable against a synthetic
 * tree without writing the committed manifest — see
 * `generate-embedded-static-assets.test.ts`.
 */
export const collectBrandMarkFiles = (logoRoot: string): readonly string[] => {
  const collected = readdirSync(logoRoot, { withFileTypes: true })
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .flatMap((unit): readonly string[] => {
      if (!unit.isDirectory()) return []
      const unitDir = join(logoRoot, unit.name)
      return readdirSync(unitDir, { withFileTypes: true })
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .flatMap((entry) =>
          entry.isFile() && BRAND_MARK_FILENAMES.has(entry.name) ? [join(unitDir, entry.name)] : []
        )
    })

  const keys = new Set(collected.map((abs) => posixRelative(logoRoot, abs)))
  const missing = REQUIRED_BRAND_MARKS.filter((required) => !keys.has(required))
  if (missing.length > 0) {
    throw new Error(
      `Brand mark(s) missing from ${logoRoot}: ${missing.join(', ')}. The console's sign-in ` +
        `card names these by absolute path, so embedding nothing here ships a binary whose ` +
        `brand is a broken-image box — visible only once compiled.`
    )
  }
  return collected
}

const brandMarkEntries = collectBrandMarkFiles(BRAND_LOGO_ROOT).map((abs) => {
  const key = posixRelative(BRAND_LOGO_ROOT, abs)
  return `  ${JSON.stringify(key)}: ${addImport(`assets/logo/${key}`)},`
})

// The admin console used to be embedded here as a YAML file read at request
// time. It is now authored as `src/admin/` and frozen into a generated
// TypeScript module by `scripts/build/generate-admin-preset.ts`, which is a
// VALUE rather than a file — so it needs no `with { type: 'file' }` entry, and
// unlike a file it is walked by the CSS candidate scanner.

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const header = `/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable */
// @ts-nocheck
// AUTO-GENERATED by scripts/build/generate-embedded-static-assets.ts — DO NOT EDIT.
// Each \`with { type: 'file' }\` import embeds the file into the compiled binary
// and resolves to its on-disk path in dev/bundled mode.
`

const importBlock = imports
  .map((i) => `import ${i.varName} from '${i.importPath}' with { type: 'file' }`)
  .join('\n')

const body = `
/** Per-dialect migration folder name → embedded \`migration.sql\` path. */
export const MIGRATION_FILES = {
  pg: ${pgBlock},
  sqlite: ${sqliteBlock},
}

/** Example filename → embedded path. */
export const TEMPLATE_FILES = {
${templateEntries.join('\n')}
}

/** Design-system console sample-media basename → embedded path. */
export const DESIGN_SYSTEM_SAMPLE_FILES = {
${sampleEntries.join('\n')}
}

/** Brand-mark \`<unit>/<file>\` key → embedded path. */
export const BRAND_MARK_FILES = {
${brandMarkEntries.join('\n')}
}
`

// Guarded so importing this module (from its unit test) never rewrites the
// committed manifest. Every real invocation is `bun run <this file>`, where
// `import.meta.main` is true — see scripts/build/build-binary.ts and
// [internal ref].
if (import.meta.main) {
  writeFileSync(OUT_FILE, `${header}\n${importBlock}\n${body}`)
  console.log(
    `embedded-static-assets.generated.ts — ${imports.length} files (` +
      `${migrationFolders('drizzle').length} pg + ${migrationFolders('drizzle/sqlite').length} sqlite migrations, ` +
      `${templateEntries.length} templates, ${sampleEntries.length} design-system samples, ` +
      `${brandMarkEntries.length} brand marks)`
  )
}
