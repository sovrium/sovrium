/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveAppVarValues, type AppVarName } from '@/domain/models/app/pages/app-vars'
import { resolvePageAppMark } from './app-mark-resolver'
import { judgeConditionsDeep, type AuthoredCondition } from './condition-judging'
import { substituteTemplatesDeep, type ValueEncoder } from './html-template-values'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/**
 * Every `$app.<name>` reference reachable in a page. A single STATIC literal —
 * the capture is what decides whether a match is substituted, so no regular
 * expression is ever built from input (`sovrium/no-dynamic-regexp`).
 *
 * The name grammar is deliberately WIDER than the closed set: matching
 * `$app.description` is what lets the substitution decide to leave it alone,
 * where a regex that only matched the four known names would have skipped it
 * silently and made "left verbatim" an accident rather than a decision.
 */
const APP_REFERENCE = /\$app\.([a-zA-Z][a-zA-Z0-9]*)/g

/**
 * Substitute the serving app's own facts into every `$app.<name>` reference on
 * the page.
 *
 * Runs BEFORE data-source resolution and before breadcrumb derivation, so a
 * token is usable anywhere a string is — component content, a prop, an `href`,
 * a breadcrumb's root label — rather than in the handful of places a renderer
 * happens to walk.
 *
 * The page's `meta` is NOT walked here: its title and description may name a
 * `$t:` key, translated only when the head is built, per language. The head
 * substitutes after that translation instead — see `head-references.ts`, which
 * reuses {@link substituteAppVars} so both reaches answer one closed set.
 *
 * A reference the app cannot answer is left VERBATIM: any name outside the
 * closed set, and `$app.origin` outside a request. A blank would be
 * indistinguishable from a formatting bug, and the surviving literal is how an
 * author notices.
 *
 * `$app.version` is the ONE name that always resolves — to the EMPTY STRING when
 * the app declares none. That is not an exception to the rule above so much as a
 * case where its premise fails: an absent version is a permanent, legal property
 * of a valid config, so a surviving literal would fire on CORRECT configs and
 * teach nobody anything. `resolveAppVarValues` carries the full argument,
 * including why it is deliberately not generalised to the other three.
 *
 * ─── WHY `basePath` IS FORWARDED RATHER THAN DEFAULTED HERE ────────────────
 *
 * `resolveAppVarValues` treats an ABSENT base as unanswerable and leaves the
 * token verbatim, so a caller that was never threaded the value cannot make a
 * MOUNTED page print a root-relative address — a well-formed path into the
 * operator's own app, which 404s, and is the failure mode that looks most like
 * success. This resolver keeps that contract and forwards what it was given.
 *
 * The `?? ''` that turns "not mounted" into the empty base belongs one frame up,
 * in `renderPageByPath`, because that is the first place absence has a MEANING:
 * every mount passes its base explicitly, so an absent one there is a standalone
 * app at the site root, whose base is `''` as an ANSWER rather than as a guess.
 *
 * ─── AND `engineVersion` IS FORWARDED THE SAME WAY, WITH NO DEFAULT ────────
 *
 * The engine always HAS a version, so an absent one here never means "correctly
 * undeclared" — it means this render was never handed one, which is a wiring
 * fault only a developer can fix. The surviving `$app.engineVersion` literal is
 * the loud signal that says so; blanking it would ship `(Sovrium v)` to an
 * operator, which reads as a product that forgot its own name.
 *
 * Pure, and a page carrying no reference is returned by reference.
 *
 * @param serving - the two facts about this render that neither the page nor
 *   the config carries: where the app is MOUNTED and which engine is running
 *   it. Grouped rather than passed loose because they share one rule — an
 *   absent member is unanswerable, never a default — and because `origin` above
 *   would otherwise be the only one of three siblings with its own parameter.
 */
export function resolvePageAppVars(
  page: Page,
  app: App,
  origin: string | undefined,
  serving?: {
    readonly basePath?: string
    readonly engineVersion?: string
    readonly path?: string
  }
): Page {
  const values = resolveAppVarValues(app, origin, serving)

  // `$app.path` is whatever address a visitor typed, decoded, and `$app.origin`
  // can come from a request header: an author HTML template
  // (`<p>Nothing at $app.path</p>`) takes them escaped, and a text template is
  // pinned to text when they would flip it — see `substituteTemplatesDeep`.
  const fill = (str: string, encode: ValueEncoder | undefined): string =>
    substituteAppVars(str, values, encode)
  // A `visibility.condition` on `$app.*` is judged BEFORE the substitution
  // below, while its field still names what it reads.
  const judged = (tree: unknown): unknown =>
    substituteTemplatesDeep(
      judgeConditionsDeep(tree, (condition) => appConditionHolds(condition, values)),
      fill
    )

  // The app's mark is the other fact about the serving app a page can ask for
  // (`data-app-mark`), filled from the same `app` — see `app-mark-resolver.ts`.
  return resolvePageAppMark(
    {
      ...page,
      ...(page.components !== undefined
        ? { components: judged(page.components) as Page['components'] }
        : {}),
      ...(page.layout !== undefined ? { layout: judged(page.layout) as Page['layout'] } : {}),
    },
    app
  )
}

/**
 * Whether a `visibility.condition` on `$app.<name>` holds for `values`;
 * `undefined` when the condition reads anything else. A name the app cannot
 * answer reads as empty — the same reading `$app.version` gets when no version
 * is declared — so `{ field: $app.version, operator: neq, value: '' }` keeps a
 * node only on an app that declares a version. An operator other than `eq` /
 * `neq`, or a boolean value, never holds: every `$app.*` value is text.
 */
export const appConditionHolds = (
  condition: AuthoredCondition,
  values: Readonly<Partial<Record<AppVarName, string>>>
): boolean | undefined => {
  if (!condition.field.startsWith('$app.')) return undefined
  if (typeof condition.value !== 'string') return false
  const actual = values[condition.field.slice('$app.'.length) as AppVarName] ?? ''
  if (condition.operator === 'eq') return actual === condition.value
  if (condition.operator === 'neq') return actual !== condition.value
  return false
}

/**
 * Replace every `$app.<name>` in one string with its value from `values`,
 * leaving a name the map cannot answer VERBATIM.
 *
 * The one substitution both readers share: the page-tree pass above, and the
 * document head (`head-references.ts`), whose `meta.title` / `meta.description`
 * are only known AFTER the late `$t:` translation and so cannot ride the tree
 * pass. `encode` is applied to each substituted value — `escapeHtml` for a raw
 * HTML template, nothing for text that React escapes on output.
 */
export const substituteAppVars = (
  str: string,
  values: Readonly<Partial<Record<AppVarName, string>>>,
  encode: (value: string) => string = (value) => value
): string =>
  str.includes('$app.')
    ? str.replaceAll(APP_REFERENCE, (match, name: string) => {
        const value = values[name as AppVarName]
        return value === undefined ? match : encode(value)
      })
    : str
