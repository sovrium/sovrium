/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolving a page's ROWS, and the passes that are scoped to them.
 *
 * `resolveAndFilterPage` is the ordered pipeline: the host record, the
 * component filters, the page-scoped specimen pass, the option sources, the row
 * expansion, then the row-scoped second passes and the data sources. The order
 * is the content — a specimen resolved before its row exists draws a control
 * for the literal string `$record.type` — so the pipeline and the passes it
 * sequences live together.
 *
 * `definedOnly` lives here rather than in a helpers module because its two
 * heaviest callers are this pipeline and the collection resolver that wraps it;
 * exporting it from the wrapper instead would point the dependency backwards.
 */

import { resolveComponentTranslationTokens } from '@/presentation/render/i18n/translation-handler'
import { foldCodeContentFrom } from '@/presentation/render/resolve/code-content-fold-resolver'
import { resolveCustomHtmlSources } from '@/presentation/render/resolve/custom-html-resolver'
import { resolvePageDataSources } from '@/presentation/render/resolve/data-source-resolver'
import { expandFieldSpecimens } from '@/presentation/render/resolve/field-specimen-resolver'
import { resolveGraphs } from '@/presentation/render/resolve/graph-resolver'
import { resolveMatrixGraphs } from '@/presentation/render/resolve/matrix-graph-resolver'
import { resolvePageParentRecord } from '@/presentation/render/resolve/page-parent-resolver'
import {
  applyPageLevelRecordBinding,
  type SystemRecordFetcher,
} from '@/presentation/render/resolve/page-system-record-binding'
import { resolveSelectOptionSources } from '@/presentation/render/resolve/select-option-source-resolver'
import {
  indexTemplatesByName,
  resolveSpecimenSubjects,
  type SpecimenSubjectResolution,
  type SpecimenTemplates,
} from '@/presentation/render/resolve/specimen-subject-resolver'
import { expandSystemRowTemplates } from '@/presentation/render/resolve/system-rows-template-resolver'
import { applyPageComponentFilters } from './page-component-filters'
import { resolvePageLanguage } from './page-lang-resolver'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'
import type { SystemRowsFetcher } from '@/presentation/render/resolve/first-object-redirect-resolver'

/**
 * Drop every `undefined`-valued key from an options bag.
 *
 * `exactOptionalPropertyTypes` refuses an explicit `undefined` where a property
 * is optional, so every optional argument otherwise needs its own
 * `...(x !== undefined ? { x } : {})` spread at the call site. One helper keeps
 * that mechanical shape out of a function whose complexity budget is spent on
 * real decisions.
 */
