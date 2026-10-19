/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The engine half of the CSS attribution tooling: the Tailwind compiler the
 * binary runs, fed explicit candidates; the design-system loader behind the
 * junk filter; the template configs the generator proves against and the
 * census measures; and the two pure helpers that turn a declared-type set into
 * the candidate set the runtime will compile.
 */

import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Effect } from 'effect'
import { __unstable__loadDesignSystem, compile, type Polyfills } from 'tailwindcss'
import { loadSchemaFromFile } from '@/infrastructure/config/file-loader'
import { buildSourceCSS } from '@/infrastructure/css/source-css'
import { loadCodeBlockDarkPalette } from '@/infrastructure/css/theme/code-block-theme-palette'
import type { App } from '@/domain/models/app'

export const REPO_ROOT = join(import.meta.dir, '..', '..')

export class CssAttributionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CssAttributionError'
  }
}
export const fail = (message: string): never => {
  throw new CssAttributionError(message)
}

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

// =============================================================================
// Compilation — the engine the binary runs, fed explicit candidates
// =============================================================================

const stylesheet = (relPath: string): string =>
  readFileSync(join(REPO_ROOT, 'node_modules', relPath), 'utf8')

const EMBEDDED_STYLESHEETS: Readonly<Record<string, () => string>> = {
  tailwindcss: () => stylesheet('tailwindcss/index.css'),
  'tw-animate-css': () => stylesheet('tw-animate-css/dist/tw-animate.css'),
  'shadcn/tailwind.css': () => stylesheet('shadcn/dist/tailwind.css'),
}

const compileOptions = () => ({
  base: '/',
  polyfills: 3 as Polyfills,
  loadStylesheet: (id: string) => {
    const read = EMBEDDED_STYLESHEETS[id]
    return read === undefined
      ? Promise.reject(new Error(`unknown @import '${id}'`))
      : Promise.resolve({ path: id, base: '/', content: read() })
  },
  loadModule: (id: string) => Promise.reject(new Error(`unknown @plugin '${id}'`)),
})

type CompileOptions = NonNullable<Parameters<typeof compile>[1]>

/** The source CSS the runtime builds for a design (dark code-block palette included). */
export const sourceCssFor = async (design: App['design'] | undefined): Promise<string> => {
  const palette = await Effect.runPromise(loadCodeBlockDarkPalette)
  return buildSourceCSS(design === undefined ? undefined : ({ design } as App), palette)
}

/**
 * Compile `sourceCSS` against exactly these candidates with a FRESH compiler.
 * `build()` is incremental and order-sensitive, so a shared instance would
 * make the second measurement depend on the first.
 */
export const compileCandidates = async (
  sourceCSS: string,
  candidates: readonly string[]
): Promise<string> => {
  const compiled = await compile(sourceCSS, compileOptions() as CompileOptions)
  return compiled.build([...candidates].toSorted())
}

export type DesignSystem = Awaited<ReturnType<typeof __unstable__loadDesignSystem>>

export const loadDesignSystem = (sourceCSS: string): Promise<DesignSystem> =>
  __unstable__loadDesignSystem(sourceCSS, compileOptions() as CompileOptions)

/**
 * The junk filter. oxide over-extracts on purpose (every class-shaped token:
 * identifiers, property names, prose), and the engine emits nothing for a
 * token no design system can parse — so those are dropped. Raw `--*` tokens
 * are kept whatever the parser says: a theme variable named as a candidate is
 * what keeps it alive through Tailwind's theme pruning.
 */
export const makeJunkFilter = (
  designSystems: readonly DesignSystem[]
): ((candidate: string) => boolean) => {
  if (designSystems.length === 0) return fail('makeJunkFilter needs at least one design system')
  const cache = new Map<string, boolean>()
  return (candidate) => {
    const cached = cache.get(candidate)
    if (cached !== undefined) return cached
    const live =
      /^--[a-zA-Z]/.test(candidate) ||
      designSystems.some((ds) => ds.parseCandidate(candidate).length > 0)
    cache.set(candidate, live)
    return live
  }
}

// =============================================================================
// Templates — the designs to prove against, the apps to measure
// =============================================================================

export interface TemplateApp {
  readonly slug: string
  readonly app: App
}

/** Every `templates/<slug>/app.*` config, `$ref`s resolved, undecoded. */
export const loadTemplateApps = async (): Promise<readonly TemplateApp[]> => {
  const { readdirSync } = await import('node:fs')
  const root = join(REPO_ROOT, 'templates')
  const slugs = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()
  const apps: TemplateApp[] = []
  for (const slug of slugs) {
    const config = ['app.ts', 'app.yaml', 'app.yml', 'app.json']
      .map((name) => join(root, slug, name))
      .find(isFile)
    if (config === undefined) continue
    apps.push({ slug, app: (await loadSchemaFromFile(config)) as unknown as App })
  }
  if (apps.length < 10) return fail(`only ${apps.length} template configs found under templates/`)
  return apps
}

/**
 * The component types an app declares, read loosely: every `type` string on a
 * node inside a `components` or `children` array under `pages`, plus the
 * `components` templates. A census helper, not the runtime walker — it may
 * over-read (a form field's `type: text`), never under-read.
 */
export const declaredTypesOf = (app: unknown): ReadonlySet<string> => {
  const types = new Set<string>()
  const visit = (node: unknown, inComponentList: boolean): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, inComponentList)
      return
    }
    if (node === null || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    if (inComponentList && typeof record.type === 'string') types.add(record.type)
    for (const [key, value] of Object.entries(record)) {
      visit(value, key === 'components' || key === 'children')
    }
  }
  const root = (app ?? {}) as Record<string, unknown>
  visit(root.pages, false)
  if (root.components !== null && typeof root.components === 'object') {
    for (const template of Object.values(root.components as Record<string, unknown>)) {
      visit([template], true)
    }
  }
  return types
}

/** The candidate set the runtime will compile for a declared-type set. */
export interface ComponentCssGroup {
  readonly types: readonly string[]
  readonly classes: readonly string[]
}

export const candidatesForTypes = (
  attribution: { readonly core: readonly string[]; readonly groups: readonly ComponentCssGroup[] },
  declared: ReadonlySet<string>
): readonly string[] =>
  [
    ...new Set([
      ...attribution.core,
      ...attribution.groups
        .filter((group) => group.types.some((type) => declared.has(type)))
        .flatMap((group) => group.classes),
    ]),
  ].toSorted()
