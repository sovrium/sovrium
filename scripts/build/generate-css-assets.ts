/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Generate CSS Assets Script
 *
 * Produces `src/infrastructure/css/generated-css-assets.ts`, which embeds the
 * static inputs the native-free CSS compiler needs to run inside the standalone
 * compiled binary (`bun build --compile`).
 *
 * Why this exists (issue #19):
 *   1. The candidate sets — the compiled binary runs from a virtual filesystem
 *      with no working directory to scan, so the native `@tailwindcss/oxide`
 *      scanner cannot discover which utility classes the app uses. We run that
 *      scanner HERE, on the build machine, and embed the result. Critically
 *      this captures classes from client-side islands, which never appear in
 *      server-rendered HTML.
 *   2. TAILWIND_INDEX_CSS / TW_ANIMATE_CSS / SHADCN_TAILWIND_CSS — the binary
 *      has no node_modules, so the stylesheets the three `@import`s resolve to
 *      must be inlined.
 *
 * Why the candidates are ATTRIBUTED (issue #199): one flat set meant every app
 * downloaded the stylesheet of every component type the engine ships. The scan
 * is now split by `[internal ref]` into CORE (every page),
 * CONSOLE (the operator console alone) and per-type-signature GROUPS, and the
 * runtime compiles CORE plus the groups an app's declared types intersect.
 * `BUILTIN_CSS_CANDIDATES` stays the sorted union of the three — the operator
 * console, an undecidable config and the test fleet's generic file keep using
 * it, and so does `appAddsCandidatesBeyondBuiltin`.
 *
 * The scan is also FILTERED: oxide deliberately over-extracts (57k tokens, of
 * which ~3.4k are utilities any design can parse). The dropped tokens produced
 * no CSS, and this script PROVES that on every run — the stylesheet compiled
 * from the kept set is byte-equal to the one compiled from the raw scan, under
 * the default design and under every template's design.
 *
 * Runs automatically from `scripts/build/build-binary.ts` before `bun build
 * --compile`, or standalone via `bun run build:css-assets`.
 *
 * Usage:
 *   bun run scripts/build/generate-css-assets.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateArbitraryVarSafelist } from '../../src/infrastructure/css/arbitrary-var-safelist'
import {
  attributeCorpus,
  compileCandidates,
  loadDesignSystem,
  loadTemplateApps,
  makeJunkFilter,
  REPO_ROOT,
  scanCorpus,
  sourceCssFor,
  type Attribution,
} from '../lib/css-attribution'
import type { App } from '../../src/domain/models/app'

const COPYRIGHT_HEADER = `/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */`

/**
 * Floors on the measurement itself. A walk that resolved nothing would produce
 * a small, plausible-looking map and a binary whose pages render unstyled; the
 * floors make that a build failure. Each sits well under the value measured
 * the day it was set (1,705 presentation files, 998 type-reached, 86 groups),
 * so ordinary growth or a refactor never trips one — only a broken walk does.
 */
const FLOORS = {
  presentationFiles: 1500,
  typeReachedFiles: 600,
  groups: 60,
  coreClasses: 500,
  consoleClasses: 100,
} as const

const fail = (message: string): never => {
  throw new Error(message)
}

const readStylesheet = (relPath: string): string =>
  readFileSync(join(REPO_ROOT, 'node_modules', relPath), 'utf-8')

const formatKb = (...strings: readonly string[]): string => {
  const bytes = strings.reduce((sum, s) => sum + s.length, 0)
  return `${(bytes / 1000).toFixed(1)} KB`
}

/**
 * Runtime-composed recipe classes (`rounded-[${v('radius-md', T.radiusMd)}]`,
 * `bg-[${v('sv-X', T.Y)}]` in the `*-default-classes.ts` recipes) are invisible
 * to the oxide source scan — it sees the `${…}` template placeholder, not the
 * resolved literal — so those classes would ship with no CSS in the binary.
 * Fold the resolved safelist into CORE (it has no file provenance, and radius
 * is read by every recipe tree), and guard loudly on two independent proofs:
 *
 * - SAFELIST_SENTINEL: the shared `RADIUS_MD` read, which every recipe tree
 *   keeps (radius has no plain-utility replacement). Its presence proves the
 *   safelist walk still reached the recipes. Deliberately NOT an `--sv-*`
 * alias token: those are being
 *   retired, and a sentinel naming one would fail the build on success.
 * - POPUP_SURFACE_CANDIDATE: the shadcn `bg-popover` utility the shared
 *   `POPUP_SURFACE` recipe (menu/select/dialog popups) reads. It is a plain
 *   literal, so the ordinary scan must harvest it AND the junk filter must keep
 *   it; without it every overlay would render transparent in the binary.
 */
const SAFELIST_SENTINEL = 'rounded-[var(--radius-md,'
const POPUP_SURFACE_CANDIDATE = 'bg-popover'

const readSafelist = (): readonly string[] => {
  const safelist = generateArbitraryVarSafelist()
  if (safelist.length === 0) {
    fail(
      'generateArbitraryVarSafelist() returned empty — the recipe scan broke; the binary CSS would drop every runtime-composed recipe class.'
    )
  }
  if (!safelist.some((cls) => cls.startsWith(SAFELIST_SENTINEL))) {
    fail(
      `Arbitrary-var safelist is missing the shared radius class (${SAFELIST_SENTINEL}…) — the recipe scan no longer reaches the *-default-classes.ts recipes.`
    )
  }
  return safelist
}

interface Design {
  readonly slug: string
  readonly design: App['design'] | undefined
}

/** The default design plus every template's — the designs the proof runs under. */
const designsToProve = async (): Promise<readonly Design[]> => {
  const templates = await loadTemplateApps()
  const withDesign = templates.filter((template) => template.app.design !== undefined)
  if (withDesign.length < 10) {
    fail(`only ${withDesign.length} templates declare a design — the template loader broke`)
  }
  return [
    { slug: 'default', design: undefined },
    ...withDesign.map(({ slug, app }) => ({ slug, design: app.design })),
  ]
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean => {
  const set = new Set(a)
  return set.size === new Set(b).size && b.every((item) => set.has(item))
}

const assertInvariants = (
  attribution: Attribution,
  builtin: readonly string[],
  kept: readonly string[]
): void => {
  const { stats } = attribution
  if (!sameSet(builtin, kept)) {
    const missing = kept.filter((c) => !builtin.includes(c)).slice(0, 5)
    const extra = builtin.filter((c) => !kept.includes(c)).slice(0, 5)
    fail(
      `CORE ∪ CONSOLE ∪ groups ≠ kept scan ∪ safelist (${builtin.length} vs ${kept.length}); ` +
        `missing: ${missing.join(', ')}; extra: ${extra.join(', ')}`
    )
  }
  if (!builtin.includes(POPUP_SURFACE_CANDIDATE)) {
    fail(
      `Candidate set is missing the popup surface class (${POPUP_SURFACE_CANDIDATE}) — overlays would render transparent in the binary.`
    )
  }
  const floors: readonly [string, number, number][] = [
    ['presentation files in the corpus', stats.presentationFiles, FLOORS.presentationFiles],
    ['files reached by a type walk', stats.typeReachedFiles, FLOORS.typeReachedFiles],
    ['file-signature groups', attribution.groups.length, FLOORS.groups],
    ['CORE classes', attribution.core.length, FLOORS.coreClasses],
    ['console-only classes', attribution.console.length, FLOORS.consoleClasses],
  ]
  for (const [name, actual, min] of floors) {
    if (actual < min) {
      fail(`counted ${actual} ${name}, below the floor of ${min} — the attribution walk broke`)
    }
  }
}

const firstDifference = (a: string, b: string): string => {
  const at = [...a].findIndex((char, index) => char !== b[index])
  const offset = at === -1 ? Math.min(a.length, b.length) : at
  return `offset ${offset}: …${a.slice(Math.max(0, offset - 60), offset + 120)}…`
}

const main = async (): Promise<void> => {
  const safelist = readSafelist()
  const corpus = scanCorpus()
  const designs = await designsToProve()
  const sources = new Map<string, string>()
  for (const { slug, design } of designs) sources.set(slug, await sourceCssFor(design))
  const designSystems = []
  for (const source of sources.values()) designSystems.push(await loadDesignSystem(source))
  const keep = makeJunkFilter(designSystems)

  const attribution = attributeCorpus(corpus, keep, safelist)
  const builtin = [
    ...new Set([
      ...attribution.core,
      ...attribution.console,
      ...attribution.groups.flatMap((group) => group.classes),
    ]),
  ].toSorted()
  const all = [...new Set(corpus.flatMap((file) => file.candidates))]
  const kept = [...new Set([...all.filter(keep), ...safelist])]
  assertInvariants(attribution, builtin, kept)

  // The proof that the junk filter dropped nothing the engine would have
  // emitted: byte-equal output from the raw scan and from the kept set, under
  // every design, each with a FRESH compiler (`build()` is incremental).
  const raw = [...new Set([...all, ...safelist])]
  for (const [slug, source] of sources) {
    const fromRaw = await compileCandidates(source, raw)
    const fromKept = await compileCandidates(source, builtin)
    if (fromRaw !== fromKept) {
      fail(
        `Under the ${slug} design the kept candidate set compiles differently from the raw scan ` +
          `(${fromKept.length} vs ${fromRaw.length} bytes) — the junk filter dropped a live class. ` +
          firstDifference(fromRaw, fromKept)
      )
    }
  }

  const tailwindIndexCss = readStylesheet('tailwindcss/index.css')
  const twAnimateCss = readStylesheet('tw-animate-css/dist/tw-animate.css')
  // shadcn's `@import "shadcn/tailwind.css"`: its custom variants,
  // accordion keyframes and scroll-fade/shimmer utilities. Read from the
  // installed package, like the two above, and held byte-equal to the pinned
  // registry snapshot: the binary must embed exactly the stylesheet the
  // snapshot's sha256 names, so a `shadcn` bump without a re-pull fails here
  // instead of shipping.
  const shadcnTailwindCss = readStylesheet('shadcn/dist/tailwind.css')
  const SHADCN_SNAPSHOT_CSS = 'scripts/baselines/shadcn-registry/tailwind.css'
  if (shadcnTailwindCss !== readFileSync(join(REPO_ROOT, SHADCN_SNAPSHOT_CSS), 'utf-8')) {
    fail(
      `node_modules/shadcn/dist/tailwind.css differs from ${SHADCN_SNAPSHOT_CSS}. ` +
        'The installed shadcn and the registry snapshot disagree: run `bun install`, or re-pull ' +
        'the snapshot (`bun run pull:shadcn-registry`) in the commit that bumps shadcn.'
    )
  }

  const lines = (classes: readonly string[]): string =>
    `${JSON.stringify(classes.join('\n'))}.split('\\n')`
  const groupsSource = attribution.groups
    .map(
      (group) => `  { types: ${JSON.stringify(group.types)}, classes: ${lines(group.classes)} },`
    )
    .join('\n')

  const outPath = join(REPO_ROOT, 'src/infrastructure/css/generated-css-assets.ts')
  const fileContent = `// @ts-nocheck -- generated file: huge embedded string literals, never type-checked
/* eslint-disable -- generated file: never linted (see eslint/base.config.ts) */
${COPYRIGHT_HEADER}

/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with \`bun run build:css-assets\`.
 *
 * Embedded inputs for the native-free CSS compiler used inside the compiled
 * standalone binary, where neither node_modules nor a scannable working
 * directory exists. See scripts/build/generate-css-assets.ts (issue #19) and
 * scripts/lib/css-attribution.ts (issue #199).
 *
 * Candidate sets are stored newline-joined to keep this file small for
 * tooling, and split back into arrays at import time.
 */

/**
 * Classes every page needs whatever components it declares: the page shell,
 * the toast/dialog runtime, standalone forms, markdown pages, the synthesized
 * command palette, the pages the engine draws itself (home, not found, error),
 * and every class reached by no component type.
 */
export const CORE_CSS_CANDIDATES: readonly string[] = ${lines(attribution.core)}

/** Classes only the operator console authors; served to the console alone. */
export const CONSOLE_CSS_CANDIDATES: readonly string[] = ${lines(attribution.console)}

/**
 * Every other class, keyed by the exact set of component types whose renderer
 * or island reaches the file holding it. An app's stylesheet is CORE plus the
 * groups whose \`types\` intersect the types it declares.
 */
export const COMPONENT_CSS_GROUPS: ReadonlyArray<{
  readonly types: readonly string[]
  readonly classes: readonly string[]
}> = [
${groupsSource}
]

/** Every COMPONENT_REGISTRY key; a declared type outside this list carries no group. */
export const CSS_ATTRIBUTED_TYPES: readonly string[] = ${JSON.stringify(attribution.attributedTypes)}

/**
 * The sorted union of CORE, CONSOLE and every group: the whole built-in set.
 * Served to the operator console, to a config whose types cannot be read, and
 * as the test fleet's generic pre-compiled file; the reference for
 * \`appAddsCandidatesBeyondBuiltin\`.
 */
export const BUILTIN_CSS_CANDIDATES: readonly string[] = ${lines(builtin)}

/** Upstream \`@import 'tailwindcss'\` stylesheet (tailwindcss/index.css). */
export const TAILWIND_INDEX_CSS: string = ${JSON.stringify(tailwindIndexCss)}

/** Upstream \`@import 'tw-animate-css'\` stylesheet (tw-animate-css/dist/tw-animate.css). */
export const TW_ANIMATE_CSS: string = ${JSON.stringify(twAnimateCss)}

/** Upstream \`@import 'shadcn/tailwind.css'\` stylesheet (shadcn/dist/tailwind.css, the registry snapshot's pin). */
export const SHADCN_TAILWIND_CSS: string = ${JSON.stringify(shadcnTailwindCss)}
`

  writeFileSync(outPath, fileContent)

  const { stats } = attribution
  console.log(
    `generated-css-assets.ts — ${builtin.length} candidates kept of ${all.length} scanned ` +
      `(${stats.droppedCandidates} tokens produced no CSS under ${designs.length} designs); ` +
      `CORE ${attribution.core.length}, console-only ${attribution.console.length}, ` +
      `${attribution.groups.length} type groups over ${stats.typeReachedFiles} of ` +
      `${stats.presentationFiles} presentation files; ` +
      `${formatKb(tailwindIndexCss, twAnimateCss, shadcnTailwindCss)} embedded stylesheets`
  )
}

await main()
