/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The component-filter pipeline: everything that turns a DECLARED page's
 * component list into the list this caller is served.
 *
 * One ordered pass — capability gate, visibility, the two CRUD write gates,
 * `formRef` expansion, field specimens, table of contents, drawer dispatches,
 * command palette — and the order between them is load-bearing, which is why
 * the whole pipeline is one function in one file rather than a composition
 * spread across its callers.
 *
 * The gates themselves live next door (`page-access-gating.tsx`,
 * `page-crud-gating.tsx`); this module decides when each runs.
 */

import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { resolvePageQueryValues } from '@/domain/models/app/pages/query-props'
import { expandFormRefs } from '@/presentation/render/forms/form-ref-resolver'
import { resolvePageLanguage } from '@/presentation/render/page/page-lang-resolver'
import { expandFieldSpecimens } from '@/presentation/render/resolve/field-specimen-resolver'
import { resolveOpenDrawerDispatches } from '@/presentation/render/resolve/open-drawer-dispatch-resolver'
import { resolveRuntimeCapabilities } from '@/presentation/render/resolve/runtime-capability-resolver'
import { resolvePageToc } from '@/presentation/render/resolve/toc-resolver'
import {
  applyCallerCapabilityGate,
  applyVisibilityToComponents,
} from '@/presentation/render/resolve/visibility-filter'
import { stripAuthActionsIfUnconfigured, stripUnconfiguredOAuthForms } from './page-access-gating'
import { applyCrudCreatePermissions, applyCrudUpdatePermissions } from './page-crud-gating'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'

/**
 * Applies all component filters to a page: auth stripping, OAuth filtering,
 * visibility rules, CRUD create/update permission checks, and `formRef`
 * expansion (turning page-form components into pre-rendered embedded forms
 * via `expandFormRefs` from `forms/form-ref-resolver.ts`).
 *
 * `parentRecord` (Y-5) is forwarded to `expandFormRefs` so embedded forms
 * can resolve `inlinePrefill` tokens like `$parent.id` against the host
 * page's `dataSource: { mode: 'single' }` record.
 *
 * A render-time-only `command-palette` component is appended to every page so
 * the global `Cmd+K` palette is available app-wide without schema authoring.
 *
 * The synthesized component carries the app's navigable pages (static pages
 * only — record-detail templates with a `:param` segment are excluded) in its
 * `props.pages` so the palette runtime can offer "Go to <page>" quick actions
 * without an extra API call. Tables reach the renderer separately via the
 * component-dispatch `tables` config.
 */
const buildCommandPaletteComponent = (app: App): Component => {
  // Resolve `$t:` tokens in page titles.
  const navigablePages = (app.pages ?? [])
    .filter((page) => typeof page.path === 'string' && !page.path.includes(':'))
    .map((page) => ({
      name: page.name,
      path: page.path,
      title: resolveTranslationPattern(
        page.meta?.title && page.meta.title.length > 0 ? page.meta.title : page.name,
        app.languages?.default ?? 'en',
        app.languages
      ),
    }))
  return { type: 'command-palette', props: { pages: navigablePages } } as unknown as Component
}

/**
 * True when the page already carries a `command-palette` of its own, at any
 * depth.
 *
 * Authoring one is the third palette state — after "appended by the engine" and
 * "switched off app-wide" — and it SUPPRESSES the append. Two palettes bound to
 * one ⌘K open two overlays on one keystroke, so this is a defect the append
 * must not create rather than a composition.
 */
const hasAuthoredPalette = (items: ReadonlyArray<Component | string> | undefined): boolean => {
  if (items === undefined) return false
  return items.some((item) => {
    if (typeof item === 'string') return false
    if ('component' in item || '$ref' in item) return false
    if ((item as { readonly type?: string }).type === 'command-palette') return true
    const { children } = item as { readonly children?: ReadonlyArray<Component | string> }
    return hasAuthoredPalette(children)
  })
}

/**
 * Give an authored built-in palette the app's navigable pages.
 *
 * The built-in mode's "Go to <page>" quick actions come from `props.pages`,
 * which only the app knows — so an authored palette declaring no `search` would
 * otherwise offer an empty list purely for having been placed by hand. A
 * search-mode palette is left alone: it has no page list, by design.
 */
