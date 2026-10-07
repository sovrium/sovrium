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

import { resolvePageQueryValues } from '@/domain/models/app/pages/query-props'
import {
  repeatedFormNames,
  type FormRefOptionSets,
} from '@/presentation/render/forms/form-ref-option-sources'
import {
  expandFormRefs,
  type FormRefExpansionContext,
} from '@/presentation/render/forms/form-ref-resolver'
import { resolvePageLanguage } from '@/presentation/render/page/page-lang-resolver'
import { markDrawerFieldAccess } from '@/presentation/render/props/resolve-record-drawer-access'
import { markRelatedGuestCaller } from '@/presentation/render/props/resolve-record-drawer-related'
import { expandFieldSpecimens } from '@/presentation/render/resolve/field-specimen-resolver'
import { resolveOpenDrawerDispatches } from '@/presentation/render/resolve/open-drawer-dispatch-resolver'
import { markAddressedDialogs } from '@/presentation/render/resolve/overlay-triggers'
import { resolveRuntimeCapabilities } from '@/presentation/render/resolve/runtime-capability-resolver'
import { resolvePageToc } from '@/presentation/render/resolve/toc-resolver'
import {
  applyCallerCapabilityGate,
  applyOverlayTriggerGate,
  applyVisibilityToComponents,
} from '@/presentation/render/resolve/visibility-filter'
import {
  markPasskeyAutofill,
  stripAuthActionsIfUnconfigured,
  stripUnconfiguredOAuthForms,
} from './page-access-gating'
import {
  buildCommandPaletteComponent,
  hasAuthoredPalette,
  withNavigablePages,
} from './page-command-palette'
import {
  applyCrudCreatePermissions,
  applyCrudUpdatePermissions,
  withholdUnofferedFormRefs,
} from './page-crud-gating'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'
import type { FormRefReaders } from '@/presentation/render/forms/form-ref-readers'

/**
 * Inputs to {@link applyPageComponentFilters}. An options object rather than a
 * positional list: the pipeline has accumulated a per-request locale (P9), a
 * request query and a URL-prefix locale, and a
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
  /** The table-backed choices of each embedded form, read before this pass. */
  readonly formOptions?: FormRefOptionSets
  /** The table each embedded form writes to, as this reader may see it. */
  readonly formReaders?: FormRefReaders
  /**
   * The tree {@link gatePageComponents} already produced for this request,
   * when the caller needed it first; computed here when absent.
   */
  readonly gatedComponents?: Page['components']
}

/**
 * What an embedded `formRef` needs from the host request, with every absent
 * input left out rather than set to `undefined`.
 */
function formRefContext(
  input: PageComponentFilterInput,
  activeLang: string,
  components: Page['components']
): FormRefExpansionContext {
  const { parentRecord, requestQuery, formOptions, formReaders, session } = input
  return {
    ...(parentRecord !== undefined ? { parentRecord } : {}),
    session,
    activeLang,
    repeatedForms: repeatedFormNames(components, session, input.app),
    // [internal ref] / a forms spec: host request query for embedded `$query` prefill.
    ...(requestQuery !== undefined ? { query: requestQuery } : {}),
    ...(formOptions !== undefined ? { formOptions } : {}),
    ...(formReaders !== undefined ? { formReaders } : {}),
  }
}

/**
 * The ACCESS half of {@link applyPageComponentFilters}: every gate that
 * removes a component this viewer may not have — auth-unconfigured actions,
 * caller powers, `when` / `roles` / `condition`, the overlays those left with
 * no trigger, and the CRUD create/update permissions.
 *
 * Exported because a read that must happen BEFORE the synchronous filter pass
 * (the choices of an embedded form, `resolveFormRefOptionSets`) has to walk
 * the tree this viewer will actually receive: a form inside a dialog whose
 * only trigger is gated away must not cost — or reveal to a log — a read of
 * its choices.
 */
export function gatePageComponents(
  input: Omit<PageComponentFilterInput, 'formOptions' | 'formReaders' | 'gatedComponents'>
): Page['components'] {
  const { rawPage, app, session, requestQuery } = input
  const authStripped = stripAuthActionsIfUnconfigured(rawPage.components, !!app.auth)
  const oauthFiltered = markPasskeyAutofill(stripUnconfiguredOAuthForms(authStripped, app), app)
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
  // an argument so it stays trivially testable. The resolver is handed
  // `hostApp`, never the preset — a mounted console must answer about the
  // operator's app, not about itself.
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
  // An overlay goes with the triggers that open it: when the two gates above
  // left this viewer none of them, the dialog/drawer they addressed is removed
  // too, rather than shipped (and, for a dialog with no trigger to wait on,
  // shown open).
  //
  // Every dialog a trigger in the page config names is then marked as having
  // an opener, so it mounts closed and waits for it — even when that trigger is
  // not drawn yet (an unopened tab panel, another view of the page).
  const visibilityFiltered = markAddressedDialogs(
    oauthFiltered,
    applyOverlayTriggerGate(
      oauthFiltered,
      applyVisibilityToComponents(capabilityGated, session, app)
    )
  )
  const createPermFiltered = withholdUnofferedFormRefs(
    applyCrudCreatePermissions(visibilityFiltered, app.tables, session),
    app,
    session
  )
  return applyCrudUpdatePermissions(createPermFiltered, app.tables, session)
}

export function applyPageComponentFilters(input: PageComponentFilterInput): Page {
  const { rawPage, app, session, detectedLanguage, urlLanguage } = input
  const updatePermFiltered = input.gatedComponents ?? gatePageComponents(input)
  // P9: resolve the host page's active language the SAME way the page's own
  // `$t:` components resolve (URL prefix > page.meta.lang > detectedLanguage >
  // default) so an embedded `formRef` localizes its `$t:` title/label/onSuccess
  // to match the rest of the page rather than always the default locale.
  const activeLang = resolvePageLanguage(rawPage, app.languages, detectedLanguage, urlLanguage).lang
  const expanded = expandFormRefs(
    updatePermFiltered,
    app,
    formRefContext(input, activeLang, updatePermFiltered)
  )
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
  // A drawer's `related` sections must answer an anonymous caller the way the
  // records API does, and only this pass knows whether the app has auth — see
  // `RELATED_GUEST_CALLER_KEY`.
  // Likewise its fields: what the reader may read and write needs the whole
  // `app`, which the drawer's renderer does not hold.
  const withDrawerDispatches = markDrawerFieldAccess(
    markRelatedGuestCaller(
      resolveOpenDrawerDispatches(withToc ?? []),
      app.auth !== undefined && session === undefined
    ),
    app,
    session
  )
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
  const synthesized = buildCommandPaletteComponent(app, session)
  if (hasAuthoredPalette(withDrawerDispatches)) {
    return {
      ...rawPage,
      components: withNavigablePages(
        withDrawerDispatches,
        synthesized,
        app,
        session
      ) as Page['components'],
    }
  }
  return {
    ...rawPage,
    components: [...withDrawerDispatches, synthesized],
  }
}
