/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a GENERIC record sheet draws beyond its fields — a sheet bound to a
 * table that declares neither `recordFields` nor `related`, so everything it
 * shows is derived from the table:
 *
 *  - its tabs: Activity for a signed-in reader (the history route answers no
 *    one else), Comments when the table declares `comments`, Access when the
 *    table is an `auth.scopeTables` entry and the reader an admin (the only
 *    reader the grants listing answers). A tab whose read would be refused is
 *    not drawn, so opening a sheet fires no refused request;
 *  - whether the reader may delete the record (the menu's Delete);
 *  - the name a new record's sheet goes by ("New quote");
 *  - the fields the footer's "Edited … by …" reads;
 *  - "Linked from": one section per other table whose relationship points at
 *    this one and that the reader may read, with that table's derived fields
 *    and whether she may edit them, for a linked record opened in the sheet;
 *  - every word of the above in the page language.
 *
 * Resolved here, where the session and the tables are known; the island only
 * draws.
 */

import { labelForPhrase } from '@/domain/kernel/format/phrase-label'
import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'
import {
  hasDeletePermission,
  hasUpdatePermission,
} from '@/domain/models/app/auth/permission-evaluator-service'
import {
  resolveInterpreterString,
  resolveInterpreterStringOverrides,
  resolveTranslationTokensDeep,
} from '@/domain/models/app/languages/translation-resolver'
import { reverseRelationsOf } from '@/domain/models/app/tables/reverse-relations-service'
import { tableLabel, tableLabelPlural } from '@/domain/models/app/tables/table-display-name-service'
import {
  buildCommentThreadIslandProps,
  resolveCommentsFields,
  resolveTableCommentsConfig,
} from '@/presentation/render/registry/social-components-helpers'
import { applyDrawerFieldAccess, type DrawerHostFacts } from './resolve-record-drawer-access'
import { deriveTableEntries, type DrawerFieldLocale } from './resolve-record-drawer-fields'
import { callerAccess } from './resolve-record-drawer-related'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

type Table = NonNullable<Tables>[number]

/** How many records a "Linked from" section names. */
const LINKED_FROM_LIMIT = 5

/** One "Linked from" section: another table pointing here, and how its records open. */
export interface LinkedFromSection {
  readonly table: string
  readonly label: string
  readonly field: string
  readonly fields: unknown
  readonly canEdit: boolean
}

/** Everything a generic sheet draws beyond its fields — see the module note. */
export interface GenericSheet {
  readonly tabs: {
    readonly activity: boolean
    readonly comments?: Readonly<Record<string, unknown>>
    readonly access: boolean
  }
  readonly canDelete: boolean
  readonly newLabel: string
  readonly stamps?: { readonly at: string; readonly by?: string }
  readonly linkedFrom: readonly LinkedFromSection[]
  readonly limit: number
  readonly words: Readonly<Record<string, string>>
}

/** The interpreter keys the generic sheet draws, by the name the island reads them under. */
const WORD_KEYS: Readonly<Record<string, string>> = {
  details: 'recordDrawer.tabDetails',
  activity: 'recordDrawer.tabActivity',
  comments: 'recordDrawer.tabComments',
  access: 'recordDrawer.tabAccess',
  copyLink: 'recordDrawer.copyLink',
  moreActions: 'recordDrawer.moreActions',
  exportCsv: 'recordDrawer.exportCsv',
  delete: 'recordDrawer.delete',
  deletePrompt: 'recordDrawer.deletePrompt',
  linkedFrom: 'recordDrawer.linkedFrom',
  back: 'recordDrawer.back',
  edited: 'recordDrawer.edited',
  cancel: 'recordDrawer.cancel',
  requiredNote: 'recordDrawer.requiredNote',
  loading: 'recordDrawer.loading',
  activityEmpty: 'recordDrawer.activityEmpty',
  activityCreated: 'recordDrawer.activityCreated',
  activityUpdated: 'recordDrawer.activityUpdated',
  activityDeleted: 'recordDrawer.activityDeleted',
  activityRestored: 'recordDrawer.activityRestored',
  activitySomeone: 'recordDrawer.activitySomeone',
  accessRegion: 'recordDrawer.accessRegion',
  accessBody: 'recordDrawer.accessBody',
  accessEmpty: 'recordDrawer.accessEmpty',
  accessName: 'recordDrawer.accessName',
  accessEmail: 'recordDrawer.accessEmail',
  accessRole: 'recordDrawer.accessRole',
  invalidJson: 'recordDrawer.invalidJson',
  createFailed: 'datatable.createFailed',
}

/** Who the generic sheet is resolved for. */
export interface GenericSheetInput {
  readonly component: Component | undefined
  readonly tables: Tables | undefined
  readonly session: SessionInfo | undefined
  readonly host: DrawerHostFacts | undefined
  readonly locale: DrawerFieldLocale
}

/** Whether the reader is signed in — a session, or a mounted console's caller. */
const isSignedIn = (input: GenericSheetInput): boolean =>
  input.session !== undefined || input.host?.console !== undefined

/** Whether the reader is an admin — the one reader the grants listing answers. */
const isAdmin = (input: GenericSheetInput): boolean =>
  input.session?.isUnrestricted === true ||
  isAdminRole(input.session?.role) ||
  input.host?.console?.admin === true

/** Whether the reader may delete, or edit, a record of `table` — the records API's answer. */
function mayWrite(operation: 'delete' | 'update', table: Table, input: GenericSheetInput): boolean {
  const { session, tables, host } = input
  const check = operation === 'delete' ? hasDeletePermission : hasUpdatePermission
  if (host?.mode === 'open') return check(table, 'guest', tables, [])
  if (host?.console?.admin === true) return true
  if (session === undefined) return false
  if (session.isUnrestricted === true) return true
  return check(table, session.role, tables, (session.groups ?? []).map(toGroupReference))
}

/** The page language's words for every key the island draws. */
function wordsOf(locale: DrawerFieldLocale): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(WORD_KEYS).map(([name, key]) => [
      name,
      resolveInterpreterString(key, locale.currentLang, locale.languages),
    ])
  )
}

