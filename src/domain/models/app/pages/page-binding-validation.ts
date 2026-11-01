/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { objectNodes, stringLeaves } from '@/domain/kernel/config-parsing/config-node-walk'
import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { extractParamNames } from '@/domain/kernel/matching/route-matcher'
import { actionPlacementViolations } from './action-placement-validation'
import { bottomBarViolations } from './bottom-bar-validation'
import {
  activeMarkerViolations,
  codeContentFromViolations,
  inlineSvgSourceViolations,
  repeatPlacementViolations,
  systemRowTemplateDepthViolations,
  systemRowTemplateViolations,
  visibilityPolarityViolations,
} from './component-rule-validation'
import { derivedColumnViolations } from './derived-columns-validation'
import { compactFileUploadViolations } from './file-upload-compact-validation'
import { openDialogTargetViolations } from './open-dialog-target-validation'
import {
  breadcrumbViolations,
  redirectToFirstViolations,
  sidebarGroupViolations,
} from './page-navigation-validation'
import { queryViolations } from './query-property-validation'
import { queryVisibilityViolations } from './query-visibility-validation'
import { readStateGateViolations } from './read-state-gate-validation'
import { recordReferenceViolations } from './record-reference-validation'
import { recordVisibilityViolations } from './record-visibility-validation'
import { routeParamAllowListViolations } from './route-param-allow-list-validation'
import { routeParamViolations, type RouteContext } from './route-param-binding-validation'
import {
  editSelectOptionViolations,
  formFieldOptionViolations,
} from './select-option-binding-validation'
import { sharedFilterChannelViolations } from './shared-filter-validation'
import { sidebarNavigationViolations } from './sidebar-nav-validation'
import { windowViolations } from './window-preset-validation'

/**
 * Cross-field decode rules for a single page — the ones that need more context
 * than the field schema they guard, and therefore cannot live on it.
 *
 * Eighteen families, each introduced with the client primitive it guards:
 *
 *  1. **Route-parameter bindings.** A ROWS-source `dataSource.system.param`, or
 *     a `$param.<name>` reference ANYWHERE in the page, names a segment of the
 *     host page's `path`. A name with no matching `:segment` cannot resolve to
 *     anything at request time — the endpoint would be requested with a literal
 *     `:group` in it, a filter would compare against `undefined`, an action URL
 *     would POST to a path containing `$param.table`. All fail SILENTLY at
 *     runtime and all are decidable offline, so they are decode errors naming
 *     the reference AND the path. A DETAIL-source `param` is deliberately NOT
 *     governed — see `ROWS_SOURCE_COMPONENT_TYPES` in
 *     `route-param-binding-validation.ts`.
 *
 *  2. **`redirectToFirst` needs a list.** "Redirect to the first object" is
 *     meaningless without a source that resolves a list of objects, so the page
 *     must declare one.
 *  3. **`breadcrumb` items XOR derive.** A breadcrumb either enumerates its
 *     trail or derives it from the path; declaring both leaves no defensible
 *     precedence, and `labels` (a per-segment relabel map) is inert without
 *     `derive`.
 *
 *  4. **Query properties.** A `default` outside its own `enum`, and a property
 *     name that is not a legal URL key.
 *
 *  5. **Sidebar groups.** A group with neither `items` nor `source` is a heading
 *     with nothing under it.
 *
 * 5b. **Sidebar landmarks, props and disclosures.** A `headingLevel` outside a
 *     `landmark` announces a name the landmark already carries; groups sharing a
 *     landmark that are not adjacent cannot be wrapped without reordering the
 *     author's navigation; two landmarks with one name are indistinguishable to
 *     the reader cycling them. A `props` bag setting `href`, a class or one of
 *     the ARIA attributes the renderer computes gives one attribute two owners.
 *     A disclosure lists authored children XOR fetched ones — only the fetched
 *     list has loading / error / empty states — and a toggle name without
 *     `{label}` is the same name on every disclosure in the sidebar. Every one is
 *     decidable from the sidebar node alone, and none can live on the schema for
 *     the wrapping reason below.
 *
 *  6. **`visibility.record` needs a record, and an operator.** The per-row gate
 *     is matched against the record a row was expanded from. A component with no
 *     record-binding ancestor is never expanded against one, so the predicate
 *     could never fire — and the component would render unconditionally, which is
 *     the OPPOSITE of what its author wrote. A predicate carrying only `field` is
 *     inert for the same reason from the other direction: `matchesConditionOperators`
 *     ANDs the operators it is given, so no operators means "matches everything"
 *     — a gate that renders everywhere, which is what its author wrote it to
 *     stop. (A MISSPELLED operator is a different defect with a different owner:
 *     the excess-property reporter refuses it by name on the boot path. A bare
 *     `Schema.decodeUnknownSync` would drop it and leave exactly the
 *     operator-less predicate this rule catches.) Both are decidable offline —
 *     the first from the component's ancestry, which is why neither can live on
 *     `VisibilitySchema`.
 *
 *  7. **Window presets.** A preset id that is not a span, a duplicated id, a
 *     `default` naming no preset, and a `window.param` shadowing a declared
 *     `query` property — one URL key cannot carry two independent allow-lists.
 *
 *  8. **Inline select editors.** An `editSelect` states its choices exactly
 *     once: a literal `options` array OR a resolved `optionsSource`.
 *
 *  9. **Derived data-table columns.** `columnsFrom` must have something to
 *     derive from (`derived-columns-validation.ts`).
 *
 * 10. **The current-item marker.** `activeWhen` and `activeProps` are useless
 *     apart, and a comparison between two literals answers the same on every
 *     render — so it is not a conditional, it is a typo with a default.
 *
 * 11. **Visibility polarity.** One component may not require the host app to
 *     declare a capability AND to not declare it: it could never render, which
 *     is the opposite of what its author wrote.
 *
 * 12. **Shared-filter channels.** Two publishers contributing the SAME param to
 *     the same channel overwrite each other on every emit with no defensible
 *     precedence; and a subscriber consuming a param no publisher on its channel
 *     contributes merges nothing, forever, in silence.
 *
 * 13. **System row templates are read-only.** A `{ system }` rows binding whose
 *     children are cloned per row may carry no live submit control, at any
 *     depth.
 *
 * 14. **`$record.<field>` needs a record.** The per-row substitution runs as
 *     each row is expanded from its template, so a reference with no
 *     record-binding ancestor is never handed a record — and reaches the browser
 *     as the LITERAL text `$record.name`. Same structural fact as family 6, and
 *     the same walk; the difference is only what is being looked for.
 *
 * 16. **`page.params` — a route segment constrained to a declared set.** The
 *     constrained parameter must be one the page's own `path` declares, and the
 *     three envelope keys that resolve against a page or a route cannot be used
 *     by the read that decides whether the route exists. Lives in its own module
 *     (`route-param-allow-list-validation.ts`); see the note there.
 *
 * 17. **`visibility.query` names a state the page can be in.** `page.query`
 *     CLAMPS an out-of-enum URL value to the property's `default`, so a gate
 *     comparing against a value the enum does not carry — or naming a property
 *     that is not declared at all — can never hold, and the component renders
 *     under no URL. Nothing observable distinguishes that from a rare state, so
 *     it is refused at decode. Own module
 *     (`query-visibility-validation.ts`).
 *
 * WHY 4 THROUGH 17 ARE HERE RATHER THAN ON THEIR OWN SCHEMAS. Each is a local
 * rule the schema it guards could express directly — but
 * a `Schema.check` WRAPS the node it guards, and the property walker in
 * `[internal ref]` names a node by the identifier on its
 * OUTERMOST node. A wrapped struct therefore stops being addressed by its own
 * name (checking `PageSchema` re-keyed `Page.components` to
 * `App.pages[].components` and left `#/$defs/Page` published but unreferenced),
 * which silently re-keys the published property universe the docs gate compares
 * against. Keeping every schema node annotate-only and collecting the rules here
 * leaves the emitted contract the shape it already had.
 *
 * Pure: no I/O, no schema import, no React. Returns human-readable violation
 * messages, empty when the page is well-formed. The caller (`PagesSchema`'s
 * `Schema.check`) surfaces the first one as the decode error. Family 18 (what
 * an action's response slots may ask for, by where it sits) is its own module.
 */
