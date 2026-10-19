/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import {
  resolveInterpreterString,
  resolveInterpreterStringOverrides,
  resolveTranslationTokensDeep,
} from '@/domain/models/app/languages/translation-resolver'
import { liftActionConfirms } from '@/presentation/render/props/action-confirm-lift'
import { recordTextFieldsOf } from '@/presentation/render/props/record-value-format'
import {
  applyDrawerFieldAccess,
  readDrawerFieldAccess,
  readDrawerHostFacts,
  type DrawerFieldAccess,
} from '@/presentation/render/props/resolve-record-drawer-access'
import { withDropZoneWords } from '@/presentation/render/props/resolve-record-drawer-drop-zone'
import {
  resolveRecordDrawerFieldProp,
  type DrawerFieldLocale,
} from '@/presentation/render/props/resolve-record-drawer-fields'
import {
  resolveGenericSheet,
  type GenericSheet,
} from '@/presentation/render/props/resolve-record-drawer-generic'
import {
  relatedCallerModeOf,
  resolveRelatedSections,
  type RelatedCaller,
} from '@/presentation/render/props/resolve-record-drawer-related'
import { RELATED_CALLER_TABLES_KEY } from '@/presentation/render/resolve/caller-table-stamp'
import { RECORD_TITLE_KEY } from '@/presentation/render/resolve/drawer-record-title-resolver'
import { drawerCanEdit } from './record-drawer-edit-right'
import { withSystemDateTime } from './record-drawer-system-instants'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement } from 'react'

/**
 * Hidden until the island opens it.
 *
 * Declared here rather than imported: the sibling that also needs it
 * (`row-expand-drawer-host.tsx`) keeps its own copy for the same reason, and a
 * two-property literal shared across three modules buys an import edge and no
 * safety — a divergence would be visible in the rendered markup.
 */
const HIDDEN_STYLE = { display: 'none' } as const

/**
 * The authored slot, as markup the island can inject (CAP-5).
 *
 * `undefined` when the author declared no children, and that matters: a key
 * whose value is `undefined` is DROPPED by `JSON.stringify`, so the serialised
 * props of a childless drawer are byte-for-byte what they were before this key
 * existed. The same crossing `buildDrawerProps` already makes for a plain
 * drawer, by the same route, so one slot does not learn a second grammar.
 */
function slotMarkup(renderedChildren: readonly ReactElement[]): string | undefined {
  if (renderedChildren.length === 0) return undefined
  return renderedChildren.map((child) => renderToStaticMarkup(child)).join('')
}

/**
 * `false` for a drawer reached ONLY from another drawer's related rows: it is
 * not the page's primary record surface, so a `?record=` deep link — an id of
 * the page's own table — must not open it on an id that belongs to another
 * table. Tagged by `resolveOpenDrawerDispatches`; `undefined` (so the island's
 * default, `true`) everywhere else, which keeps every other drawer's
 * serialised props byte-for-byte what they were.
 */
function deepLinkProp(rawProps: Readonly<Record<string, unknown>> | undefined): false | undefined {
  return rawProps?.['_relatedRowTargetOnly'] === true ? false : undefined
}

/** The author's `props.className`, when it is a string. */
function authorClassName(
  rawProps: Readonly<Record<string, unknown>> | undefined
): string | undefined {
  const className = rawProps?.['className']
  return typeof className === 'string' ? className : undefined
}

/**
 * The drawer's interpreter-provided control labels: save and close, plus the
 * CAP-8 related sections' create affordance, worded like the grid's toolbar.
 */