/** The Comments tab's thread props, when the table declares comments and the reader is signed in — a console caller included. */
function commentsTab(table: Table, input: GenericSheetInput) {
  if (table.comments === undefined || !isSignedIn(input)) return undefined
  const { currentLang, languages } = input.locale
  const placeholder = resolveInterpreterString('comments.placeholder', currentLang, languages)
  const fields = resolveCommentsFields(undefined, { table: table.name }, {}, placeholder)
  const { recordId: _unbound, ...props } = buildCommentThreadIslandProps({
    fields: { ...fields, sort: 'oldest' },
    elementProps: {},
    ...(input.session === undefined ? {} : { session: input.session }),
    threading: resolveTableCommentsConfig(table.name, input.tables).threading,
    uiStrings: resolveInterpreterStringOverrides(
      ['comments.', 'form.saving', 'form.deleting'],
      currentLang,
      languages
    ),
  })
  // A mounted console renders with no session, and its every caller is signed in.
  return input.session === undefined ? { ...props, signedIn: true } : props
}

/** The fields the footer's last change reads: the first updated-at, and updated-by, field. */
function stampsOf(table: Table): GenericSheet['stamps'] {
  const at = table.fields.find((field) => field.type === 'updated-at')?.name
  const by = table.fields.find((field) => field.type === 'updated-by')?.name
  if (at === undefined) return undefined
  return { at, ...(by === undefined ? {} : { by }) }
}

/** A `$t:` label in the page language. */
const translatorOf =
  (locale: DrawerFieldLocale) =>
  (text: string): string =>
    resolveTranslationTokensDeep(text, locale.currentLang, locale.languages) as string

/** The "Linked from" sections the reader may read, each with its derived fields. */
function linkedFromOf(table: Table, input: GenericSheetInput): readonly LinkedFromSection[] {
  const caller = {
    session: input.session,
    guest: input.host?.mode === 'guest',
    openApp: input.host?.mode === 'open',
  }
  return reverseRelationsOf(table.name, input.tables).flatMap((relation) => {
    const source = input.tables?.find((candidate) => candidate.name === relation.table)
    if (source === undefined || !callerAccess(source, input.tables, caller).read) return []
    const derived = deriveTableEntries(source, input.tables, input.locale)
    const localized = resolveTranslationTokensDeep(
      derived,
      input.locale.currentLang,
      input.locale.languages
    )
    return [
      {
        table: source.name,
        label: tableLabelPlural(source, translatorOf(input.locale)),
        field: relation.field,
        fields: applyDrawerFieldAccess(localized, input.host?.linkedAccess?.[source.name]),
        canEdit: mayWrite('update', source, input),
      },
    ]
  })
}

/** The table a generic sheet is bound to: table-bound, declaring no `recordFields` nor `related`. */
function genericSheetTable(input: GenericSheetInput): Table | undefined {
  const comp = (input.component ?? {}) as Readonly<Record<string, unknown>>
  const tableName = (comp['dataSource'] as { readonly table?: unknown } | undefined)?.table
  const derives = comp['recordFields'] === undefined && comp['related'] === undefined
  return typeof tableName === 'string' && derives
    ? input.tables?.find((candidate) => candidate.name === tableName)
    : undefined
}

/**
 * The create-mode heading: "New <label>" for a table that declares a singular
 * `label`, else the plain "New record" — a raw table name is usually plural, and
 * the singular is never derived from it.
 */
function newRecordLabel(table: Table, locale: GenericSheetInput['locale']): string {
  const { currentLang, languages } = locale
  if (table.label === undefined)
    return resolveInterpreterString('datatable.newRecord', currentLang, languages)
  const template = resolveInterpreterString('recordDrawer.newRecord', currentLang, languages)
  // Sentence case: "New quote", the label lowered inside the phrase.
  const label = labelForPhrase(template, '{label}', tableLabel(table, translatorOf(locale)))
  return fillPlaceholders(template, { label })
}

/**
 * The generic sheet's resolution, or `undefined` for a sheet that is not one —
 * bound to a system endpoint, or declaring its own `recordFields` or `related`.
 */
export function resolveGenericSheet(input: GenericSheetInput): GenericSheet | undefined {
  const table = genericSheetTable(input)
  if (table === undefined) return undefined
  const words = wordsOf(input.locale)
  const comments = commentsTab(table, input)
  const stamps = stampsOf(table)
  return {
    tabs: {
      activity: isSignedIn(input),
      ...(comments === undefined ? {} : { comments }),
      access: input.host?.scoped === true && isAdmin(input),
    },
    canDelete: mayWrite('delete', table, input),
    newLabel: newRecordLabel(table, input.locale),
    ...(stamps === undefined ? {} : { stamps }),
    linkedFrom: linkedFromOf(table, input),
    limit: LINKED_FROM_LIMIT,
    words,
  }
}