const withNavigablePages = (
  items: ReadonlyArray<Component | string>,
  synthesized: Component
): ReadonlyArray<Component | string> =>
  items.map((item) => {
    if (typeof item === 'string') return item
    if ('component' in item || '$ref' in item) return item
    const node = item as Component & {
      readonly search?: unknown
      readonly props?: Record<string, unknown>
      readonly children?: ReadonlyArray<Component | string>
    }
    if (node.type === 'command-palette') {
      if (node.search !== undefined) return item
      const injected = (synthesized as { readonly props?: Record<string, unknown> }).props ?? {}
      return { ...node, props: { ...injected, ...(node.props ?? {}) } } as unknown as Component
    }
    if (node.children === undefined) return item
    return {
      ...node,
      children: withNavigablePages(node.children, synthesized),
    } as unknown as Component
  })

/**
 * Inputs to {@link applyPageComponentFilters}. An options object rather than a
 * positional list: the pipeline has accumulated a per-request locale (P9), a
 * request query (GAP-3) and a URL-prefix locale ([internal ref]..039), and a
 * seventh positional argument is a call site nobody can read.
 */
interface PageComponentFilterInput {
  readonly rawPage: Page
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly parentRecord: Readonly<Record<string, unknown>> | undefined
  readonly detectedLanguage?: string
  readonly requestQuery?: Readonly<Record<string, string>>
  readonly urlLanguage?: string
  /**
   * R2b: the app whose DECLARATIONS `visibility.declares` / `unlessDeclares`
   * are read from. A mounted console renders its own preset pages, but "does
   * this instance automate?" is a fact only the OPERATOR's config answers.
   * Absent for a standalone app, where the two are the same object.
   */
  readonly hostApp?: App
  /**
   * P10/mount: the caller's resolved powers, when the route layer knows them
   * and the renderer does not. A mounted console renders session-less by
   * design, so `visibility.capability` and an action column's `capability`
   * would otherwise be inert there — see `holdsCapability` in
   * `visibility-filter.ts` for why the POWERS travel and the session does not.
   */
  readonly callerCapabilities?: readonly CallerCapability[]
}

