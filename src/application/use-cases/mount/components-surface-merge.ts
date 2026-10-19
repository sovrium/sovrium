/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  componentSampleVars,
  withSampleVars,
} from '@/domain/models/app/pages/component-sample-service'
import type { App } from '@/domain/models/app'

/**
 * What the design-system Components surface borrows from the operator's app —
 * its reusable templates and the strings they read — merged into the console
 * app by `synthesiseMountSurface` (`embedded-app-mount.ts`) on that surface only.
 */

/**
 * Whether this path is one the design-system **Components** surface serves.
 *
 * ─── ON THE PATH, AND NOT ON A PARSER'S ANSWER ─────────────────────────────
 *
 * The predicate this replaces asked `parseDesignSystemConsoleRoute(path) ===
 * 'components'`. That parser answers `undefined` for any slug the PRESET serves
 * — the set exists so a flipped page stops being claimed — so the moment
 * Components became config the old gate went permanently false, silently, and
 * the page it exists for would have drawn its `$t:` keys as body text with
 * nothing failing anywhere near the cause.
 *
 * Two shapes, because the surface is two routes: the index, and the sub-route a
 * bookmarkable expanded card lives at. Written out rather than derived from a
 * parser for the reason above — the answer must not depend on who serves the
 * page.
 */
const isComponentsSurfacePath = (mountPath: string): boolean => {
  const segments = mountPath.split('/').filter((segment) => segment.length > 0)
  const [root, page] = segments
  if (root !== 'design-system' || page !== 'components') return false
  // `/design-system/components` and `/design-system/components/:name`, and
  // nothing deeper: a fourth segment names no card and is about to 404.
  return segments.length === 2 || segments.length === 3
}

/**
 * The operator's own reusable templates, on the ONE surface that draws them.
 *
 * ─── WHY A CONFIG PAGE CANNOT SUPPLY THESE ITSELF ──────────────────────────
 *
 * `renderComponentReference` resolves `{ component: name }` against the
 * RENDERING app's `components`, and under a mount that is the console's, which
 * declares none. So a Components page listing the operator's templates draws
 * `Component not found: "site-header" / Available components: none` on the
 * surface whose entire purpose is to show them. The page can name a template; it
 * cannot put one into the app that renders it.
 *
 * This is the sibling of {@link routeBoundOperatorTables} and the second use of
 * the same deliberate seam: the mount is the one place that holds both apps.
 *
 * ─── CONSOLE DEFINITIONS FIRST, AND THAT ORDER IS THE INVARIANT ────────────
 *
 * `renderComponentReference` takes the FIRST match, so the console's own
 * definitions are spread ahead of the operator's at the call site. An operator
 * who names a component after a piece of Sovrium's chrome must not be able to
 * shadow it — the console would then render the operator's template as its own
 * furniture, on a page the operator controls the content of.
 *
 * CONFIG, not data, in the same class as the `design` tokens: a template is a
 * composition the author wrote. `tables`, `env` and `auth` stay behind, so
 * [internal ref] A2's confidentiality bound is untouched.
 */
export const routeBoundOperatorComponents = (
  operatorApp: App,
  mountPath: string
): NonNullable<App['components']> =>
  isComponentsSurfacePath(mountPath)
    ? // Each drawn on its SAMPLE vars (`componentSampleVars`): this surface is
      // the only one that draws a template on its own, with no page handing it
      // `vars`, and an unfilled one printed `$label` where a card belonged.
      (operatorApp.components ?? []).map((template) =>
        withSampleVars(template, componentSampleVars(operatorApp, template.name))
      )
    : []

/** One language table, as `LanguagesSchema` shapes it: key → string. */
type TranslationTable = Readonly<Record<string, unknown>>

/**
 * The operator's string tables, merged UNDER the console's, on the Components
 * surface only.
 *
 * A real reusable template takes its text from `$t:` lookups, and
 * `resolveTranslation` returns the BARE KEY when it finds no table — so the page
 * drawing those templates printed `nav.services` and `apps.crm.name` as literal
 * body text. Merging the templates without their strings only moves the defect
 * one level in.
 *
 * ─── THE CONSOLE'S OWN TABLE IS NOT REPLACED, AND THAT IS NEW HERE ─────────
 *
 * The builder this moved from could simply overwrite `translations`, because the
 * declaration it started from carried none. The PRESET carries its whole chrome
 * vocabulary there — every sidebar label, every heading, every empty state — so
 * an overwrite would blank the console's own strings and print their keys.
 * Per-code, the console's entries are spread LAST so they win a key collision:
 * the same invariant the component merge keeps by spreading first, said for a
 * map rather than an array. An operator must not be able to repaint Sovrium's
 * furniture by declaring a key the console already uses.
 *
 * ─── WHAT IS DELIBERATELY NOT MERGED ───────────────────────────────────────
 *
 * `default`, `supported` and `detectBrowser` stay the console's, and only tables
 * keyed by a code the console SUPPORTS are taken — read off its own `supported`
 * list rather than hardcoded, so the filter cannot drift from it. A French
 * operator's `fr` table is left behind. That filter also keeps `LanguagesSchema`'s
 * own invariant (`translations` ⊆ `supported`) true of an object that is never
 * re-decoded and so has nothing else to hold it honest.
 *
 * `undefined` — merge nothing — for every other path, for an operator with no
 * `languages`, and for one whose tables share no code with the console. No
 * throw, nothing repainted.
 */
const declaredTables = (app: App): Readonly<Record<string, TranslationTable>> | undefined => {
  const declared = app.languages?.translations
  return typeof declared !== 'object' || declared === null || Array.isArray(declared)
    ? undefined
    : (declared as Readonly<Record<string, TranslationTable>>)
}

export const consoleLanguagesForPath = (
  operatorApp: App,
  scopedApp: App,
  mountPath: string
): App['languages'] | undefined => {
  if (!isComponentsSurfacePath(mountPath)) return undefined
  const declared = declaredTables(operatorApp)
  if (declared === undefined) return undefined

  const consoleLanguages = scopedApp.languages
  const admitted = new Set((consoleLanguages?.supported ?? []).map((language) => language.code))
  const consoleTables = declaredTables(scopedApp) ?? {}
  const borrowed = Object.entries(declared).filter(([code]) => admitted.has(code))
  if (borrowed.length === 0) return undefined

  const translations = Object.fromEntries(
    borrowed.map(([code, table]) => [code, { ...table, ...(consoleTables[code] ?? {}) }] as const)
  )
  return {
    ...consoleLanguages,
    translations: { ...consoleTables, ...translations },
  } as App['languages']
}