export function collectPageBindingViolations(page: unknown): readonly string[] {
  if (!isRecord(page)) return []

  const path = typeof page['path'] === 'string' ? page['path'] : ''
  const declared = new Set(extractParamNames(path))
  const label = pageLabel(page)
  const nodes = [...objectNodes(page['components']), ...objectNodes(page['layout'])]
  const strings = [...stringLeaves(page['components']), ...stringLeaves(page['layout'])]

  const route: RouteContext = { declared, label, path }

  return [
    ...routeParamViolations(nodes, strings, route),
    ...redirectToFirstViolations(page, nodes, label),
    ...breadcrumbViolations(nodes, label),
    ...queryViolations(page, label),
    ...sidebarGroupViolations(nodes, label),
    ...sidebarNavigationViolations(nodes, label),
    ...bottomBarViolations(nodes, label),
    ...recordVisibilityViolations(page, label),
    ...windowViolations(page, label),
    ...editSelectOptionViolations(nodes, label),
    ...formFieldOptionViolations(nodes, label),
    ...derivedColumnViolations(nodes, label),
    ...activeMarkerViolations(nodes, label),
    ...visibilityPolarityViolations(nodes, label),
    ...sharedFilterChannelViolations(nodes, label),
    ...systemRowTemplateViolations(nodes, label),
    ...systemRowTemplateDepthViolations(nodes, label),
    ...repeatPlacementViolations(page, label),
    ...inlineSvgSourceViolations(nodes, label),
    ...recordReferenceViolations(page, declared, label),
    ...codeContentFromViolations(nodes, label),
    ...routeParamAllowListViolations(page, declared, label),
    ...queryVisibilityViolations(page, label),
    ...actionPlacementViolations(nodes, label),
    ...compactFileUploadViolations(nodes, label),
    ...openDialogTargetViolations(page, label),
    ...readStateGateViolations(nodes, label),
  ]
}

function pageLabel(page: Readonly<Record<string, unknown>>): string {
  const name = typeof page['name'] === 'string' ? page['name'] : 'unnamed'
  return `page "${name}"`
}