function drawerControlLabels(
  currentLang: string | undefined,
  languages: Languages | undefined
): Readonly<Record<string, unknown>> {
  const resolve = (key: string) => resolveInterpreterString(key, currentLang, languages)
  return {
    saveLabel: resolve('recordDrawer.save'),
    savingLabel: resolve('form.saving'),
    actionStrings: resolveInterpreterStringOverrides(['action.'], currentLang, languages),
    closeLabel: resolve('recordDrawer.close'),
    newRecordLabel: resolve('datatable.newRecord'),
    cancelLabel: resolve('datatable.cancel'),
    createFailedLabel: resolve('recordDrawer.relatedCreateFailed'),
    saveFailedLabel: resolve('form.operationFailed'),
    notFoundLabel: resolve('recordDrawer.notFound'),
    readFailedLabel: resolve('recordDrawer.readFailed'),
    // The words the island draws on its own: a footer question's Cancel, the
    // navigation, the refusal banner's name and a refused footer write's toast.
    builtInLabels: {
      cancel: resolve('confirmGate.cancel'),
      previous: resolve('recordDrawer.previous'),
      next: resolve('recordDrawer.next'),
      fullPage: resolve('recordDrawer.openFullPage'),
      navigation: resolve('recordDrawer.navigation'),
      position: resolve('recordDrawer.position'),
      saveRefused: resolve('recordDrawer.saveRefused'),
      validationError: resolve('recordDrawer.validationError'),
      writeRefusal: {
        'rateLimit.retryIn': resolve('rateLimit.retryIn'),
        'form.operationFailed': resolve('form.operationFailed'),
      },
    },
  }
}

/** The app's `design.badgeForm`, which a read-only drawer's option badges are painted in. */
const badgeFormOf = (
  design: { readonly badgeForm?: DrawerFieldLocale['badgeForm'] } | undefined
) => (design?.badgeForm === undefined ? {} : { badgeForm: design.badgeForm })

/**
 * The drawer's field entries with every `$t:` label / description in the page
 * language, as the reader may see them (`access`: a field they may not read is
 * left out, one they may not write is read-only).
 */
function localizedRecordFields(
  declared: unknown,
  component: Parameters<typeof resolveRecordDrawerFieldProp>[1],
  tables: Parameters<typeof resolveRecordDrawerFieldProp>[2],
  locale: DrawerFieldLocale & {
    readonly access: DrawerFieldAccess | undefined
    readonly system: boolean
  }
): unknown {
  const { access } = locale
  const entries = applyDrawerFieldAccess(
    resolveTranslationTokensDeep(
      resolveRecordDrawerFieldProp(declared, component, tables, locale),
      locale.currentLang ?? locale.languages?.default,
      locale.languages
    ),
    access
  )
  return Array.isArray(entries)
    ? entries.map((entry) =>
        withSystemDateTime(withRequiredWords(withClearWords(entry, locale), locale), locale.system)
      )
    : entries
}

/**
 * A required entry's refusal in the page language — the form's own words
 * (`form.requiredNamed`, filled with the entry's label). Stamped only where
 * they differ from the island's English, so an English page's payload is
 * unchanged.
 */
function withRequiredWords(entry: unknown, locale: DrawerFieldLocale): unknown {
  if (typeof entry !== 'object' || entry === null) return entry
  const { required, name, label } = entry as Readonly<Record<string, unknown>>
  if (required !== true) return entry
  const shown = typeof label === 'string' ? label : String(name)
  const requiredMessage = fillPlaceholders(
    resolveInterpreterString('form.requiredNamed', locale.currentLang, locale.languages),
    { label: shown }
  )
  return requiredMessage === `${shown} is required` ? entry : { ...entry, requiredMessage }
}

/**
 * A link entry's Clear control words in the page language — the caption
 * (`form.clear`) and the accessible name (`recordDrawer.clearRelation`, filled
 * with the entry's label). Stamped only where they differ from the island's
 * English, so an English page's payload is unchanged.
 */
function withClearWords(entry: unknown, locale: DrawerFieldLocale): unknown {
  if (typeof entry !== 'object' || entry === null) return entry
  const { type, name, label } = entry as Readonly<Record<string, unknown>>
  if (type !== 'relationship') return entry
  const resolve = (key: string) =>
    resolveInterpreterString(key, locale.currentLang, locale.languages)
  const clearLabel = resolve('form.clear')
  const shown = typeof label === 'string' ? label : String(name)
  const clearName = fillPlaceholders(resolve('recordDrawer.clearRelation'), { label: shown })
  const showName = fillPlaceholders(resolve('recordDrawer.showOptions'), { label: shown })
  return {
    ...entry,
    ...(showName === `Show ${shown} options` ? {} : { showOptionsName: showName }),
    ...(clearLabel === 'Clear' ? {} : { clearLabel }),
    ...(clearName === `Clear ${shown}` ? {} : { clearName }),
  }
}