export function applyPageComponentFilters(input: PageComponentFilterInput): Page {
  const { rawPage, app, session, parentRecord, detectedLanguage, requestQuery, urlLanguage } = input
  const authStripped = stripAuthActionsIfUnconfigured(rawPage.components, !!app.auth)
  const oauthFiltered = stripUnconfiguredOAuthForms(authStripped, app)
  // P10: the CALLER-power gate runs before the three session gates below and
  // EXCLUDES rather than hiding — a CSS-hidden action column would still ship
  // every row action's endpoint to a caller forbidden to call it (S1/S4).
  // Running it first is what makes the composition an AND: a component whose
  // capability is met still faces `when` / `roles` / `condition` unchanged.
  //
  // R2b rides the same pass: `declares` / `unlessDeclares` ask what the HOST
  // declares rather than what the caller may do, and they need the same
  // exclusion — shipping both halves of an alternating body and hiding one
  // tells a reader-of-source the instance has a capability it does not have.
  //
  // The URL-STATE gate rides it too, for the third time the same two properties
  // are wanted at once: `visibility.query` must EXCLUDE (both halves of an
  // alternating body in the bytes is a lie to everything that reads HTML) and
  // must RECURSE (the gated body is a block inside the panel that frames it).
  // The values are clamped here rather than in the gate so a predicate can only
  // ever be compared against a member of the declared `enum`.
  //
  // R7: `runtime` / `unlessRuntime` ride it for the fourth time, and are the
  // one gate whose answer the renderer cannot compute for itself — the env half
  // is a fact about the DEPLOYMENT. It is resolved HERE, once per request,
  // rather than inside the gate: `isAiProviderConfigured` takes its snapshot as
  // an argument so it stays trivially testable, and `appRequiresAi` walks the
  // whole component tree, a cost that belongs to the request rather than to
  // every node of the gate's recursion. The app half reads `hostApp`, never the
  // preset — a mounted console asking its own preset whether the operator
  // declares AI would answer about the console.
  const hostApp = input.hostApp ?? app
  const capabilityGated = applyCallerCapabilityGate(oauthFiltered, {
    session,
    app,
    hostApp,
    runtimeCapabilities: resolveRuntimeCapabilities(hostApp, process.env),
    queryValues: resolvePageQueryValues(rawPage.query, requestQuery),
    ...(input.callerCapabilities !== undefined
      ? { grantedCapabilities: input.callerCapabilities }
      : {}),
  })
  const visibilityFiltered = applyVisibilityToComponents(capabilityGated, session)
  const createPermFiltered = applyCrudCreatePermissions(visibilityFiltered, app.tables, session)
  const updatePermFiltered = applyCrudUpdatePermissions(createPermFiltered, app.tables, session)
  // P9: resolve the host page's active language the SAME way the page's own
  // `$t:` components resolve (URL prefix > page.meta.lang > detectedLanguage >
  // default) so an embedded `formRef` localizes its `$t:` title/label/onSuccess
  // to match the rest of the page rather than always the default locale.
  const activeLang = resolvePageLanguage(rawPage, app.languages, detectedLanguage, urlLanguage).lang
  const expanded = expandFormRefs(updatePermFiltered, app, {
    ...(parentRecord !== undefined ? { parentRecord } : {}),
    session,
    activeLang,
    // GAP-3 / [internal ref]: host request query for embedded `$query` prefill.
    ...(requestQuery !== undefined ? { query: requestQuery } : {}),
  })
  // The design-system catalog's field-type specimens: render-time-only
  // descriptors the admin surface builder emits, expanded into the control the
  // crud form draws for that field type. Runs AFTER `expandFormRefs` (a
  // specimen is never inside an embedded form, but the walk is cheap and the
  // ordering keeps every synthesizer in one contiguous block) and BEFORE
  // `resolvePageToc`, which must see final markup. Recurses into `children` —
  // catalog specimens sit four levels deep, unlike a top-level `formRef`.
  //
  // `true` DEFERS a specimen whose `fieldType` is a `$record.` reference: the
  // rows it names are read later, in `expandSystemRowTemplates`, and expanding
  // it here would draw a generic control for the literal string `$record.type`.
  // `applyRowScopedPasses` finishes those, once per expanded row.
  const specimensExpanded = expandFieldSpecimens(expanded, true)
  // P-06: assign anchor ids to heading components and plumb them onto any
  // `type: 'toc'` components on the page. Runs AFTER expandFormRefs so
  // collection-resolved + formRef-expanded headings are visible, BEFORE the
  // synthesized `command-palette` is appended (the palette is a sibling
  // overlay and never contains author headings).
  const withToc = resolvePageToc(specimensExpanded)
  // PG-04: tag any drawer referenced by a sibling `onRowClick.action ===
  // 'openDrawer'` with `_openDrawerDispatchedById` so its island starts
  // closed (defaultOpen=false). The data-table row-click handler dispatches
  // a `sovrium:open-drawer` CustomEvent to open the matching drawer.
  const withDrawerDispatches = resolveOpenDrawerDispatches(withToc ?? [])
  // The platform Cmd+K command palette is appended to every page by default.
  // An app may opt out via `palette: { enabled: false }` — e.g. when it
  // ships its own search overlay also bound to Cmd+K, so both would otherwise
  // open on the same keystroke. When opted out, the synthesized component is
  // omitted entirely (and with it the palette's global keybinding).
  if (app.palette?.enabled === false) {
    return { ...rawPage, components: withDrawerDispatches }
  }
  // A page that AUTHORS a palette carries exactly the one it declared. The
  // engine appends nothing on top — see `hasAuthoredPalette`.
  const synthesized = buildCommandPaletteComponent(app)
  if (hasAuthoredPalette(withDrawerDispatches)) {
    return {
      ...rawPage,
      components: withNavigablePages(withDrawerDispatches, synthesized) as Page['components'],
    }
  }
  return {
    ...rawPage,
    components: [...withDrawerDispatches, synthesized],
  }
}