export function definedOnly<T extends Record<string, unknown>>(bag: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(bag).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

/**
 * Everything {@link resolveAndFilterPage} needs about the request.
 *
 * A NAMED interface rather than an inline parameter type, matching
 * {@link PageComponentFilterInput} next door: the inline form counts against
 * the function's own line budget, so documenting one more optional member was
 * a lint failure in a function whose body had not changed.
 */
interface ResolveAndFilterInput {
  readonly rawPage: Page
  readonly app: App
  readonly routeParams: Readonly<Record<string, string>>
  readonly session: SessionInfo | undefined
  readonly cookies: Readonly<Record<string, string>> | undefined
  readonly db: DataSourceDb
  /**
   * The host record of a collection page (already resolved by
   * `resolveCollectionPage`). Used as the `parentRecord` for an embedded
   * `formRef`'s `inlinePrefill` resolution when the page has no
   * `dataSource: single`.
   */
  readonly collectionRecord?: Readonly<Record<string, unknown>>
  /**
   * P9: the host page's active language (the `/:lang/` URL prefix →
   * `detectedLanguage`). Threaded into `applyPageComponentFilters` so an
   * embedded `formRef` resolves its `$t:` strings against the same locale as
   * the rest of the page.
   */
  readonly detectedLanguage?: string
  /**
   * GAP-3 / [internal ref]: the host page's request query string, threaded into
   * `applyPageComponentFilters` so an embedded `formRef`'s `$query` prefill
   * resolves against the host page URL.
   */
  readonly requestQuery?: Readonly<Record<string, string>>
  /** [internal ref]..039: the `/:lang/` URL-prefix locale, when present. */
  readonly urlLanguage?: string
  /**
   * P9: server-side reader for a SYSTEM-backed select option source, borrowing
   * the caller's credentials. Absent, such a source resolves to no options.
   */
  readonly fetchSystemRows?: SystemRowsFetcher
  /**
   * [internal ref]: server-side reader for a page-level `{ system }` record binding,
   * borrowing the caller's credentials. Absent, the binding falls back to the
   * client-side enhancer marker instead of 404ing a render that has no caller.
   */
  readonly fetchSystemRecord?: SystemRecordFetcher
  /**
   * R2b: the app whose declarations gate a component. A mount's OPERATOR app;
   * absent for a standalone app, where it is `app`.
   */
  readonly hostApp?: App
  /**
   * P10/mount: the caller's resolved powers. A mounted console renders
   * session-less, so without this the capability gates are inert there — see
   * `holdsCapability` (`visibility-filter.ts`).
   */
  readonly callerCapabilities?: readonly CallerCapability[]
}

/**
 * Resolve every named specimen subject, under whichever authority decides
 * whether a routed subject's URL is real: the specimen, or the page.
 *
 * With no `page.params`, the specimen is the only authority — a subject naming a
 * type it cannot draw has no page to show, so the route 404s (`-014`). Once the
 * page declares which segments it serves, THAT statement outranks any one
 * component: the URL is one of this page's own whatever a single specimen can
 * draw, so the refusal is reported in place and the page answers 200 (`-023`).
 * Otherwise adding a specimen to a page would silently narrow the URLs the page
 * serves, and a kit documenting EVERY catalogued type — including the ones the
 * catalogue refuses to draw — could not be a config page at all.
 *
 * `templates` is what a `subject.component` resolves against — the RENDERING
 * app's own `components[]`. Under the admin mount that list is the console's
 * followed by the operator's, so a documented template resolves and cannot
 * shadow a piece of Sovrium's chrome.
 */
const resolveNamedSubjects = (
  filteredPage: Page,
  rawPage: Page,
  routeParams: Readonly<Record<string, string>>,
  templates: SpecimenTemplates
): SpecimenSubjectResolution =>
  resolveSpecimenSubjects(
    filteredPage.components,
    routeParams,
    rawPage.params === undefined ? 'route' : 'vouched',
    templates
  )

/**
 * The specimen pass and the page it produces, or the 404 a named subject forces.
 *
 * Extracted so `resolveAndFilterPage` stays inside its line cap: the template
 * index, the resolution and the rebuilt page are one step with one outcome, and
 * splitting them across the caller only spreads that step over its neighbours.
 */
const applySpecimenSubjects = (
  filteredPage: Page,
  rawPage: Page,
  routeParams: Readonly<Record<string, string>>,
  app: App
): { readonly page: Page; readonly templates: SpecimenTemplates } | undefined => {
  const templates = indexTemplatesByName(app.components)
  const resolution = resolveNamedSubjects(filteredPage, rawPage, routeParams, templates)
  return resolution.kind === 'not-found'
    ? undefined
    : { page: { ...filteredPage, components: resolution.components }, templates }
}

/**
 * The two passes that run over EXPANDED rows, after `expandSystemRowTemplates`
 * and before `resolvePageDataSources`.
 *
 * They are one helper because they share that window exactly, and because the
 * caller is at its statement cap — not because either depends on the other.
 *
 *  - The SECOND subject pass. A `$record.` subject had no record when the first
 *    pass ran — the rows had not expanded yet — so it was left alone there and
 *    is resolved here, once per expanded row, against the value its OWN row
 *    supplied. `row` mode is what makes an undrawable one report itself in
 *    place rather than 404 the page: a URL segment is one fact about one
 *    request, but a row is one of many, and blanking an index because its
 *    eleventh row is undrawable loses the ten that were fine.
 *  - The SECOND field-specimen pass, which is the same story one vocabulary
 *    over. A `field-specimen` whose `fieldType` is `$record.<field>` names a
 *    column of the row it is expanded from, so the page-scoped pass deferred it
 *    (`expandFieldSpecimens(..., true)`); here the rows exist and each one draws
 *    its own control. It runs BEFORE `resolvePageDataSources` for the same
 *    reason the subject pass does — the markup it mints must be final by the
 *    time anything reads `content`.
 * - [internal ref]'s `code.contentFrom` fold, which turns a system endpoint's rows
 *    into ONE code block's content. It runs after the row expansion (a
 *    `contentFrom` nested inside a row template is refused at DECODE, so
 *    nothing here was minted by that pass) and strictly BEFORE
 *    `resolvePageCodeHighlights`, which reads `component.content` alone — a
 *    fold running later would ship an unattributed, uncopyable block, the exact
 *    failure a children-based workaround already has.
 *  - The `matrix` GRAPH read, which shares that window for the same two reasons
 *    the fold does and for one of its own. It runs AFTER the filters, so a
 *    matrix a visibility gate removed never spends its render-path read — a
 *    component that is not on the page must not fetch for the reader it was
 *    hidden from. It runs BEFORE `resolvePageDataSources` because it SPENDS the
 *    binding, exactly as `expandSystemRowTemplates` does: the walk below keys
 *    off `component.dataSource`, would find no `table`, and would answer a
 *    `{ system }` graph binding with a `table "undefined" not found` banner over
 *    the grid just drawn. It is the one pass here that reads the RECORD fetcher
 *    rather than the rows one, which is why this helper takes the whole input
 *    bag rather than a single fetcher: a graph is two arrays and neither is
 *    "the rows", so one envelope read answers where two rows reads could not.
 *  - The `graph` GRAPH read, immediately after it and for every one of those
 *    reasons unchanged — same envelope shape, same borrowed identity, same
 *    spent binding. It is a SEPARATE pass rather than a widening of the matrix
 *    one because the two components project the same body differently, and a
 *    shared walk would have to carry both projections to tell them apart.
 *
 *    The two are deliberately SEQUENTIAL rather than concurrent. Running them
 *    in parallel would buy nothing on the page that motivates both — the
 *    console's Organisation page draws a Map and a Matrix over one endpoint —
 *    because each resolver reads its own distinct-URL set and the endpoint
 *    derives the whole graph per call either way. Sequencing keeps the pass
 *    order readable and leaves the render path one thing at a time.
 */
/**
 * The `$t:` resolver the graph and matrix passes project THROUGH, or
 * `undefined` for a page whose app declares no dictionary.
 *
 * Built here rather than inside those resolvers so they stay ignorant of i18n,
 * and derived from `resolvePageLanguage` rather than from a second reading of
 * the same inputs: the active language is a precedence — URL prefix, then the
 * page's own `meta.lang`, then detection, then the default — and a page whose
 * caption resolved against one language while its heading resolved against
 * another is the exact defect a second copy of that chain produces.
 */
function componentLocalizerFor(
  page: Page,
  input: ResolveAndFilterInput
): ((component: Component) => Component) | undefined {
  const { languages } = input.app
  if (!languages?.translations) return undefined
  const { lang } = resolvePageLanguage(page, languages, input.detectedLanguage, input.urlLanguage)
  return (component) => resolveComponentTranslationTokens(component, lang, languages)
}

async function applyRowScopedPasses(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  input: ResolveAndFilterInput,
  templates: SpecimenTemplates
): Promise<Page> {
  const rowSubjects = resolveSpecimenSubjects(page.components, routeParams, 'row', templates)
  const withRowSubjects: Page =
    rowSubjects.kind === 'resolved' ? { ...page, components: rowSubjects.components } : page
  const withRowFields: Page = {
    ...withRowSubjects,
    components: expandFieldSpecimens(withRowSubjects.components),
  }
  const folded = await foldCodeContentFrom(withRowFields, input.fetchSystemRows)
  const localize = componentLocalizerFor(page, input)
  const withMatrices = await resolveMatrixGraphs(folded, input.fetchSystemRecord, localize)
  return resolveGraphs(withMatrices, input.fetchSystemRecord, localize)
}

/**
 * Resolve the host record (via Y-5 page-level dataSource) and apply all
 * component filters in one pass.
 *
 * Returns `undefined` when the requested host record is missing (the
 * caller 404s the page); returns `{ unauthorized: true }` when a
 * descendant component's `$currentUser` filter trips the auth guard;
 * returns the fully-resolved `Page` otherwise.
 *
 * Extracted from `renderPageByPath` so the entry function stays under the
 * cyclomatic-complexity cap. The two steps are intentionally fused
 * because the filter pipeline (`expandFormRefs` in particular) needs the
 * resolved parent record to expand `inlinePrefill` tokens before the
 * downstream `resolvePageDataSources` walk runs.
 */
export async function resolveAndFilterPage(
  input: ResolveAndFilterInput
): Promise<Page | { readonly unauthorized: true } | undefined> {
  const { rawPage, app, routeParams, session, cookies, db, collectionRecord } = input

  // Y-5: Resolve the page-level `dataSource: { mode: 'single' }` (if any)
  // before component filters run so `expandFormRefs` can resolve
  // `inlinePrefill` tokens like `$parent.id` against the host record. The
  // resolution is independent of `resolvePageDataSources` because that
  // function operates on per-component bindings, while inline-create
  // needs the host page's record visible to all descendant form-refs.
  const parentResolution = await resolvePageParentRecord(rawPage, routeParams, db)
  if (parentResolution.kind === 'not-found') return undefined

  // The single-mode dataSource record takes precedence; otherwise fall back
  // to the collection record so an embedded form’s `$record.*` tokens resolve.
  const hostRecord = parentResolution.kind === 'record' ? parentResolution.record : collectionRecord

  // CAP-2 + [internal ref]: distribute the page-level single record to descendant
  // `$record.*` — server-side for BOTH arms now. The DB `{ table, mode: single }`
  // binding uses the record resolved above; the `{ system }` detail binding is
  // read here through `fetchSystemRecord`, borrowing the CALLER's identity. A
  // system record this caller cannot read is the page's own 404, exactly as an
  // unresolvable DB row already is. Without a fetcher (a static build) the arm
  // falls back to the client-side `page-record-system` enhancer marker.
  const binding = await applyPageLevelRecordBinding(
    rawPage,
    routeParams,
    hostRecord,
    input.fetchSystemRecord
  )
  if (binding.kind === 'not-found') return undefined
  const boundPage = binding.page

  const filteredPage = applyPageComponentFilters({
    rawPage: boundPage,
    app,
    session,
    parentRecord: hostRecord,
    detectedLanguage: input.detectedLanguage,
    requestQuery: input.requestQuery,
    urlLanguage: input.urlLanguage,
    ...definedOnly({ hostApp: input.hostApp, callerCapabilities: input.callerCapabilities }),
  })

  // [internal ref]: a `specimen` that NAMES its subject
  // has that name replaced by the engine's own catalogue specimen for the type,
  // so from here down a named subject and a written-out one are ONE declaration
  // and every pass below treats them identically. A `$param` naming a segment
  // that is not a drawable type is the page's own 404 — an empty frame would
  // leave a reader believing the type has no specimen rather than no existence.
  // [internal ref] is the other polarity, chosen by
  // {@link resolveNamedSubjects}.
  const specimens = applySpecimenSubjects(filteredPage, rawPage, routeParams, app)
  if (specimens === undefined) return undefined

  // B2: resolve every `select` option-source binding into a concrete `options`
  // array BEFORE the rows-oriented walk below. The pass also REMOVES the
  // binding, which keeps `resolveComponent` — it keys off
  // `component.dataSource` — from sweeping a choice control into
  // `resolveByMode` and mangling it as a record-rendering component.
  const withSelectOptions = await resolveSelectOptionSources(specimens.page, {
    app,
    session,
    cookies,
    db,
    ...(input.fetchSystemRows !== undefined ? { fetchSystemRows: input.fetchSystemRows } : {}),
  })

  // R5: clone an ARBITRARY child template once per row of a SYSTEM read
  // endpoint, through the SAME `expandDataSourceChildren` the DB list path
  // uses — so `$record.*` substitution and per-row `visibility.record` are one
  // implementation across both row sources. Runs BEFORE `resolvePageDataSources`
  // because it SPENDS the binding: the pass below keys off `component.dataSource`
  // and would answer a `{ system }` one with a "table undefined not found"
  // banner over the rows just rendered.
  const withSystemRows = await expandSystemRowTemplates(withSelectOptions, input.fetchSystemRows)

  const rowScoped = await applyRowScopedPasses(
    withSystemRows,
    routeParams,
    input,
    specimens.templates
  )

  const resolved = await resolvePageDataSources(rowScoped, app, routeParams, {
    session,
    cookies,
    db,
  })
  if (resolved === undefined) return undefined
  if ('unauthorized' in resolved) return { unauthorized: true }
  return resolveCustomHtmlSources(resolved)
}