/** Who a drawer's related sections are resolved for, as the page pass stamped her. */
function relatedCallerOf(
  rawProps: Readonly<Record<string, unknown>> | undefined,
  session: RelatedCaller['session']
): RelatedCaller {
  const mode = relatedCallerModeOf(rawProps)
  return {
    session,
    guest: mode === 'guest',
    openApp: mode === 'open',
    callerTables: rawProps?.[RELATED_CALLER_TABLES_KEY] as RelatedCaller['callerTables'],
  }
}

/**
 * The drawer's related sections for its caller, their create form's options
 * labelled in the page language.
 */
function relatedSectionsOf(
  comp: Readonly<Record<string, unknown>>,
  args: Pick<
    Parameters<ComponentRenderer>[0],
    'tables' | 'rawProps' | 'session' | 'languages' | 'currentLang'
  >
) {
  const caller = relatedCallerOf(args.rawProps, args.session)
  const locale = { languages: args.languages, currentLang: args.currentLang }
  return resolveRelatedSections(comp['related'], args.tables, caller, locale)
}

/**
 * How each formatted field of the drawer's table reads, so its slot and a
 * confirm prompt — filled in the browser — print a value exactly as the server
 * prints it on a record page.
 */
const drawerRecordText = (
  tables: Parameters<typeof recordTextFieldsOf>[0],
  table: string | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined
) => recordTextFieldsOf(tables, table, { locale: currentLang ?? 'en-US', languages })

/**
 * A generic sheet's tabs, menu, footer and "Linked from", resolved
 * for this reader — absent, so the payload is unchanged, for any other sheet.
 */
function genericSheetProp(
  context: Pick<
    Parameters<ComponentRenderer>[0],
    'rawProps' | 'component' | 'tables' | 'languages' | 'currentLang' | 'session' | 'design'
  >
): { readonly generic?: GenericSheet } {
  const { rawProps, component, tables, languages, currentLang, session, design } = context
  const generic = resolveGenericSheet({
    component,
    tables,
    session,
    host: readDrawerHostFacts(rawProps),
    locale: { languages, currentLang, ...badgeFormOf(design) },
  })
  return generic === undefined ? {} : { generic }
}

/**
 * The sheet's accessible NAME (CAP-2): `props.title` when declared; otherwise,
 * for a table-bound sheet, its record names it — the first text field
 * holding a value, else its id — which the page pass read for a sheet its
 * address opens (`_recordTitle`), the island taking over once a record loads.
 * The interpreter's default (English default, French built-in, author override
 * wins) stands in until then, and for a system-bound sheet.
 */
function drawerTitle(
  rawProps: Readonly<Record<string, unknown>> | undefined,
  dataSource: { readonly table?: string } | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined
): { readonly title: string; readonly titleFromRecord: boolean } {
  const declared = rawProps?.['title'] as string | undefined
  const titleFromRecord = declared === undefined && typeof dataSource?.table === 'string'
  const fromRecord = titleFromRecord
    ? (rawProps?.[RECORD_TITLE_KEY] as string | undefined)
    : undefined
  const title =
    declared ?? fromRecord ?? resolveInterpreterString('recordDrawer.title', currentLang, languages)
  return { title, titleFromRecord }
}

/**
 * A `drawer` carrying a `dataSource` — the record-detail/edit surface.
 *
 * `id`, `dataSource`, `recordFields`, `actions`, `role` and `canEdit` are
 * SCHEMA top-level fields (siblings of `props`), read from `component`. The
 * drawer starts CLOSED (hidden) and is opened by the data-table's
 * `sovrium:open-drawer` dispatch; the island then fetches the record and
 * renders the schema-derived form.
 *
 * A standalone function rather than a registry entry: `record-drawer` stopped
 * being a component type, but it is still its own ISLAND, and the marker it
 * emits is what selects that island.
 */
