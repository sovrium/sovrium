/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium design-system import --pages --write` — applying the merged pages
 * to the config on disk, after the whole resulting config is judged.
 *
 * A YAML or JSON config is patched in place, on its page entries only, and the
 * patched BYTES are judged as `sovrium validate` judges a file — then checked
 * to read back as exactly the pages the merge produced, so a page the patch
 * could not find in place is refused rather than duplicated. A page entry
 * assembled from an include is refused too: a rewrite would inline it and
 * orphan the file it names.
 *
 * A translated edit writes the default language's entry for its key in
 * `languages.translations` of a YAML or JSON config, the YAML one on its own
 * line in its own quoting; two edits of one key drawn two ways write nothing.
 *
 * A TypeScript config is never edited. Each changed page goes to the
 * `<name>.page.json` sidecar the export's `pages/page-sidecars.json` names (or,
 * with no bundle beside the drawing, the same path worked out from the
 * config), and a new sidecar comes with the line to add to the module that
 * owns the page.
 */

import { dirname, join } from 'node:path'
import {
  conflictingKeys,
  type TranslationWrite,
} from '@/domain/models/app/pages/page-merge-translation-service'
import { refuse } from './app-prelude'
import { holdsColours, patchColours, type ColourWrite } from './design-system-import-pages-tokens'
import {
  changedBytes,
  patchJsonPages,
  patchYamlPages,
  writePageSidecar,
  type PagePatch,
} from './design-system-import-pages-write'
import { patchYamlScalarsInPlace } from './design-system-import-pages-yaml'
import { writeAtomically } from './design-system-import-write'
import { indented, judgeConfig, rootFormatOf } from './library-add-config'
import { bindingName } from './library-wire'
import { validateParsedConfig } from './validate'
import type { PageImportReport } from '@/domain/models/api/admin/design-system/page-import-report'
import type { PageMergePlan } from '@/domain/models/app/pages/page-merge'

type JsonObject = Readonly<Record<string, unknown>>

/** One page's merge, by page name. */
export interface MergedPage {
  readonly name: string
  /** The drawing it was read from, as the source names it. */
  readonly drawing?: string | undefined
  readonly plan: PageMergePlan
}

/** The config as loaded: its parsed root and the include sources it read. */
interface LoadedConfig {
  readonly parsed: unknown
  readonly refSources: ReadonlyMap<string, string>
}

type Written = NonNullable<PageImportReport['written']>

const refuseInvalid = (errors: readonly string[]): never =>
  refuse(
    `Error: The imported pages do not validate, so nothing was written.\n\n${indented(errors)}`
  )

const pagesOf = (root: unknown): readonly JsonObject[] => {
  const pages = (root as JsonObject | undefined)?.['pages']
  return Array.isArray(pages) ? (pages as readonly JsonObject[]) : []
}

/** The parsed root with each patched page entry in its place, and each new page after them. */
const withPatches = (parsed: unknown, patches: readonly PagePatch[]): JsonObject => ({
  ...(parsed as JsonObject),
  pages: [
    ...pagesOf(parsed).map(
      (page) => patches.find((patch) => patch.name === page['name'])?.entry ?? page
    ),
    ...patches
      .filter((patch) => !pagesOf(parsed).some((page) => page['name'] === patch.name))
      .map((patch) => patch.entry),
  ],
})

const objectAt = (value: unknown, key: string): JsonObject => {
  const child = (value as JsonObject | undefined)?.[key]
  return typeof child === 'object' && child !== null ? (child as JsonObject) : {}
}

/** A root with each translation entry set in its language. */
const withTranslations = (root: JsonObject, writes: readonly TranslationWrite[]): JsonObject => {
  if (writes.length === 0) return root
  const languages = objectAt(root, 'languages')
  const translations = writes.reduce<JsonObject>(
    (acc, write) => ({
      ...acc,
      [write.language]: { ...objectAt(acc, write.language), [write.key]: write.text },
    }),
    objectAt(languages, 'translations')
  )
  return { ...root, languages: { ...languages, translations } }
}

/** Whether a root holds each translation entry as written. */
const holdsTranslations = (root: unknown, writes: readonly TranslationWrite[]): boolean =>
  writes.every(
    (write) =>
      objectAt(objectAt(objectAt(root, 'languages'), 'translations'), write.language)[write.key] ===
      write.text
  )

/** A JSON config with its translation entries set, laid out as it was. */
const patchJsonTranslations = (text: string, writes: readonly TranslationWrite[]): string => {
  if (writes.length === 0) return text
  const indent = /\n( +|\t)"/.exec(text)?.[1] ?? '  '
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const body = JSON.stringify(
    withTranslations(JSON.parse(text) as JsonObject, writes),
    undefined,
    indent
  )
  return `${eol === '\n' ? body : body.replaceAll('\n', eol)}${text.endsWith('\n') ? eol : ''}`
}

/** A YAML config with its translation entries set in place, or `undefined` when one cannot be. */
const patchYamlTranslations = (
  text: string,
  writes: readonly TranslationWrite[]
): string | undefined => {
  if (writes.length === 0) return text
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = patchYamlScalarsInPlace(
    text.split(eol),
    writes.map((write) => ({
      path: ['languages', 'translations', write.language, write.key],
      value: write.text,
    }))
  )
  return lines?.join(eol)
}

/** The raw root of a YAML or JSON file, or `undefined` when it does not parse. */
const rawRootOf = (text: string, format: 'yaml' | 'json'): unknown => {
  try {
    return format === 'json' ? (JSON.parse(text) as unknown) : Bun.YAML.parse(text)
  } catch {
    // Already refused by the validation that loaded it.
    return undefined
  }
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** What one write changes in a YAML or JSON config. */
interface ConfigChange {
  readonly patches: readonly PagePatch[]
  readonly writes: readonly TranslationWrite[]
  readonly colours: readonly ColourWrite[]
}

/** A config's text with its pages, translations and colours patched, or `undefined`. */
const patchedConfig = (
  text: string,
  format: 'yaml' | 'json',
  change: ConfigChange
): string | undefined => {
  const { patches, writes } = change
  const translated =
    format === 'json'
      ? patchJsonTranslations(patches.length === 0 ? text : patchJsonPages(text, patches), writes)
      : (() => {
          const paged = patches.length === 0 ? text : patchYamlPages(text, patches)
          return paged === undefined ? undefined : patchYamlTranslations(paged, writes)
        })()
  return translated === undefined ? undefined : patchColours(translated, format, change.colours)
}

/** Patch a YAML or JSON config's page entries, after judging the patched bytes. */
const writeIntoConfig = async (
  configPath: string,
  format: 'yaml' | 'json',
  loaded: LoadedConfig,
  change: ConfigChange
): Promise<Written> => {
  const { patches, writes } = change
  const text = await Bun.file(configPath).text()
  const raw = pagesOf(rawRootOf(text, format))
  const included = patches.filter((patch) => {
    const own = raw.find((page) => page['name'] === patch.name)
    const resolved = pagesOf(loaded.parsed).find((page) => page['name'] === patch.name)
    // A new page is no one's include.
    return resolved !== undefined && (own === undefined || !sameJson(own, resolved))
  })
  if (included.length > 0) {
    return refuse(
      `Error: The page ${included.map((patch) => patch.name).join(', ')} is assembled from another file, so the import does not patch it in place.\n\n` +
        '  Import into a config whose pages are written inline, or copy the dry-run changes into that file.'
    )
  }
  const next = patchedConfig(text, format, change)
  if (next === undefined) {
    return refuse(
      `Error: The pages of "${configPath}" could not be found entry by entry, so nothing was written.\n\n` +
        '  Write `pages:` as a plain top-level list, or copy the dry-run changes into the file.'
    )
  }
  const judged = await judgeConfig(configPath, new Map([[configPath, next]]))
  if (judged.errors.length > 0) return refuseInvalid(judged.errors)
  const expected = withPatches(loaded.parsed, patches)['pages']
  if (
    !sameJson(pagesOf(judged.parsed), expected) ||
    !holdsTranslations(judged.parsed, writes) ||
    !holdsColours(judged.parsed, change.colours)
  ) {
    return refuse(
      `Error: The pages of "${configPath}" could not be patched in place, so nothing was written.\n\n` +
        '  Write `pages:` as a plain top-level list, or copy the dry-run changes into the file.'
    )
  }
  if (next !== text) await writeAtomically(configPath, next)
  return { config: configPath, bytes: changedBytes(text, next) }
}

/** The bundle a drawing sits in: the nearest folder above it holding `pages/page-sidecars.json`. */
const sidecarManifestNear = async (
  source: string
): Promise<ReadonlyMap<string, string> | undefined> => {
  const candidates = Array.from({ length: 6 }).reduce<readonly string[]>(
    (acc) => [...acc, dirname(acc.at(-1) ?? source)],
    [source]
  )
  const found = await Promise.all(
    candidates.map(async (folder) => {
      const file = Bun.file(join(folder, 'pages', 'page-sidecars.json'))
      return (await file.exists()) ? file : undefined
    })
  )
  const manifest = found.find((file) => file !== undefined)
  if (manifest === undefined) return undefined
  try {
    const parsed = (await manifest.json()) as {
      readonly pages?: readonly { readonly page?: unknown; readonly sidecar?: unknown }[]
    }
    return new Map(
      (parsed.pages ?? []).flatMap((entry) =>
        typeof entry.page === 'string' && typeof entry.sidecar === 'string'
          ? [[entry.page, entry.sidecar] as const]
          : []
      )
    )
  } catch {
    // An unreadable manifest names nothing; the path is worked out from the config.
    return undefined
  }
}

/**
 * Whether a sidecar name a bundle's manifest gives stays beside the config: a
 * relative `*.page.json` path with no `..`, no leading `/`, no
 * backslash, no drive letter and no control character.
 */
export const isSidecarName = (name: string): boolean =>
  name.endsWith('.page.json') &&
  !name.startsWith('/') &&
  !name.includes('\\') &&
  !/^[a-z]:/i.test(name) &&
  ![...name].some((char) => (char.codePointAt(0) ?? 0) < 0x20 || char === '\x7f') &&
  !name.includes('..')

/** Where a page's sidecar goes, relative to the config: the manifest's, else `<name>.page.json`. */
const sidecarPathOf = (manifest: ReadonlyMap<string, string> | undefined, page: string): string => {
  const named = manifest?.get(page)
  return named !== undefined && isSidecarName(named) ? named : `${page}.page.json`
}

/** Write each changed page of a TypeScript config to its sidecar, the config untouched. */
const writeSidecars = async (
  configPath: string,
  source: string,
  loaded: LoadedConfig,
  patches: readonly PagePatch[]
): Promise<Written> => {
  const outcome = await validateParsedConfig(withPatches(loaded.parsed, patches), loaded.refSources)
  if (outcome.errors.length > 0) return refuseInvalid(outcome.errors)
  const manifest = await sidecarManifestNear(source)
  const written = await patches.reduce<
    Promise<
      readonly {
        readonly entry: NonNullable<Written['sidecars']>[number]
        readonly bytes: number
      }[]
    >
  >(async (previous, patch) => {
    const acc = await previous
    const path = sidecarPathOf(manifest, patch.name)
    const result = await writePageSidecar(configPath, path, patch.entry)
    if ('foreign' in result) {
      return refuse(
        `Error: "${result.foreign}" already exists and holds another page, so it was not overwritten.\n\n` +
          '  Move or rename it, then run the import again.'
      )
    }
    const importLine = result.existed
      ? undefined
      : `import ${bindingName(patch.name)} from './${path}'`
    return [
      ...acc,
      {
        entry: { page: patch.name, path, ...(importLine === undefined ? {} : { importLine }) },
        bytes: result.bytes,
      },
    ]
  }, Promise.resolve([]))
  return {
    bytes: written.reduce((sum, item) => sum + item.bytes, 0),
    ...(written.length === 0 ? {} : { sidecars: written.map((item) => item.entry) }),
  }
}

/**
 * Write the merged pages, or nothing when no page changed.
 *
 * @param configPath - the config the pages belong to.
 * @param source - the drawing, beside which the bundle's sidecar manifest may sit.
 * @param loaded - the config as loaded and judged.
 * @param change - every page's merge, and the design colours `--tokens` writes beside them.
 */
export const writeMergedPages = async (
  configPath: string,
  source: string,
  loaded: LoadedConfig,
  change: { readonly merged: readonly MergedPage[]; readonly colours?: readonly ColourWrite[] }
): Promise<Written> => {
  const { merged, colours = [] } = change
  const patches = merged.flatMap(({ name, plan }) =>
    plan.patch === undefined ? [] : [{ name, entry: plan.patch }]
  )
  const writes = translationWritesOf(merged)
  const format = rootFormatOf(configPath)
  if (format === 'typescript') {
    return patches.length === 0 ? { bytes: 0 } : writeSidecars(configPath, source, loaded, patches)
  }
  return patches.length === 0 && writes.length === 0 && colours.length === 0
    ? { config: configPath, bytes: 0 }
    : writeIntoConfig(configPath, format, loaded, { patches, writes, colours })
}

/**
 * Judge a dry run as `--write` judges what it would write: the merged pages and
 * their translation entries in the config as loaded, refused when they would
 * not validate. A change a dry run reports as applicable is then one `--write`
 * applies, and a refusal reads the same in both modes.
 *
 * @param loaded - the config as loaded and judged.
 * @param merged - every page's merge.
 */
export const judgeMergedPages = async (
  loaded: LoadedConfig,
  merged: readonly MergedPage[]
): Promise<void> => {
  const patches = merged.flatMap(({ name, plan }) =>
    plan.patch === undefined ? [] : [{ name, entry: plan.patch }]
  )
  const writes = translationWritesOf(merged)
  if (patches.length === 0 && writes.length === 0) return
  const candidate = withTranslations(withPatches(loaded.parsed, patches), writes)
  const outcome = await validateParsedConfig(candidate, loaded.refSources)
  if (outcome.errors.length > 0) refuseInvalid(outcome.errors)
}

/** Every translation entry the pages write, one per key; a key drawn two ways is refused. */
const translationWritesOf = (merged: readonly MergedPage[]): readonly TranslationWrite[] => {
  const writes = merged.flatMap(({ plan }) => plan.translationWrites)
  const conflicting = conflictingKeys(writes)
  if (conflicting.size > 0) {
    return refuse(
      `Error: The translated text ${[...conflicting].join(', ')} is drawn two ways, so nothing was written.\n\n` +
        '  Draw it the same way everywhere it appears, then run the import again.'
    )
  }
  return [...new Map(writes.map((write) => [`${write.language} ${write.key}`, write])).values()]
}