export const renderRecordBoundDrawer: ComponentRenderer = ({
  rawProps,
  elementProps,
  component,
  renderedChildren,
  tables,
  languages,
  currentLang,
  session,
  design,
  buckets,
}) => {
  const comp = (component ?? {}) as Record<string, unknown>
  const role = comp['role'] === 'region' ? 'region' : 'dialog'
  // `dataSource` is discriminated: `{ table }` (DB-table fetch + PATCH) OR
  // `{ system }` (CAP-2 system DETAIL-endpoint binding — READ-ONLY). The island
  // branches on which key is present; a system source forces `canEdit` off.
  const dataSource = comp['dataSource'] as
    { readonly table?: string; readonly system?: unknown } | undefined
  const { title, titleFromRecord } = drawerTitle(rawProps, dataSource, currentLang, languages)
  const recordFields = withDropZoneWords(
    localizedRecordFields(comp['recordFields'], component, tables, {
      ...{ languages, currentLang, ...badgeFormOf(design) },
      ...{ access: readDrawerFieldAccess(rawProps), system: dataSource?.system !== undefined },
    }),
    { buckets, currentLang, languages }
  )
  const props = {
    id: comp['id'] as string | undefined,
    title,
    ...(titleFromRecord ? { titleFromRecord: true } : {}),
    ...genericSheetProp({ rawProps, component, tables, languages, currentLang, session, design }),
    role,
    table: dataSource?.table,
    system: dataSource?.system,
    // `recordFields` is OPTIONAL: omitting it DERIVES one control per declared
    // field of the bound table (the "one component serves every table"
    // contract). Before this, the missing list defaulted to empty and the
    // drawer opened as a shell with nothing but a save button.
    // A field `label` or `description` may be a `$t:` key — on the entry or on
    // the bound table's field — and is resolved here, in the page language,
    // exactly as the grid's column header and the form's label resolve it; the
    // island only ever prints text.
    recordFields,
    // CAP-1: footer actions fire against the loaded record at click time.
    actions: liftActionConfirms(comp['actions'], { currentLang, languages }),
    // CAP-5: the composed-content slot. The island places it after the record
    // and before the footer, and resolves the `$record.*` tokens it carries once
    // the record lands — they cannot be resolved here, because at SSR the drawer
    // does not yet know which record it will be opened for.
    childrenHtml: slotMarkup(renderedChildren),
    recordText: drawerRecordText(tables, dataSource?.table, currentLang, languages),
    // CAP-8: the related sections, resolved against the related tables' field
    // schema and the caller's permissions here, where the session is known. A
    // section the caller may not read is absent, not emptied.
    related: relatedSectionsOf(comp, { tables, rawProps, session, languages, currentLang }),
    deepLink: deepLinkProp(rawProps),
    // Previous / Next through the opening list, and the record's own page.
    navigation: comp['navigation'],
    // The author's class reaches the surface the reader sees — the host is a
    // hidden marker, and the surface is portaled out of it.
    className: authorClassName(rawProps),
    canEdit: drawerCanEdit(comp, recordFields, tables),
    // Interpreter-provided control labels, resolved server-side so author
    // `languages.translations` overrides apply (the island cannot see them).
    ...drawerControlLabels(currentLang, languages),
  }
  return (
    <div
      data-island="record-drawer"
      data-island-props={JSON.stringify(props)}
      // The host names the drawer, served and mounted, closed and open — the
      // surface portaled out of it does not name it a second time.
      data-component-type="sheet"
      data-testid={elementProps['data-testid'] as string | undefined}
      style={HIDDEN_STYLE}
    >
      <div
        role={role}
        aria-label={title}
      >
        <p>Loading...</p>
      </div>
    </div>
  )
}
